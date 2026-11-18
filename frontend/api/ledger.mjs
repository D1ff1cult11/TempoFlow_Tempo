// /api/ledger (signed-in company only)
//   POST { fromBlock? }  -> indexes new Tempo events into ledger_rows; returns { added, lastBlock, caughtUp }
//                          Call again while caughtUp is false (each call reads a bounded window).
//   GET  ?kind=&agent=&team=&from=&to=&limit=&offset=  -> { rows, total, totals }
import { json, handler, requireDb, badRequest } from './_db.mjs';
import { requireCompany } from './_auth.mjs';
import { spendEvents, memoTransfers, blockTime, client, TOKENS } from '../src/lib/tempo.js';
import { matchEvents } from '../src/lib/ledger-core.js';

const WINDOW = 400_000n; // blocks per sync call (~4 RPC chunks per event type): keeps each call well under 10s
const START_LOOKBACK = 500_000n; // first sync without a hint starts this far back

export const POST = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const body = await request.json().catch(() => ({}));
  const latest = await client.getBlockNumber();

  const [state] = await sql`select last_block from sync_state where company = ${company}`;
  let from;
  if (state) from = BigInt(state.last_block) + 1n;
  else if (body.fromBlock != null && /^\d+$/.test(String(body.fromBlock))) from = BigInt(body.fromBlock);
  else from = latest > START_LOOKBACK ? latest - START_LOOKBACK : 0n;
  if (from > latest) return json({ added: 0, lastBlock: Number(latest), caughtUp: true });

  const to = from + WINDOW > latest ? latest : from + WINDOW;
  const [spends, ...perToken] = await Promise.all([
    spendEvents({ companyAddress: company, fromBlock: from, toBlock: to }),
    ...TOKENS.map((t) => memoTransfers({ companyAddress: company, token: t.address, fromBlock: from, toBlock: to })),
  ]);
  const rows = matchEvents({ spends, transfers: perToken.flat() });

  const times = {};
  await Promise.all([...new Set(rows.map((r) => r.blockNumber))].map(async (b) => (times[b] = new Date(await blockTime(b)))));

  let added = 0;
  if (rows.length) {
    const records = rows.map((r) => ({
      company,
      tx_hash: r.hash,
      log_index: r.logIndex,
      block_number: r.blockNumber,
      at: times[r.blockNumber],
      kind: r.kind,
      key_address: r.keyAddress,
      payee: r.payee,
      token: r.token,
      amount: r.amount,
      memo: r.memo,
      remaining: r.remaining,
    }));
    const inserted = await sql`insert into ledger_rows ${sql(records)} on conflict do nothing returning tx_hash`;
    added = inserted.length;
  }
  await sql`
    insert into sync_state (company, last_block) values (${company}, ${to.toString()})
    on conflict (company) do update set last_block = excluded.last_block, updated_at = now()`;
  return json({ added, lastBlock: Number(to), caughtUp: to >= latest });
});

export const GET = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const q = new URL(request.url).searchParams;
  const kind = q.get('kind');
  if (kind && !['agent', 'payroll', 'agent_fee'].includes(kind)) throw badRequest('kind must be agent, payroll or agent_fee');
  const agent = q.get('agent')?.toLowerCase() || null;
  const team = q.get('team') || null;
  const from = q.get('from') ? new Date(q.get('from')) : null;
  const to = q.get('to') ? new Date(q.get('to')) : null;
  if ((from && isNaN(from)) || (to && isNaN(to))) throw badRequest('from/to must be dates');
  const limit = Math.min(Math.max(Number(q.get('limit')) || 200, 1), 1000);
  const offset = Math.max(Number(q.get('offset')) || 0, 0);

  const where = sql`
    l.company = ${company}
    ${kind ? sql`and l.kind = ${kind}` : sql``}
    ${agent ? sql`and l.key_address = ${agent}` : sql``}
    ${team ? sql`and (a.team = ${team} or (${team} = 'People' and l.kind = 'payroll'))` : sql``}
    ${from ? sql`and l.at >= ${from}` : sql``}
    ${to ? sql`and l.at < ${to}` : sql``}`;
  const base = sql`
    from ledger_rows l
    left join agents a on a.company = l.company and a.key_address = l.key_address
    left join contractors c on c.company = l.company and c.wallet = l.payee
    where ${where}`;

  const rows = await sql`
    select l.*, a.name as agent_name, a.team as agent_team, c.name as payee_name ${base}
    order by l.block_number desc, l.log_index desc limit ${limit} offset ${offset}`;
  const [{ total, people, agents }] = await sql`
    select count(*)::int as total,
           coalesce(sum(l.amount) filter (where l.kind = 'payroll'), 0) as people,
           coalesce(sum(l.amount) filter (where l.kind <> 'payroll'), 0) as agents ${base}`;
  const [sync] = await sql`select last_block, updated_at from sync_state where company = ${company}`;
  return json({ rows, total, totals: { people: Number(people), agents: Number(agents) }, sync: sync ?? null });
});
