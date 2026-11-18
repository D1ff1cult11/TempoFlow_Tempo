// /api/alerts (signed-in company only)
//   GET                                   -> { rules, events }  (latest 20 events)
//   POST { kind, threshold, webhookUrl }  -> creates a rule
//   POST { action: 'check' }              -> evaluates rules now; returns what fired
//   POST { action: 'test', id }           -> sends a test message to that rule's webhook
//   DELETE ?id=                           -> removes a rule
import { json, handler, requireDb, badRequest } from './_db.mjs';
import { requireCompany } from './_auth.mjs';
import { checkWebhookUrl, sendWebhook, evaluateAlerts } from './_alerts.mjs';

const KINDS = { low_budget: 20, limit_hit: null, expiry: 3 };
const uuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v));

export const GET = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const rules = await sql`select id, kind, threshold, webhook_url, enabled, created_at from alert_rules where company = ${company} order by created_at`;
  const events = await sql`select kind, key_address, message, status, e.created_at from alert_events e join alert_rules r on r.id = e.rule_id
                           where e.company = ${company} order by e.created_at desc limit 20`;
  return json({ rules: rules.map((r) => ({ ...r, webhook_url: mask(r.webhook_url) })), events });
});

/** Webhook URLs contain secrets; only show the host and the end. */
const mask = (url) => {
  try {
    const u = new URL(url);
    return `${u.host}/…${u.pathname.slice(-4)}`;
  } catch {
    return '…';
  }
};

export const POST = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const body = (await request.json().catch(() => null)) || {};

  if (body.action === 'check') return json({ fired: await evaluateAlerts(sql, company) });

  if (body.action === 'test') {
    if (!uuid(body.id)) throw badRequest('Unknown rule');
    const [rule] = await sql`select webhook_url from alert_rules where id = ${body.id} and company = ${company}`;
    if (!rule) throw badRequest('Unknown rule');
    await sendWebhook(rule.webhook_url, 'TempoFlow test alert: this webhook is connected.').catch((e) => {
      throw badRequest(`Test failed: ${e.message}`);
    });
    return json({ ok: true });
  }

  if (!(body.kind in KINDS)) throw badRequest('kind must be low_budget, limit_hit or expiry');
  const problem = checkWebhookUrl(body.webhookUrl);
  if (problem) throw badRequest(problem);
  const threshold = KINDS[body.kind] == null ? null : Number(body.threshold ?? KINDS[body.kind]);
  if (threshold != null && !(threshold > 0 && threshold <= (body.kind === 'expiry' ? 365 : 100))) throw badRequest('threshold out of range');
  const [{ count }] = await sql`select count(*)::int as count from alert_rules where company = ${company}`;
  if (count >= 20) throw badRequest('Up to 20 alert rules per company');
  const [rule] = await sql`
    insert into alert_rules (company, kind, threshold, webhook_url) values (${company}, ${body.kind}, ${threshold}, ${body.webhookUrl})
    returning id, kind, threshold, enabled, created_at`;
  return json({ rule: { ...rule, webhook_url: mask(body.webhookUrl) } });
});

export const DELETE = handler(async (request) => {
  const company = requireCompany(request);
  const sql = requireDb();
  const id = new URL(request.url).searchParams.get('id');
  if (!uuid(id)) throw badRequest('Unknown rule');
  await sql`delete from alert_rules where id = ${id} and company = ${company}`;
  return json({ ok: true });
});
