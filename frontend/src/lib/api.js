// Browser side of TempoFlow's server API (/api/*). The company signs in once by signing a message with its
// passkey or key; the server keeps an HttpOnly session cookie. Everything here is optional: without a database the
// app keeps working from the chain alone.

import { useSyncExternalStore } from 'react';
import { companyAccount } from './tempo';

let state = { checked: false, available: false, address: null };
const listeners = new Set();
const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useServer() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

async function call(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.error || `Server error (${r.status})`), { status: r.status });
  return data;
}

/** Finds out whether this deployment has the server features, and who is signed in. */
export async function checkServer() {
  try {
    const r = await fetch('/api/session', { credentials: 'same-origin' });
    const data = await r.json().catch(() => null);
    if (r.status === 200 && data?.address) return set({ checked: true, available: true, address: data.address });
    if (r.status === 401 && data) return set({ checked: true, available: true, address: null });
  } catch {
    /* no API on this host */
  }
  set({ checked: true, available: false, address: null });
}

/** Signs a one-time message with the company account (passkey prompt or test key) and starts a session. */
export async function signIn(company) {
  const { nonce, message } = await call(`/api/session?address=${company.address}`);
  const signature = await companyAccount(company).signMessage({ message });
  const { address } = await call('/api/session', { method: 'POST', body: { address: company.address, nonce, signature } });
  set({ available: true, address });
  return address;
}

export async function signOut() {
  await call('/api/session', { method: 'DELETE' });
  set({ address: null });
}

/** True when the signed-in session belongs to this company account. */
export const signedInAs = (server, company) =>
  Boolean(server.address && company && server.address === company.address.toLowerCase());

/** Sends names and teams (labels only) so the server ledger can show them. */
export function saveDirectory(ws) {
  const teamName = (id) => ws.teams.find((t) => t.id === id)?.name;
  return call('/api/directory', {
    method: 'POST',
    body: {
      agents: ws.agents.map((a) => ({
        keyAddress: a.keyAddress,
        name: a.name,
        team: teamName(a.teamId),
        token: a.token,
        dailyLimit: a.dailyLimit,
        status: a.status,
        authBlock: a.authBlock,
      })),
      contractors: ws.contractors.map((c) => ({ wallet: c.address, name: c.name, role: c.role, amount: c.amount })),
    },
  });
}

/** Indexes new chain events into the database, calling the server until it has caught up. */
export async function syncLedger(fromBlock, onProgress) {
  let added = 0;
  for (let i = 0; i < 25; i++) {
    const r = await call('/api/ledger', { method: 'POST', body: fromBlock != null ? { fromBlock } : {} });
    added += r.added;
    onProgress?.(r);
    if (r.caughtUp) return { added, lastBlock: r.lastBlock };
  }
  return { added, partial: true };
}

export function fetchLedger(filters = {}) {
  const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
  return call(`/api/ledger?${q}`);
}
