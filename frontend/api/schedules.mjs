// /api/schedules (issue #13), signed-in company only. Reminder model: the server never holds a key.
//   GET                                         -> { schedules, due, runs }
//   POST { cadence, firstRun, token }           -> creates a schedule
//   POST { action: 'remind' }                   -> sends reminders for due runs now (same as the daily cron)
//   PATCH { scheduleId, period, tx }            -> records a run as paid (tx must be a successful tx from the
//                                                  company) and moves the schedule to its next date
//   DELETE ?id=                                 -> removes a schedule
import { json, handler, requireDb, badRequest, isAddress } from './_db.mjs';
import { requireCompany, chainClient } from './_auth.mjs';
import { dueRuns, remindDue } from './_schedules.mjs';

const uuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v));
const STEP = { weekly: true, monthly: true };

export const GET = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const schedules = await sql`
    select id, cadence, token, enabled, to_char(next_run, 'YYYY-MM-DD') as next_run, created_at
    from pay_schedules where company = ${company} order by created_at`;
  const runs = await sql`
    select schedule_id, period, status, tx_hash, total, created_at from pay_runs
    where company = ${company} order by created_at desc limit 20`;
  return json({ schedules, due: await dueRuns(sql, company), runs });
});

export const POST = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const b = (await request.json().catch(() => null)) || {};
  if (b.action === 'remind') return json({ reminded: await remindDue(sql, company) });

  if (!(b.cadence in STEP)) throw badRequest('cadence must be weekly or monthly');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.firstRun)) || isNaN(new Date(b.firstRun))) throw badRequest('firstRun must be a date (YYYY-MM-DD)');
  if (!isAddress(b.token)) throw badRequest('token must be a stablecoin address');
  const [{ count }] = await sql`select count(*)::int as count from pay_schedules where company = ${company}`;
  if (count >= 10) throw badRequest('Up to 10 schedules per company');
  const [schedule] = await sql`
    insert into pay_schedules (company, cadence, next_run, token) values (${company}, ${b.cadence}, ${b.firstRun}, ${b.token.toLowerCase()})
    returning id, cadence, token, enabled, to_char(next_run, 'YYYY-MM-DD') as next_run`;
  return json({ schedule });
});

export const PATCH = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const b = (await request.json().catch(() => null)) || {};
  if (!uuid(b.scheduleId) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.period)) || !/^0x[0-9a-f]{64}$/i.test(String(b.tx))) {
    throw badRequest('scheduleId, period and tx are required');
  }
  const [s] = await sql`select * from pay_schedules where id = ${b.scheduleId} and company = ${company}`;
  if (!s) throw badRequest('Unknown schedule');
  const [prior] = await sql`select status from pay_runs where schedule_id = ${s.id} and period = ${b.period}`;
  if (prior?.status === 'paid') throw badRequest('This period is already paid');
  const receipt = await chainClient.getTransactionReceipt({ hash: b.tx }).catch(() => null);
  if (!receipt || receipt.status !== 'success' || receipt.from.toLowerCase() !== company) {
    throw badRequest('That transaction is not a successful transaction from this company');
  }
  const total = b.total == null ? null : Number(b.total);
  await sql`
    insert into pay_runs (company, schedule_id, period, status, tx_hash, total) values (${company}, ${s.id}, ${b.period}, 'paid', ${b.tx}, ${total})
    on conflict (schedule_id, period) do update set status = 'paid', tx_hash = excluded.tx_hash, total = excluded.total`;
  // Move to the first date after today (skipping periods missed while overdue).
  const today = new Date().toISOString().slice(0, 10);
  let next = nextDate(b.period, s.cadence);
  while (next <= today) next = nextDate(next, s.cadence);
  await sql`update pay_schedules set next_run = ${next} where id = ${s.id}`;
  return json({ ok: true, nextRun: next });
});

/** +7 days, or +1 month keeping the day where possible (31 Jan -> 28/29 Feb). Dates are YYYY-MM-DD (UTC). */
export function nextDate(iso, cadence) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (cadence === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export const DELETE = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const id = new URL(request.url).searchParams.get('id');
  if (!uuid(id)) throw badRequest('Unknown schedule');
  await sql`delete from pay_schedules where id = ${id} and company = ${company}`;
  return json({ ok: true });
});
