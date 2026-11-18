// Tests alerts (issue #6) against the local API and Tempo testnet.
// Needs: node scripts/api-dev.mjs --throwaway --allow-local-webhooks
// Run: node scripts/test-api-alerts.mjs
import { createServer } from 'node:http';
import * as T from '../src/lib/tempo.js';
import { createAgent } from '../../packages/agent-sdk/src/index.js';

const base = 'http://localhost:8787';
let failures = 0;
const check = (ok, label) => {
  console.log(ok ? 'ok  ' : 'FAIL', label);
  if (!ok) failures++;
};
const api = async (path, { cookie, method = 'GET', body } = {}) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
};
async function signIn(company) {
  const { nonce, message } = (await api(`/api/session?address=${company.address}`)).body;
  const signature = await T.companyAccount(company).signMessage({ message });
  const r = await api('/api/session', { method: 'POST', body: { address: company.address, nonce, signature } });
  return (r.headers.get('set-cookie') || '').split(';')[0];
}

// A local webhook receiver that records what TempoFlow posts.
const received = [];
const hook = createServer(async (req, res) => {
  let s = '';
  for await (const c of req) s += c;
  received.push(JSON.parse(s));
  res.writeHead(200).end('ok');
}).listen(0);
const hookUrl = `http://localhost:${hook.address().port}/hook`;

try {
  const company = T.createTestKeyCompany();
  await T.fundFromFaucet(company.address);
  // Agent A: $2/day, expires in 1 day. Agent B: $1/day, will hit its limit.
  const keyA = T.newAgentKey(company.address);
  const keyB = T.newAgentKey(company.address);
  const a = { keyAddress: keyA.keyAddress, privateKey: keyA.privateKey, token: T.DEFAULT_TOKEN, dailyLimit: 2, expiryDays: 1, recipients: [] };
  const b = { keyAddress: keyB.keyAddress, privateKey: keyB.privateKey, token: T.DEFAULT_TOKEN, dailyLimit: 1, expiryDays: 30, recipients: [] };
  await T.authorizeAgent({ company, agent: a });
  await T.authorizeAgent({ company, agent: b });
  const cookie = await signIn(company);
  await api('/api/directory', {
    cookie,
    method: 'POST',
    body: {
      agents: [
        { keyAddress: a.keyAddress, name: 'alert-a', team: 'Research', token: a.token, dailyLimit: 2, status: 'active' },
        { keyAddress: b.keyAddress, name: 'alert-b', team: 'Ops', token: b.token, dailyLimit: 1, status: 'active' },
      ],
    },
  });

  // Rule validation.
  check((await api('/api/alerts', { cookie, method: 'POST', body: { kind: 'low_budget', webhookUrl: 'http://example.com/x' } })).status === 400, 'http:// webhook refused');
  check((await api('/api/alerts', { cookie, method: 'POST', body: { kind: 'low_budget', webhookUrl: 'https://10.0.0.1/x' } })).status === 400, 'IP-address webhook refused');
  check((await api('/api/alerts', { cookie, method: 'POST', body: { kind: 'nope', webhookUrl: hookUrl } })).status === 400, 'unknown kind refused');

  const low = await api('/api/alerts', { cookie, method: 'POST', body: { kind: 'low_budget', threshold: 60, webhookUrl: hookUrl } });
  const hit = await api('/api/alerts', { cookie, method: 'POST', body: { kind: 'limit_hit', webhookUrl: hookUrl } });
  const exp = await api('/api/alerts', { cookie, method: 'POST', body: { kind: 'expiry', threshold: 3, webhookUrl: hookUrl } });
  check(low.status === 200 && hit.status === 200 && exp.status === 200, 'three rules created');
  check(!JSON.stringify(low.body).includes(String(hook.address().port) + '/hook'), 'webhook URL is masked in responses');

  const test = await api('/api/alerts', { cookie, method: 'POST', body: { action: 'test', id: low.body.rule.id } });
  check(test.status === 200 && received.some((m) => /test alert/.test(m.text)), 'test message delivered');

  // Spend: A pays $1.20 (40% left < 60%), B pays its whole $1.00 through the sponsored relay (0 left).
  await T.agentPay({ companyAddress: company.address, agent: a, to: T.createTestKeyCompany().address, amount: '1.20', memo: 'a:alert-a|t:1' });
  const agentB = createAgent({ privateKey: b.privateKey, companyAddress: company.address, token: b.token, relayUrl: `${base}/api/relay` });
  await agentB.pay({ to: T.createTestKeyCompany().address, amount: '1.00', task: 'drain' });

  const before = received.length;
  const fired = (await api('/api/alerts', { cookie, method: 'POST', body: { action: 'check' } })).body.fired;
  const kinds = fired.map((f) => `${f.kind}:${f.agent}`).sort();
  check(kinds.includes('low_budget:alert-a'), 'low budget fired for alert-a');
  check(kinds.includes('limit_hit:alert-b'), 'limit hit fired for alert-b');
  check(kinds.includes('expiry:alert-a') && !kinds.includes('expiry:alert-b'), 'expiry fired only for the 1-day key');
  check(received.length - before === fired.length && fired.every((f) => f.status === 'sent'), `${fired.length} webhooks delivered`);

  const again = (await api('/api/alerts', { cookie, method: 'POST', body: { action: 'check' } })).body.fired;
  check(again.length === 0, 'no repeat alerts in the same budget period');

  const list = (await api('/api/alerts', { cookie })).body;
  check(list.rules.length === 3 && list.events.length >= 3, 'rules and recent events listed');

  const other = await signIn(T.createTestKeyCompany());
  await api(`/api/alerts?id=${low.body.rule.id}`, { cookie: other, method: 'DELETE' });
  check((await api('/api/alerts', { cookie })).body.rules.length === 3, "another company can't delete these rules");
  await api(`/api/alerts?id=${low.body.rule.id}`, { cookie, method: 'DELETE' });
  check((await api('/api/alerts', { cookie })).body.rules.length === 2, 'owner can delete a rule');

  check((await api('/api/cron-alerts')).status === 401, 'cron endpoint refuses requests without CRON_SECRET');
} finally {
  hook.close();
}
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures ? 1 : 0;
