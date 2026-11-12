// Creates a NEW testnet-only sponsor key, funds it from the Tempo testnet faucet, and prints it ONCE.
// Copy the printed key into Vercel → Project → Settings → Environment Variables as TEMPO_SPONSOR_PRIVATE_KEY.
// Never use this key on mainnet and never commit it.
//   node scripts/new-sponsor-key.mjs

import { createClient, http, publicActions } from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { tempoActions } from 'viem/tempo';

const privateKey = generatePrivateKey();
const { address } = privateKeyToAccount(privateKey);
const client = createClient({ chain: tempoModerato, transport: http() }).extend(publicActions).extend(tempoActions());
await client.faucet.fundSync({ account: address });

console.log('Sponsor address (public):', address);
console.log('TEMPO_SPONSOR_PRIVATE_KEY (secret, testnet only):', privateKey);
