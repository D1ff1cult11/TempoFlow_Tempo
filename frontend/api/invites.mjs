// /api/invites (issue #12), signed-in company only
//   POST  { name, amount }                -> creates an invite; returns { invite, code } once (the code is the secret
//                                            part of the link; only its hash is stored)
//   GET                                   -> { invites }
//   PATCH { id, status: 'approved' | 'cancelled' } -> approving also saves the contractor label
import { randomBytes, createHash } from 'node:crypto';
import { json, handler, requireDb, badRequest } from './_db.mjs';
import { requireCompany } from './_auth.mjs';

const TTL_DAYS = 14;
export const hashSecret = (secret) => createHash('sha256').update(String(secret)).digest('hex');
const uuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v));

export const POST = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const b = (await request.json().catch(() => null)) || {};
  const name = String(b.name || '').trim().slice(0, 64);
  const amount = b.amount == null || b.amount === '' ? null : Number(b.amount);
  if (!name) throw badRequest('Name is required');
  if (amount != null && !(amount > 0 && amount < 1_000_000)) throw badRequest('Amount must be a positive number');
  const [{ open }] = await sql`select count(*)::int as open from contractor_invites where company = ${company} and status in ('sent','submitted')`;
  if (open >= 100) throw badRequest('Too many open invites; approve or cancel some first');

  const secret = randomBytes(24).toString('base64url');
  const [invite] = await sql`
    insert into contractor_invites (company, secret_hash, name, amount, expires_at)
    values (${company}, ${hashSecret(secret)}, ${name}, ${amount}, now() + make_interval(days => ${TTL_DAYS}))
    returning id, name, amount, status, created_at, expires_at`;
  return json({ invite, code: `${invite.id}.${secret}` });
});

export const GET = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const invites = await sql`
    select id, name, amount, status, wallet, created_at, submitted_at, expires_at from contractor_invites
    where company = ${company} and status <> 'cancelled' order by (status = 'submitted') desc, created_at desc limit 100`;
  return json({ invites });
});

export const PATCH = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const b = (await request.json().catch(() => null)) || {};
  if (!uuid(b.id) || !['approved', 'cancelled'].includes(b.status)) throw badRequest('id and status are required');
  const [inv] = await sql`select * from contractor_invites where id = ${b.id} and company = ${company}`;
  if (!inv) throw badRequest('Unknown invite');
  if (b.status === 'approved' && inv.status !== 'submitted') throw badRequest('Only submitted invites can be approved');
  if (['approved', 'cancelled'].includes(inv.status)) throw badRequest(`This invite is already ${inv.status}`);
  await sql`update contractor_invites set status = ${b.status} where id = ${b.id}`;
  if (b.status === 'approved') {
    await sql`
      insert into contractors (company, wallet, name, amount) values (${company}, ${inv.wallet}, ${inv.name}, ${inv.amount})
      on conflict (company, wallet) do update set name = excluded.name, amount = excluded.amount, updated_at = now()`;
  }
  return json({ ok: true, contractor: b.status === 'approved' ? { name: inv.name, wallet: inv.wallet, amount: inv.amount } : null });
});
