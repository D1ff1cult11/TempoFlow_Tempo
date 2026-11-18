// Sign-in for TempoFlow's server: the company proves it controls its Tempo account by signing a one-time message
// (passkey or key). The signature is checked by Tempo's SignatureVerifier precompile, so passkeys work too.
// Sessions are a signed, HttpOnly cookie. No passwords or keys are stored.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient, http, hashMessage, publicActions } from 'viem';
import { tempoModerato } from 'viem/chains';
import { Abis, Addresses } from 'viem/tempo';
import { isAddress } from './_db.mjs';

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_S = 7 * 24 * 3600;
const COOKIE = 'tf_session';

export const chainClient = createClient({ chain: tempoModerato, transport: http(process.env.TEMPO_RPC_URL || undefined) }).extend(
  publicActions,
);

function secret() {
  const s = process.env.TEMPOFLOW_SESSION_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!s || s.length < 32) throw Object.assign(new Error('Sign-in is not configured on this deployment.'), { status: 503 });
  return s;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const mac = (data) => createHmac('sha256', secret()).update(data).digest('base64url');
const sameMac = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** The exact text the company signs. Bound to the address, the chain and a short-lived server nonce. */
export function signInMessage(address, nonce) {
  return `TempoFlow sign-in\n\nAccount: ${address.toLowerCase()}\nChain: ${tempoModerato.id}\nNonce: ${nonce}`;
}

export function newNonce(address) {
  const ts = Date.now().toString(36);
  return `${ts}.${mac(`nonce|${address.toLowerCase()}|${ts}`)}`;
}

function checkNonce(address, nonce) {
  const [ts, sig] = String(nonce).split('.');
  if (!ts || !sig || !sameMac(sig, mac(`nonce|${address.toLowerCase()}|${ts}`))) return false;
  return Date.now() - parseInt(ts, 36) < NONCE_TTL_MS;
}

/** True if `signature` over `message` was made by the account's root key (secp256k1, P256 or passkey). */
export async function verifyAccountSignature(address, message, signature) {
  try {
    return await chainClient.readContract({
      address: Addresses.signatureVerifier,
      abi: Abis.signatureVerifier,
      functionName: 'verify',
      args: [address, hashMessage(message), signature],
    });
  } catch {
    return false;
  }
}

/** True if `signature` was made by one of the account's authorized access keys (agents). */
export async function verifyAgentSignature(companyAddress, message, signature) {
  try {
    return await chainClient.readContract({
      address: Addresses.signatureVerifier,
      abi: Abis.signatureVerifier,
      functionName: 'verifyKeychain',
      args: [companyAddress, hashMessage(message), signature],
    });
  } catch {
    return false;
  }
}

export async function signIn({ address, nonce, signature }) {
  if (!isAddress(address) || !checkNonce(address, nonce)) throw Object.assign(new Error('Sign-in expired. Try again.'), { status: 401 });
  const ok = await verifyAccountSignature(address, signInMessage(address, nonce), signature);
  if (!ok) throw Object.assign(new Error('Signature does not match this account.'), { status: 401 });
  const payload = b64url(JSON.stringify({ a: address.toLowerCase(), e: Math.floor(Date.now() / 1000) + SESSION_TTL_S }));
  return `${COOKIE}=${payload}.${mac(`session|${payload}`)}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_S}`;
}

export const signOutCookie = () => `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/** The signed-in company address, or null. */
export function sessionCompany(request) {
  const raw = (request.headers.get('cookie') || '')
    .split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig || !sameMac(sig, mac(`session|${payload}`))) return null;
  try {
    const { a, e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return e > Date.now() / 1000 && isAddress(a) ? a : null;
  } catch {
    return null;
  }
}

export function requireCompany(request) {
  const company = sessionCompany(request);
  if (!company) throw Object.assign(new Error('Sign in to TempoFlow first.'), { status: 401 });
  return company;
}
