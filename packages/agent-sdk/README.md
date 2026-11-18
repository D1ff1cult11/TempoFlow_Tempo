# @tempoflow/agent

The code an AI agent runs to spend its **TempoFlow budget** on [Tempo](https://tempo.xyz).

The company sets the rules in TempoFlow (daily budget, allowed payees, expiry). **Tempo enforces them on-chain**, so
even buggy or compromised agent code can't overspend. This package makes the agent side easy:

- `pay()` a payee, with a task ID in the on-chain memo (shows up in the TempoFlow ledger)
- `remaining()` / `canSpend()` to check the budget before starting work
- `paidFetch()` to call paid APIs over [MPP](https://mpp.dev) (HTTP 402) from the same budget
- clear errors: `BudgetExceededError`, `KeyNotAllowedError`
- `generateAgentKey()` so the key can be created inside the agent runtime
- `requestLimit()` to ask the company for a higher daily limit (an admin approves it in TempoFlow)

> Status: early, testnet first. Not published to npm yet; use it from this repo.

## Install

```bash
npm install viem@2.57.13
npm install mppx@0.16.0   # only if you use paidFetch()
```

## Use

```js
import { createAgent, BudgetExceededError } from '@tempoflow/agent';

const agent = createAgent({
  name: 'research-bot',
  privateKey: process.env.TEMPOFLOW_AGENT_KEY,     // the agent's key
  companyAddress: process.env.TEMPOFLOW_COMPANY,   // the company account that authorized it
  token: '0x20c0000000000000000000000000000000000001', // AlphaUSD on testnet
  relayUrl: 'https://your-tempoflow-app/api/relay', // optional: TempoFlow sponsors fees
});

await agent.remaining();                     // { remaining: 9.5, resetsAt: Date }
await agent.pay({ to: vendor, amount: '2.50', task: '1042' }); // memo "a:research-bot|t:1042"

const paidFetch = await agent.paidFetch({ maxPerCall: '0.25' });
const res = await paidFetch('https://api.example.com/paid');   // pays the 402 automatically
```

When the budget is too small for a job, ask for more. The request is signed with the agent's own key, and the company
sees it under Agents → Limit requests:

```js
if (!(await agent.canSpend('20'))) {
  await agent.requestLimit({ newLimit: 25, reason: 'nightly crawl needs ~0' }); // uses serverUrl or relayUrl's origin
}
```

`maxPerCall` is an extra guard inside the agent: any single API charge above it is refused before signing. Tempo's
daily limit still applies on top.

For `paidFetch()`, turn on **Allow paid APIs (MPP)** when adding the agent in TempoFlow; MPP charges use a plain
`transfer`, which the key must be allowed to call.

## Keys

Best practice: create the key where the agent runs and only share its address.

```bash
npx tempoflow-agent-keygen   # prints the key address (for TempoFlow) and the private key (for your secret store)
```

Then in TempoFlow → Agents → **Agent's own key**, paste the key address. Or in code:

```js
import { generateAgentKey } from '@tempoflow/agent';
const { privateKey, keyAddress } = generateAgentKey(); // store privateKey in your secret manager
```

Pass `keyAddress` (TempoFlow's *Copy SDK setup* gives it as `TEMPOFLOW_KEY_ADDRESS`) to `createAgent()` and it'll refuse to start if
the private key doesn't match the key TempoFlow authorized.

Never give an agent an admin key or the company's own key.

## Test

```bash
npm test   # end-to-end on Tempo testnet with throwaway keys and faucet funds
```

See `examples/research-agent.mjs` for a full agent.
