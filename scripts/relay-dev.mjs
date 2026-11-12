// Local stand-in for the Vercel /api/relay function, used by `npm run frontend:dev` via the Vite proxy.
// Needs TEMPO_SPONSOR_PRIVATE_KEY in your environment (a testnet-only key; see scripts/new-sponsor-key.mjs).
//   node scripts/relay-dev.mjs              -> http://localhost:8787/api/relay
//   node scripts/relay-dev.mjs --throwaway  -> uses a fresh in-memory testnet key funded by the faucet (never printed)

import { createServer } from 'node:http';
import { createClient, http, publicActions } from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { tempoActions } from 'viem/tempo';

if (process.argv.includes('--throwaway') && !process.env.TEMPO_SPONSOR_PRIVATE_KEY) {
  process.env.TEMPO_SPONSOR_PRIVATE_KEY = generatePrivateKey();
  const { address } = privateKeyToAccount(process.env.TEMPO_SPONSOR_PRIVATE_KEY);
  const client = createClient({ chain: tempoModerato, transport: http() }).extend(publicActions).extend(tempoActions());
  await client.faucet.fundSync({ account: address });
  console.log('throwaway sponsor funded:', address);
}

const { handle } = await import('../api/_relay.mjs');
const PORT = Number(process.env.RELAY_PORT || 8787);

createServer(async (req, res) => {
  if (req.url !== '/api/relay') {
    res.writeHead(404).end();
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: { 'content-type': 'application/json' },
    body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
  });
  const response =
    req.method === 'POST'
      ? await handle(request)
      : Response.json({ ok: true, sponsored: Boolean(process.env.TEMPO_SPONSOR_PRIVATE_KEY) });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`relay listening on http://localhost:${PORT}/api/relay`));
