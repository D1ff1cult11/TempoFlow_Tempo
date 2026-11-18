// Local stand-in for TempoFlow's Vercel functions (frontend/api/*.mjs), used by `npm run frontend:dev` via the Vite proxy.
// Reads frontend/.env.local (database, sponsor key, …) without printing anything.
//   node scripts/api-dev.mjs              -> http://localhost:8787/api/<name>
//   node scripts/api-dev.mjs --throwaway  -> fee relay uses a fresh in-memory testnet key funded by the faucet (never printed)
//   node scripts/api-dev.mjs --allow-local-webhooks  -> lets alert rules post to http://localhost (tests only)

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient, http, publicActions } from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { tempoActions } from 'viem/tempo';

await import('../frontend/db/env.mjs');
if (process.argv.includes('--allow-local-webhooks')) process.env.TEMPOFLOW_ALLOW_LOCAL_WEBHOOKS = '1'; // tests only

if (process.argv.includes('--throwaway')) {
  process.env.TEMPO_SPONSOR_PRIVATE_KEY = generatePrivateKey();
  const { address } = privateKeyToAccount(process.env.TEMPO_SPONSOR_PRIVATE_KEY);
  const client = createClient({ chain: tempoModerato, transport: http() }).extend(publicActions).extend(tempoActions());
  await client.faucet.fundSync({ account: address });
  console.log('throwaway sponsor funded:', address);
}

const PORT = Number(process.env.API_PORT || process.env.RELAY_PORT || 8787);
const apiDir = fileURLToPath(new URL('../frontend/api/', import.meta.url));

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const name = url.pathname.match(/^\/api\/([a-z0-9-]+)$/)?.[1];
  const file = name && `${apiDir}${name}.mjs`;
  if (!file || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  const mod = await import(pathToFileURL(file).href);
  const fn = mod[req.method];
  if (!fn) {
    res.writeHead(405).end();
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const request = new Request(url, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await fn(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`api listening on http://localhost:${PORT}/api/*`));
