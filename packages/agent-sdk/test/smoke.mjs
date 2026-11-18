// End-to-end test of @tempoflow/agent on Tempo testnet (throwaway keys, faucet funds only).
// Run: npm test   (from packages/agent-sdk)

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createClient, http, parseUnits, publicActions, walletActions } from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Account, Expiry, tempoActions } from 'viem/tempo';
import { createAgent, generateAgentKey, BudgetExceededError, KeyNotAllowedError } from '../src/index.js';

const ALPHA = '0x20c0000000000000000000000000000000000001';
const admin = createClient({ chain: tempoModerato, transport: http() }).extend(publicActions).extend(walletActions).extend(tempoActions());
let failures = 0;
const check = (ok, label) => {
  console.log(ok ? 'ok  ' : 'FAIL', label);
  if (!ok) failures++;
};

// 1. Company authorizes a key that the agent generated itself (only the address is shared).
const company = Account.fromSecp256k1(generatePrivateKey());
await admin.faucet.fundSync({ account: company.address });
const key = generateAgentKey();
const check1 = createAgent({ privateKey: key.privateKey, companyAddress: company.address, token: ALPHA });
check(check1.keyAddress.toLowerCase() === key.keyAddress.toLowerCase(), 'generateAgentKey address matches the access key address');

await admin.accessKey.authorizeSync({
  account: company,
  accessKey: { accessKeyAddress: key.keyAddress, keyType: 'p256' },
  expiry: Expiry.days(1),
  limits: [{ token: ALPHA, limit: parseUnits('5', 6), period: 86_400 }],
  scopes: [
    { address: ALPHA, selector: 'transferWithMemo(address,uint256,bytes32)' },
    { address: ALPHA, selector: 'transfer(address,uint256)' },
  ],
});

// 2. Pay with a task memo, read the budget.
const agent = createAgent({ privateKey: key.privateKey, companyAddress: company.address, token: ALPHA, name: 'research-bot' });
const merchant = privateKeyToAccount(generatePrivateKey()).address;
const hash = await agent.pay({ to: merchant, amount: '1.00', task: '1042' });
check(/^0x[0-9a-f]{64}$/.test(hash), `pay() returned tx ${hash.slice(0, 10)}…`);
const { remaining, resetsAt } = await agent.remaining();
check(remaining > 3.9 && remaining < 4, `remaining() = ${remaining} (4 minus a tiny unsponsored fee), resets ${resetsAt?.toISOString()}`);
check((await agent.canSpend('3')) && !(await agent.canSpend('10')), 'canSpend() matches the budget');

// 3. Overspend is refused by Tempo and surfaced as BudgetExceededError.
try {
  await agent.pay({ to: merchant, amount: '50', task: 'big' });
  check(false, 'overspend should fail');
} catch (e) {
  check(e instanceof BudgetExceededError, `overspend -> ${e.name}`);
}

// 4. Paid API call over MPP (HTTP 402), paid from the same budget.
const { Mppx, tempo } = await import('mppx/server');
const seller = privateKeyToAccount(generatePrivateKey()).address;
const mppServer = Mppx.create({ methods: [tempo({ recipient: seller, currency: ALPHA, testnet: true })], secretKey: randomBytes(32).toString('base64') });
const server = createServer(async (req, res) => {
  const request = new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers });
  const result = await mppServer.charge({ amount: '0.05' })(request);
  const response = result.status === 402 ? result.challenge : result.withReceipt(Response.json({ answer: 42 }));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(0);
const url = `http://localhost:${server.address().port}/data`;
try {
  const before = (await agent.remaining()).remaining;
  const paidFetch = await agent.paidFetch({ maxPerCall: '0.10' });
  const r = await paidFetch(url);
  const body = await r.json();
  const after = (await agent.remaining()).remaining;
  check(r.status === 200 && body.answer === 42, `paidFetch() got a paid response (${r.status})`);
  check(before - after >= 0.05 && before - after < 0.06, `MPP charge came out of the budget (${(before - after).toFixed(6)})`);

  const cheapFetch = await agent.paidFetch({ maxPerCall: '0.01' });
  let refused = false;
  try {
    const r2 = await cheapFetch(url);
    refused = r2.status === 402;
  } catch {
    refused = true;
  }
  check(refused, 'maxPerCall refuses a charge above the per-call cap');
} catch (e) {
  check(false, `MPP flow failed: ${(e.shortMessage || e.message).split('\n')[0]}`);
} finally {
  server.close();
}

// 5. Revoked key is surfaced as KeyNotAllowedError.
await admin.accessKey.revokeSync({ account: company, accessKey: key.keyAddress });
try {
  await agent.pay({ to: merchant, amount: '0.10', task: 'after-revoke' });
  check(false, 'payment after revoke should fail');
} catch (e) {
  check(e instanceof KeyNotAllowedError, `after revoke -> ${e.name}`);
}

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures ? 1 : 0;
