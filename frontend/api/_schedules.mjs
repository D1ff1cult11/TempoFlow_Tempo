// Pay-run reminders (issue #13). The server never pays: it only notices that a run is due and tells the company.
import { sendWebhook } from './_alerts.mjs';

/** Due schedules for a company: next_run on or before today (UTC). The period label is the due date. */
export async function dueRuns(sql, company) {
  return sql`
    select s.id as schedule_id, s.cadence, s.token, to_char(s.next_run, 'YYYY-MM-DD') as period
    from pay_schedules s
    where s.company = ${company} and s.enabled and s.next_run <= (now() at time zone 'utc')::date`;
}

/** Sends one reminder per schedule and period to the company's alert webhooks. Returns reminders sent. */
export async function remindDue(sql, company) {
  const due = await dueRuns(sql, company);
  if (!due.length) return [];
  const hooks = await sql`select distinct webhook_url from alert_rules where company = ${company} and enabled`;
  const sent = [];
  for (const d of due) {
    const [row] = await sql`
      insert into pay_runs (company, schedule_id, period, status) values (${company}, ${d.schedule_id}, ${d.period}, 'due')
      on conflict (schedule_id, period) do nothing returning id`;
    if (!row) continue; // already reminded (or paid) for this period
    const text = `TempoFlow: the ${d.cadence} pay run for ${d.period} is due. Open TempoFlow → People and click "Pay now".`;
    await Promise.allSettled(hooks.map((h) => sendWebhook(h.webhook_url, text)));
    sent.push(d);
  }
  return sent;
}
