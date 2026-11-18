// End-to-end test of agent key hand-off (issue #5) on Tempo testnet, using the app's own code.
//   Agent runtime:  generateAgentKey()  -> shares only the key address
//   TempoFlow app:  authorizeAgent() with that address (no private key anywhere in the app)
//   Agent runtime:  createAgent({ keyAddress }) checks the key, then pays from its budget
// Run: node scripts/smoke-key-handoff.mjs   (from frontend/)

import * as T from '../src/lib/tempo.js';
import { generateAgentKey, createAgent } from '../../packages/agent-sdk/src/index.js';

const ALPHA = T.DEFAULT_TOKEN;
let failures = 0;
const check = (ok, label) => {
  console.log(ok ? 'ok  ' : 'FAIL', label);
  if (!ok) failures++;
};

const company = T.createTestKeyCompany();
await T.fundFromFaucet(company.address);

// Agent side: make a key and share only the address.
const { privateKey, keyAddress } = generateAgentKey();

// App side: the agent record has no private key, exactly as the panel stores it.
const agentRecord = { keyAddress, keySource: 'runtime', token: ALPHA, dailyLimit: 5, expiryDays: 1, recipients: [] };
check(!('privateKey' in agentRecord), 'app-side agent record holds no private key');
const { hash } = await T.authorizeAgent({ company, agent: agentRecord });
check(/^0x[0-9a-f]{64}$/.test(hash), `app authorized the agent's own key (${hash.slice(0, 10)}…)`);

// Agent side: wrong key address is caught before any payment.
let mismatch = false;
try {
  createAgent({ privateKey, companyAddress: company.address, token: ALPHA, keyAddress: generateAgentKey().keyAddress });
} catch {
  mismatch = true;
}
check(mismatch, 'createAgent() refuses a key that does not match TEMPOFLOW_KEY_ADDRESS');

const agent = createAgent({ privateKey, companyAddress: company.address, token: ALPHA, keyAddress, name: 'own-key-bot' });
const payee = T.createTestKeyCompany().address;
const tx = await agent.pay({ to: payee, amount: '1.00', task: 'handoff' });
check(/^0x[0-9a-f]{64}$/.test(tx), `agent paid with its own key (${tx.slice(0, 10)}…)`);

const fromApp = await T.remainingLimit({ companyAddress: company.address, agent: agentRecord });
check(fromApp.remaining < 4.01 && fromApp.remaining > 3.9, `the app sees the agent's spend: ${fromApp.remaining} left`);

await T.revokeAgent({ company, agent: agentRecord });
check((await T.remainingLimit({ companyAddress: company.address, agent: agentRecord })).remaining === 0, 'revoked from the app: budget reads 0');

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures ? 1 : 0;
