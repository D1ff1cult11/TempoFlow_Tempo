// Tests limit-raise requests and approvals (issue #7) against the local API and Tempo testnet.
// Needs: node scripts/api-dev.mjs --allow-local-webhooks
// Run: node scripts/test-api-limit-requests.mjs
import { createServer } from 'node:http';
import * as T from '../src/lib/tempo.js';
import { createAgent, generateAgentKey, limitRequestMessage } from '../../packages/agent-sdk/src/index.js';

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
  return ((await api('/api/session', { method: 'POST', body: { address: company.address, nonce, signature } })).headers.get('set-cookie') || '').split(';')[0];
}

const received = [];
const hook = createServer(async (req, res) => {
  let s = '';
  for await (const c of req) s += c;
  received.push(JSON.parse(s));
  res.writeHead(200).end('ok');
}).listen(0);

try {
  const company = T.createTestKeyCompany();
  await T.fundFromFaucet(company.address);
  const { privateKey, keyAddress } = generateAgentKey();
  const agentRecord = { keyAddress, token: T.DEFAULT_TOKEN, dailyLimit: 2, expiryDays: 1, recipients: [] };
  await T.authorizeAgent({ company, agent: agentRecord });
  const cookie = await signIn(company);
  await api('/api/directory', { cookie, method: 'POST', body: { agents: [{ keyAddress, name: 'needy-bot', team: 'Research', token: T.DEFAULT_TOKEN, dailyLimit: 2, status: 'active' }] } });
  await api('/api/alerts', { cookie, method: 'POST', body: { kind: 'limit_hit', webhookUrl: `http://localhost:${hook.address().port}/h` } });

  // 1. The agent asks (SDK), the company is notified.
  const agent = createAgent({ privateKey, keyAddress, companyAddress: company.address, token: T.DEFAULT_TOKEN, serverUrl: base, name: 'needy-bot' });
  const first = await agent.requestLimit({ newLimit: 4, reason: 'first try' });
  check(first?.status === 'pending' && first.key_address === keyAddress.toLowerCase(), 'agent request recorded as pending for its own key');
  check(received.some((m) => /needy-bot.*\$4: first try/.test(m.text)), 'company webhook notified about the request');
  const second = await agent.requestLimit({ newLimit: 5, reason: 'big crawl tonight' });
  let list = (await api('/api/limit-requests', { cookie })).body.requests;
  check(list.filter((r) => r.status === 'pending').length === 1 && Number(list[0].requested_limit) === 5, 'a new request replaces the older pending one');

  // 2. Forgeries are refused.
  const stranger = generateAgentKey(); // never authorized
  const strangerAgent = createAgent({ privateKey: stranger.privateKey, companyAddress: company.address, token: T.DEFAULT_TOKEN, serverUrl: base });
  check(await strangerAgent.requestLimit({ newLimit: 100 }).then(() => false, () => true), 'a key the company never authorized is refused');
  const otherCompany = T.createTestKeyCompany();
  const ts = Date.now();
  const wrongCompanySig = await agent.account.signMessage({ message: limitRequestMessage({ company: otherCompany.address, requestedLimit: 9, reason: '', timestamp: ts }) });
  check((await api('/api/limit-requests', { method: 'POST', body: { company: otherCompany.address, requestedLimit: 9, reason: '', timestamp: ts, signature: wrongCompanySig } })).status === 401, "an agent can't file requests for another company");
  const old = Date.now() - 60 * 60 * 1000;
  const oldSig = await agent.account.signMessage({ message: limitRequestMessage({ company: company.address, requestedLimit: 9, reason: '', timestamp: old }) });
  check((await api('/api/limit-requests', { method: 'POST', body: { company: company.address, requestedLimit: 9, reason: '', timestamp: old, signature: oldSig } })).status === 400, 'an old (replayed) request is refused');

  // 3. Approval needs a real limit-change transaction from the company.
  const req = list.find((r) => r.status === 'pending');
  check((await api('/api/limit-requests', { cookie, method: 'PATCH', body: { id: req.id, status: 'approved' } })).status === 400, 'approve without a transaction is refused');
  const someoneElse = T.createTestKeyCompany();
  await T.fundFromFaucet(someoneElse.address);
  const foreignTx = (await T.fundFromFaucet(someoneElse.address))[0]?.transactionHash;
  if (foreignTx) check((await api('/api/limit-requests', { cookie, method: 'PATCH', body: { id: req.id, status: 'approved', tx: foreignTx } })).status === 400, "someone else's transaction is refused as proof");
  const outsider = await signIn(T.createTestKeyCompany());
  check((await api('/api/limit-requests', { cookie: outsider, method: 'PATCH', body: { id: req.id, status: 'rejected' } })).status === 400, "another company can't decide this request");

  const tx = await T.updateAgentLimit({ company, agent: agentRecord, newLimit: 5 });
  const approved = await api('/api/limit-requests', { cookie, method: 'PATCH', body: { id: req.id, status: 'approved', tx } });
  check(approved.status === 200, 'approved with the on-chain limit change');
  const { remaining } = await agent.remaining();
  check(remaining === 5, `Tempo now allows $${remaining} today`);
  list = (await api('/api/limit-requests', { cookie })).body.requests;
  check(list[0].status === 'approved' && Number(list[0].current_limit) === 5, 'request shows approved and the agent label shows the new limit');
  check((await api('/api/limit-requests', { cookie, method: 'PATCH', body: { id: req.id, status: 'rejected' } })).status === 400, 'a decided request cannot be changed');

  // 4. Reject flow.
  const third = await agent.requestLimit({ newLimit: 50, reason: 'too much' });
  check((await api('/api/limit-requests', { cookie, method: 'PATCH', body: { id: third.id, status: 'rejected' } })).status === 200, 'admin can reject a request');
  check((await api('/api/limit-requests', { cookie: outsider })).body.requests.length === 0, 'another company sees none of these requests');
} finally {
  hook.close();
}
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures ? 1 : 0;
