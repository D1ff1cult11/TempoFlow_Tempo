// /api/cron-alerts: daily check of every company's alert rules (Vercel Cron, see frontend/vercel.json).
// Vercel sends "Authorization: Bearer $CRON_SECRET" when the CRON_SECRET environment variable is set.
// Without CRON_SECRET this endpoint refuses every request.
import { json, handler, requireDb } from './_db.mjs';
import { evaluateAlerts } from './_alerts.mjs';

export const GET = handler(async (request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'Not allowed' }, 401);
  const sql = requireDb();
  const companies = await sql`select distinct company from alert_rules where enabled`;
  let fired = 0;
  for (const { company } of companies) fired += (await evaluateAlerts(sql, company)).length;
  return json({ companies: companies.length, fired });
});
