// /api/limit-requests (issue #7)
//   POST  (agent, signed with its own access key)  { company, requestedLimit, reason, timestamp, signature }
//         -> records a pending request (one pending per agent key; a new one replaces it) and notifies the
//            company's alert webhooks.
//   GET   (signed-in company)  -> { requests }
//   PATCH (signed-in company)  { id, status: 'approved' | 'rejected', tx? }
//         -> approved needs the hash of the company's on-chain updateLimit transaction, which is checked.
import { hashMessage } from 'viem';
import { Address } from 'ox';
import { SignatureEnvelope } from 'ox/tempo';
import { json, handler, requireDb, badRequest, isAddress } from './_db.mjs';
import { requireCompany, verifyAgentSignature, chainClient } from './_auth.mjs';
import { sendWebhook } from './_alerts.mjs';

const MAX_AGE_MS = 10 * 60 * 1000;

/** Must match limitRequestMessage() in packages/agent-sdk/src/index.js exactly. */
export function limitRequestMessage({ company, requestedLimit, reason, timestamp }) {
  return `TempoFlow limit request\n\nCompany: ${String(company).toLowerCase()}\nNew daily limit: ${Number(requestedLimit)}\nReason: ${reason || ''}\nTime: ${timestamp}`;
}

/** The agent key that made a keychain signature (read from the P256/WebAuthn public key inside it). */
function signingKey(signature, company) {
  try {
    const env = SignatureEnvelope.deserialize(signature);
    if (env.type !== 'keychain' || env.userAddress.toLowerCase() !== company || !env.inner?.publicKey) return null;
    return Address.fromPublicKey(env.inner.publicKey).toLowerCase();
  } catch {
    return null;
  }
}

export const POST = handler(async (request) => {
  const sql = requireDb();
  const b = (await request.json().catch(() => null)) || {};
  const company = String(b.company || '').toLowerCase();
  const requestedLimit = Number(b.requestedLimit);
  const reason = String(b.reason || '').slice(0, 200);
  const timestamp = Number(b.timestamp);
  if (!isAddress(company) || !(requestedLimit > 0 && requestedLimit <= 1_000_000) || !b.signature) throw badRequest('company, requestedLimit and signature are required');
  if (!(Math.abs(Date.now() - timestamp) < MAX_AGE_MS)) throw badRequest('Request expired; sign a fresh one');

  const message = limitRequestMessage({ company, requestedLimit, reason, timestamp });
  const key = signingKey(b.signature, company);
  if (!key || !(await verifyAgentSignature(company, message, b.signature))) {
    throw Object.assign(new Error('Not signed by an authorized agent key of this company'), { status: 401 });
  }

  await sql`update limit_requests set status = 'replaced', decided_at = now()
            where company = ${company} and key_address = ${key} and status = 'pending'`;
  const [row] = await sql`
    insert into limit_requests (company, key_address, requested_limit, reason)
    values (${company}, ${key}, ${requestedLimit}, ${reason}) returning id, status, created_at`;

  const [agent] = await sql`select name, daily_limit from agents where company = ${company} and key_address = ${key}`;
  const who = agent ? `"${agent.name}"` : key;
  const text = `TempoFlow: agent ${who} asks to raise its daily limit${agent ? ` from $${Number(agent.daily_limit)}` : ''} to $${requestedLimit}${reason ? `: ${reason}` : ''}. Approve or reject it in TempoFlow → Agents.`;
  const hooks = await sql`select distinct webhook_url from alert_rules where company = ${company} and enabled`;
  await Promise.allSettled(hooks.map((h) => sendWebhook(h.webhook_url, text)));

  return json({ request: { ...row, key_address: key, requested_limit: requestedLimit } });
});

export const GET = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const requests = await sql`
    select r.id, r.key_address, r.requested_limit, r.reason, r.status, r.created_at, r.decided_at, r.decided_tx,
           a.name as agent_name, a.daily_limit as current_limit
    from limit_requests r left join agents a on a.company = r.company and a.key_address = r.key_address
    where r.company = ${company} and r.status <> 'replaced'
    order by (r.status = 'pending') desc, r.created_at desc limit 50`;
  return json({ requests });
});

export const PATCH = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const b = (await request.json().catch(() => null)) || {};
  if (!/^[0-9a-f-]{36}$/i.test(String(b.id)) || !['approved', 'rejected'].includes(b.status)) throw badRequest('id and status are required');
  const [req] = await sql`select * from limit_requests where id = ${b.id} and company = ${company}`;
  if (!req) throw badRequest('Unknown request');
  if (req.status !== 'pending') throw badRequest(`This request is already ${req.status}`);

  if (b.status === 'approved') {
    if (!/^0x[0-9a-f]{64}$/i.test(String(b.tx))) throw badRequest('Approving needs the limit-change transaction hash');
    const receipt = await chainClient.getTransactionReceipt({ hash: b.tx }).catch(() => null);
    if (!receipt || receipt.status !== 'success' || receipt.from.toLowerCase() !== company) {
      throw badRequest('That transaction is not a successful transaction from this company');
    }
  }
  await sql`update limit_requests set status = ${b.status}, decided_at = now(), decided_tx = ${b.tx ?? null} where id = ${b.id}`;
  if (b.status === 'approved') {
    await sql`update agents set daily_limit = ${req.requested_limit}, updated_at = now() where company = ${company} and key_address = ${req.key_address}`;
  }
  return json({ ok: true });
});
