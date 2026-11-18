// /api/directory (signed-in company only)
//   POST { agents: [{ keyAddress, name, team, token, dailyLimit, status, authBlock }], contractors: [{ wallet, name, role, amount }] }
// Saves the names and teams the ledger uses for labels. Spending rules stay on Tempo; this is labels only.
import { json, handler, requireDb, badRequest, isAddress } from './_db.mjs';
import { requireCompany } from './_auth.mjs';

const text = (v, max = 64) => (v == null ? null : String(v).slice(0, max));

export const POST = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const body = await request.json().catch(() => null);
  const agents = Array.isArray(body?.agents) ? body.agents.slice(0, 500) : [];
  const contractors = Array.isArray(body?.contractors) ? body.contractors.slice(0, 1000) : [];
  if (agents.some((a) => !isAddress(a.keyAddress) || !isAddress(a.token))) throw badRequest('Each agent needs a keyAddress and token address');
  if (contractors.some((c) => !isAddress(c.wallet))) throw badRequest('Each contractor needs a wallet address');

  if (agents.length) {
    const records = agents.map((a) => ({
      company,
      key_address: a.keyAddress.toLowerCase(),
      name: text(a.name) || 'agent',
      team: text(a.team),
      token: a.token.toLowerCase(),
      daily_limit: Number(a.dailyLimit) || 0,
      status: ['active', 'revoked', 'pending'].includes(a.status) ? a.status : 'active',
      auth_block: Number.isInteger(a.authBlock) ? a.authBlock : null,
    }));
    await sql`
      insert into agents ${sql(records)}
      on conflict (company, key_address) do update set
        name = excluded.name, team = excluded.team, token = excluded.token, daily_limit = excluded.daily_limit,
        status = excluded.status, auth_block = coalesce(excluded.auth_block, agents.auth_block), updated_at = now()`;
  }
  if (contractors.length) {
    const records = contractors.map((c) => ({
      company,
      wallet: c.wallet.toLowerCase(),
      name: text(c.name) || 'contractor',
      role: text(c.role),
      amount: c.amount == null ? null : Number(c.amount),
    }));
    await sql`
      insert into contractors ${sql(records)}
      on conflict (company, wallet) do update set
        name = excluded.name, role = excluded.role, amount = excluded.amount, updated_at = now()`;
  }
  return json({ agents: agents.length, contractors: contractors.length });
});
