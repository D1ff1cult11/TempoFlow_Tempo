// Vercel serverless function: POST /api/relay (JSON-RPC fee-payer relay for Tempo testnet).
import { handle } from './_relay.mjs';

export async function POST(request) {
  return handle(request);
}

export function GET() {
  return Response.json({ ok: true, sponsored: Boolean(process.env.TEMPO_SPONSOR_PRIVATE_KEY), chainId: 42431 });
}
