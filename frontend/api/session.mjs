// /api/session
//   GET  ?address=0x…  -> { message, nonce }   message the company must sign
//   POST { address, nonce, signature } -> sets the session cookie
//   GET               -> { address } of the signed-in company, or 401
//   DELETE            -> signs out
import { json, handler, badRequest } from './_db.mjs';
import { newNonce, signInMessage, signIn, sessionCompany, signOutCookie } from './_auth.mjs';

export const GET = handler(async (request) => {
  const address = new URL(request.url).searchParams.get('address');
  if (address) {
    const nonce = newNonce(address);
    return json({ nonce, message: signInMessage(address, nonce) });
  }
  const company = sessionCompany(request);
  return company ? json({ address: company }) : json({ error: 'Not signed in' }, 401);
});

export const POST = handler(async (request) => {
  const body = await request.json().catch(() => null);
  if (!body?.address || !body?.nonce || !body?.signature) throw badRequest('address, nonce and signature are required');
  const cookie = await signIn(body);
  return json({ address: body.address.toLowerCase() }, 200, { 'set-cookie': cookie });
});

export const DELETE = handler(async () => json({ ok: true }, 200, { 'set-cookie': signOutCookie() }));
