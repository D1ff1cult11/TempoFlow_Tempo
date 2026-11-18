// Tests the database ledger (issue #9) against the local API and real Tempo testnet activity.
// Needs: node scripts/api-dev.mjs running, and a database in frontend/.env.local.
// Run: node scripts/test-api-ledger.mjs [http://localhost:8787]
import * as T from '../src/lib/tempo.js';

const base = process.argv[2] || 'http://localhost:8787';
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

// 1. A company with real activity on testnet.
const company = T.createTestKeyCompany();
await T.fundFromFaucet(company.address);
const key = T.newAgentKey(company.address);
const agent = { keyAddress: key.keyAddress, privateKey: key.privateKey, token: T.DEFAULT_TOKEN, dailyLimit: 5, expiryDays: 1, recipients: [] };
const { blockNumber } = await T.authorizeAgent({ company, agent });
const shop = T.createTestKeyCompany().address;
await T.agentPay({ companyAddress: company.address, agent, to: shop, amount: '1.50', memo: 'a:ledger-bot|t:42' });
const ana = T.createTestKeyCompany().address;
const ravi = T.createTestKeyCompany().address;
await T.payRun({
  company,
  token: T.DEFAULT_TOKEN,
  lines: [
    { address: ana, amount: '10', memo: 'INV-TEST-001' },
    { address: ravi, amount: '20', memo: 'INV-TEST-002' },
  ],
});
console.log('activity created on testnet');

// 2. Sign in.
const { nonce, message } = (await api(`/api/session?address=${company.address}`)).body;
const signature = await T.companyAccount(company).signMessage({ message });
const signedIn = await api('/api/session', { method: 'POST', body: { address: company.address, nonce, signature } });
const cookie = (signedIn.headers.get('set-cookie') || '').split(';')[0];
check(signedIn.status === 200, 'signed in');
check((await api('/api/ledger')).status === 401, 'ledger refuses requests without a session');

// 3. Labels.
const dir = await api('/api/directory', {
  cookie,
  method: 'POST',
  body: {
    agents: [{ keyAddress: key.keyAddress, name: 'ledger-bot', team: 'Research', token: T.DEFAULT_TOKEN, dailyLimit: 5, status: 'active', authBlock: Number(blockNumber) }],
    contractors: [
      { wallet: ana, name: 'Ana', amount: 10 },
      { wallet: ravi, name: 'Ravi', amount: 20 },
    ],
  },
});
check(dir.status === 200 && dir.body.agents === 1 && dir.body.contractors === 2, 'directory saved (1 agent, 2 people)');

// 4. Sync until caught up.
let sync;
let calls = 0;
do {
  sync = await api('/api/ledger', { cookie, method: 'POST', body: { fromBlock: Number(blockNumber) } });
  calls++;
} while (sync.status === 200 && !sync.body.caughtUp && calls < 10);
check(sync.status === 200 && sync.body.caughtUp, `synced from chain in ${calls} call(s)`);
const again = await api('/api/ledger', { cookie, method: 'POST', body: {} });
check(again.body?.added === 0, 'a second sync adds no duplicates');

// 5. Query.
const all = (await api('/api/ledger', { cookie })).body;
const kinds = all.rows.map((r) => r.kind).sort().join(',');
check(all.total === 4 && kinds === 'agent,agent_fee,payroll,payroll', `4 rows: ${kinds}`);
const agentRow = all.rows.find((r) => r.kind === 'agent');
check(agentRow?.agent_name === 'ledger-bot' && agentRow.memo === 'a:ledger-bot|t:42' && Number(agentRow.amount) === 1.5, 'agent row labelled with name and memo');
check(all.rows.filter((r) => r.kind === 'payroll').every((r) => ['Ana', 'Ravi'].includes(r.payee_name)), 'payroll rows labelled with contractor names');
check(Math.abs(all.totals.people - 30) < 1e-9, `people total = ${all.totals.people}`);

const onlyPayroll = (await api('/api/ledger?kind=payroll', { cookie })).body;
check(onlyPayroll.total === 2, 'filter by kind=payroll -> 2');
const byAgent = (await api(`/api/ledger?agent=${key.keyAddress}`, { cookie })).body;
check(byAgent.total === 2, 'filter by agent -> payment + fee');
const byTeam = (await api('/api/ledger?team=Research', { cookie })).body;
check(byTeam.total === 2, 'filter by team=Research -> 2');
const future = (await api(`/api/ledger?from=${new Date(Date.now() + 86400000).toISOString()}`, { cookie })).body;
check(future.total === 0, 'filter by date range -> 0 in the future');

// 6. Another company can't see these rows.
const other = T.createTestKeyCompany();
const n2 = (await api(`/api/session?address=${other.address}`)).body;
const s2 = await api('/api/session', {
  method: 'POST',
  body: { address: other.address, nonce: n2.nonce, signature: await T.companyAccount(other).signMessage({ message: n2.message }) },
});
const cookie2 = (s2.headers.get('set-cookie') || '').split(';')[0];
check((await api('/api/ledger', { cookie: cookie2 })).body.total === 0, "another company sees none of these rows");

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures ? 1 : 0;
