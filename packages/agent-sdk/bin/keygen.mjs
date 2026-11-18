#!/usr/bin/env node
// Create a TempoFlow agent key where the agent runs.
//   npx tempoflow-agent-keygen
// Prints the key address (paste it into TempoFlow → Agents → "Agent's own key") and the private key
// (store it in the agent's secret manager as TEMPOFLOW_AGENT_KEY; never paste it into TempoFlow).

import { generateAgentKey } from '../src/index.js';

const { privateKey, keyAddress } = generateAgentKey();
console.log('Key address (share with TempoFlow):');
console.log(`  ${keyAddress}`);
console.log('');
console.log('Private key (keep secret: put it in your agent\'s secret store as TEMPOFLOW_AGENT_KEY):');
console.log(`  ${privateKey}`);
