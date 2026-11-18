// Example: a research agent that pays a data vendor and a paid API from its TempoFlow budget.
//
// Set these (from TempoFlow → Agents → your agent):
//   TEMPOFLOW_AGENT_KEY     the agent's private key (keep it in your secret store)
//   TEMPOFLOW_COMPANY       the company account address
//   TEMPOFLOW_TOKEN         the budget stablecoin, e.g. 0x20c0000000000000000000000000000000000001 (AlphaUSD on testnet)
//   VENDOR_ADDRESS          an address the agent is allowed to pay
// Optional:
//   TEMPOFLOW_RELAY_URL     e.g. https://your-tempoflow-app/api/relay  (fees are then sponsored)
//   PAID_API_URL            an MPP (HTTP 402) endpoint; needs "Allow paid APIs" on the agent
//
// Run: node examples/research-agent.mjs

import { createAgent, BudgetExceededError, KeyNotAllowedError } from '../src/index.js';

const env = (name, required = true) => {
  const v = process.env[name];
  if (required && !v) throw new Error(`Set ${name}`);
  return v;
};

const agent = createAgent({
  name: 'research-bot',
  privateKey: env('TEMPOFLOW_AGENT_KEY'),
  companyAddress: env('TEMPOFLOW_COMPANY'),
  token: env('TEMPOFLOW_TOKEN'),
  relayUrl: env('TEMPOFLOW_RELAY_URL', false),
});

const price = '0.50';
const { remaining, resetsAt } = await agent.remaining();
console.log(`Budget left today: $${remaining.toFixed(2)} (resets ${resetsAt?.toLocaleString() ?? 'never'})`);

if (!(await agent.canSpend(price))) {
  console.log('Not enough budget for this task; ask a TempoFlow admin to raise the limit.');
  process.exit(0);
}

try {
  const tx = await agent.pay({ to: env('VENDOR_ADDRESS'), amount: price, task: 'report-17' });
  console.log(`Paid the data vendor $${price}: ${agent.network === 'testnet' ? 'https://explore.testnet.tempo.xyz' : 'https://explore.tempo.xyz'}/tx/${tx}`);

  const apiUrl = env('PAID_API_URL', false);
  if (apiUrl) {
    const paidFetch = await agent.paidFetch({ maxPerCall: '0.25' });
    const res = await paidFetch(apiUrl);
    console.log(`Paid API answered ${res.status}:`, (await res.text()).slice(0, 200));
  }
} catch (e) {
  if (e instanceof BudgetExceededError || e instanceof KeyNotAllowedError) {
    console.error(e.message); // stop the task and tell a human
    process.exit(1);
  }
  throw e;
}
