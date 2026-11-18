// /api/cron-alerts: daily job (Vercel Cron, see frontend/vercel.json).
//  - checks every company's alert rules (issue #6)
//  - sends reminders for pay runs that are due (issue #13; reminders only, the server never pays)
// Vercel sends "Authorization: Bearer $CRON_SECRET" when the CRON_SECRET environment variable is set.
// Without CRON_SECRET this endpoint refuses every request.
import { json, handler, requireDb } from './_db.mjs';
import { evaluateAlerts } from './_alerts.mjs';
import { remindDue } from './_schedules.mjs';

export const GET = handler(async (request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'Not allowed' }, 401);
  const sql = requireDb();
  const companies = await sql`select distinct company from alert_rules where enabled`;
  let fired = 0;
  for (const { company } of companies) fired += (await evaluateAlerts(sql, company)).length;
  const scheduled = await sql`select distinct company from pay_schedules where enabled`;
  let reminded = 0;
  for (const { company } of scheduled) reminded += (await remindDue(sql, company)).length;
  return json({ companies: companies.length, fired, reminded });
});
