// /api/join (issue #12): used by the contractor from the invite link; no TempoFlow account needed.
//   GET  ?code=<id>.<secret>                      -> { name, amount, company, status, expiresAt }
//   POST { code, wallet, proof? }                 -> saves the contractor's wallet (status 'submitted')
//        proof: a signature by that wallet over joinMessage(); required unless confirmTyped is true
import { json, handler, requireDb, badRequest, isAddress } from './_db.mjs';
import { verifyAccountSignature } from './_auth.mjs';
import { hashSecret } from './invites.mjs';

/** What the contractor's new wallet signs to prove it is theirs. Must match the app's JoinPage. */
export const joinMessage = (inviteId, wallet) => `TempoFlow: join as a contractor\n\nInvite: ${inviteId}\nWallet: ${String(wallet).toLowerCase()}`;

async function findInvite(sql, code) {
  const [id, secret] = String(code || '').split('.');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !secret) return null;
  const [inv] = await sql`select * from contractor_invites where id = ${id} and secret_hash = ${hashSecret(secret)}`;
  return inv || null;
}

const gone = () => Object.assign(new Error('This invite link is not valid or has expired. Ask for a new one.'), { status: 404 });

export const GET = handler(async (request) => {
  const sql = requireDb();
  const inv = await findInvite(sql, new URL(request.url).searchParams.get('code'));
  if (!inv || inv.status === 'cancelled' || new Date(inv.expires_at) < new Date()) throw gone();
  return json({ name: inv.name, amount: inv.amount, company: inv.company, status: inv.status, expiresAt: inv.expires_at, wallet: inv.wallet });
});

export const POST = handler(async (request) => {
  const sql = requireDb();
  const b = (await request.json().catch(() => null)) || {};
  const inv = await findInvite(sql, b.code);
  if (!inv || inv.status === 'cancelled' || new Date(inv.expires_at) < new Date()) throw gone();
  if (inv.status === 'approved') throw badRequest('This invite was already approved');
  if (!isAddress(b.wallet)) throw badRequest('Enter a valid wallet address (0x + 40 hex characters)');
  const wallet = b.wallet.toLowerCase();
  if (b.proof) {
    if (!(await verifyAccountSignature(wallet, joinMessage(inv.id, wallet), b.proof))) throw badRequest('The wallet signature does not match');
  } else if (b.confirmTyped !== true) {
    throw badRequest('Confirm the address you typed, or create a wallet here');
  }
  await sql`update contractor_invites set wallet = ${wallet}, status = 'submitted', submitted_at = now() where id = ${inv.id}`;
  return json({ ok: true, status: 'submitted', verified: Boolean(b.proof) });
});
