// Alert evaluation and webhook delivery (issue #6).
// Rules: low_budget (percent left below threshold), limit_hit (nothing left), expiry (key expires within N days).
// Each alert fires once per rule, agent and budget period / expiry date (dedupe_key is unique in alert_events).

import { chainClient } from './_auth.mjs';
import { tempoActions } from 'viem/tempo';
import { formatUnits } from 'viem';

const tempo = chainClient.extend(tempoActions());
const usd = (n) => `$${Number(n).toFixed(2)}`;
const day = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

/** Only public https URLs: no localhost, IP literals or internal names (limits server-side request forgery). */
export function checkWebhookUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return 'Not a valid URL';
  }
  // Local tests only: scripts/api-dev.mjs --allow-local-webhooks sets this; Vercel never does.
  if (process.env.TEMPOFLOW_ALLOW_LOCAL_WEBHOOKS === '1' && !process.env.VERCEL && u.hostname === 'localhost') return null;
  if (u.protocol !== 'https:') return 'Webhook URL must start with https://';
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) return 'Use a public webhook URL';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[')) return 'Use a hostname, not an IP address';
  return null;
}

/** Slack and most tools read `text`; Discord reads `content`. */
export async function sendWebhook(url, text, details = {}) {
  const discord = /discord(app)?\.com\/api\/webhooks\//.test(url);
  const body = discord ? { content: text } : { text, source: 'tempoflow', ...details };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
  });
  if (!r.ok) throw new Error(`Webhook answered ${r.status}`);
}

/** Reads every active agent's budget and expiry from Tempo and fires matching rules. Returns what was sent. */
export async function evaluateAlerts(sql, company) {
  const rules = await sql`select * from alert_rules where company = ${company} and enabled`;
  if (!rules.length) return [];
  const agents = await sql`select * from agents where company = ${company} and status = 'active'`;
  const fired = [];

  for (const agent of agents) {
    let remaining, periodEnd, meta;
    try {
      [{ remaining, periodEnd }, meta] = await Promise.all([
        tempo.accessKey.getRemainingLimit({ account: company, accessKey: agent.key_address, token: agent.token }),
        tempo.accessKey.getMetadata({ account: company, accessKey: agent.key_address }),
      ]);
    } catch {
      continue;
    }
    if (meta.isRevoked) continue;
    const left = Number(formatUnits(remaining, 6));
    const limit = Number(agent.daily_limit) || 0;
    const resetMs = periodEnd ? Number(periodEnd) * 1000 : null;
    const expiryMs = Number(meta.expiry) * 1000;

    for (const rule of rules) {
      let message = null;
      let dedupe = null;
      if (rule.kind === 'low_budget' && limit > 0 && left > 0.005) {
        const pct = (left / limit) * 100;
        if (pct < Number(rule.threshold ?? 20)) {
          message = `TempoFlow: agent "${agent.name}" has ${usd(left)} of ${usd(limit)} left today (${pct.toFixed(0)}%).${resetMs ? ` Resets ${day(resetMs)}.` : ''}`;
          dedupe = `${rule.id}|${agent.key_address}|${resetMs}`;
        }
      } else if (rule.kind === 'limit_hit' && limit > 0 && left <= 0.005) {
        message = `TempoFlow: agent "${agent.name}" used its whole daily limit (${usd(limit)}). Tempo blocks its payments${resetMs ? ` until ${day(resetMs)}` : ''}.`;
        dedupe = `${rule.id}|${agent.key_address}|${resetMs}`;
      } else if (rule.kind === 'expiry' && expiryMs > Date.now()) {
        const days = (expiryMs - Date.now()) / 86_400_000;
        if (days <= Number(rule.threshold ?? 3)) {
          message = `TempoFlow: agent "${agent.name}"'s key expires in ${Math.max(1, Math.ceil(days))} day(s) (${day(expiryMs)}).`;
          dedupe = `${rule.id}|${agent.key_address}|${expiryMs}`;
        }
      }
      if (!message) continue;

      const [event] = await sql`
        insert into alert_events (company, rule_id, key_address, message, dedupe_key, status)
        values (${company}, ${rule.id}, ${agent.key_address}, ${message}, ${dedupe}, 'sending')
        on conflict (dedupe_key) do nothing returning id`;
      if (!event) continue; // already alerted for this period
      let status = 'sent';
      try {
        await sendWebhook(rule.webhook_url, message, { kind: rule.kind, agent: agent.name, key: agent.key_address, left, limit });
      } catch {
        status = 'failed';
      }
      await sql`update alert_events set status = ${status} where id = ${event.id}`;
      fired.push({ kind: rule.kind, agent: agent.name, message, status });
    }
  }
  return fired;
}
