// Shared fee-payer relay for TempoFlow (Tempo testnet).
// The sponsor key comes ONLY from the environment (TEMPO_SPONSOR_PRIVATE_KEY) and never reaches the browser.

import { createClient, http } from 'viem';
import { tempoModerato } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Relay } from 'viem/tempo';

const TIP20_PREFIX = '0x20c0';
const ALLOWED_CHAIN = tempoModerato.id;
const MAX_CALLS = 50;

/** Sponsor only what TempoFlow itself sends: testnet, TIP-20 token calls, bounded batch size. */
export function validate(request) {
  const chainId = request.chainId == null ? ALLOWED_CHAIN : Number(request.chainId);
  if (chainId !== ALLOWED_CHAIN) return false;
  const calls = request.calls ?? (request.to ? [{ to: request.to }] : []);
  if (calls.length === 0 || calls.length > MAX_CALLS) return false;
  return calls.every((c) => typeof c.to === 'string' && c.to.toLowerCase().startsWith(TIP20_PREFIX));
}

let cached;
export function getRelay() {
  if (cached) return cached;
  const key = process.env.TEMPO_SPONSOR_PRIVATE_KEY;
  if (!key) return null;
  cached = Relay.create({
    client: createClient({ chain: tempoModerato, transport: http(process.env.TEMPO_RPC_URL || undefined) }),
    plugins: [Relay.feePayer({ account: privateKeyToAccount(key), name: 'TempoFlow testnet sponsor', validate })],
  });
  return cached;
}

export async function handle(request) {
  const relay = getRelay();
  if (!relay) {
    return Response.json({ error: 'Fee sponsorship is not configured on this deployment.' }, { status: 503 });
  }
  return relay.fetch(request);
}
