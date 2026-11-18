// Tests contractor self-onboarding (issue #12) against the local API.
// Needs: node scripts/api-dev.mjs running and a database in frontend/.env.local.
// Run: node scripts/test-api-invites.mjs
import '../db/env.mjs';
import postgres from 'postgres';
import * as T from '../src/lib/tempo.js';
import { joinMessage } from '../api/join.mjs';

const base = 'http://localhost:8787';
let failures = 0;
const check = (ok, label) => {
  console.log(ok ? 'ok  ' : 'FAIL', label);
  if (!ok) failures++;
};
const api = async (path, { cookie, method = 'GET', body } = {}) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
};
async function signIn(company) {
  const { nonce, message } = (await api(`/api/session?address=${company.address}`)).body;
  const signature = await T.companyAccount(company).signMessage({ message });
  return ((await api('/api/session', { method: 'POST', body: { address: company.address, nonce, signature } })).headers.get('set-cookie') || '').split(';')[0];
}

const company = T.createTestKeyCompany();
const cookie = await signIn(company);

// 1. Admin creates invites.
check((await api('/api/invites', { cookie, method: 'POST', body: { name: '' } })).status === 400, 'invite without a name refused');
const made = await api('/api/invites', { cookie, method: 'POST', body: { name: 'Priya', amount: 1500 } });
const code = made.body?.code;
check(made.status === 200 && /^[0-9a-f-]{36}\.[\w-]{20,}$/.test(code), 'invite created with a one-time link code');
check((await api('/api/invites', { method: 'POST', body: { name: 'x' } })).status === 401, 'creating invites needs a session');

// 2. Contractor opens the link.
const view = await api(`/api/join?code=${code}`);
check(view.status === 200 && view.body.name === 'Priya' && Number(view.body.amount) === 1500, 'contractor sees their invite');
check((await api(`/api/join?code=${code.split('.')[0]}.wrongsecretwrongsecretxx`)).status === 404, 'wrong link secret is refused');

// 3. Contractor submits a wallet.
const contractor = T.createTestKeyCompany(); // stands in for a wallet the contractor controls
check((await api('/api/join', { method: 'POST', body: { code, wallet: contractor.address } })).status === 400, 'typed address must be confirmed (or proven)');
const badProof = await T.companyAccount(T.createTestKeyCompany()).signMessage({ message: joinMessage(code.split('.')[0], contractor.address) });
check((await api('/api/join', { method: 'POST', body: { code, wallet: contractor.address, proof: badProof } })).status === 400, "someone else's signature doesn't prove the wallet");
const proof = await T.companyAccount(contractor).signMessage({ message: joinMessage(code.split('.')[0], contractor.address) });
const joined = await api('/api/join', { method: 'POST', body: { code, wallet: contractor.address, proof } });
check(joined.status === 200 && joined.body.verified === true, 'wallet submitted with a signature proving it is theirs');

// 4. Admin reviews and approves.
let invites = (await api('/api/invites', { cookie })).body.invites;
const inv = invites.find((i) => i.name === 'Priya');
check(inv?.status === 'submitted' && inv.wallet === contractor.address.toLowerCase(), 'admin sees the submitted wallet');
const outsider = await signIn(T.createTestKeyCompany());
check((await api('/api/invites', { cookie: outsider, method: 'PATCH', body: { id: inv.id, status: 'approved' } })).status === 400, "another company can't approve it");
const ok = await api('/api/invites', { cookie, method: 'PATCH', body: { id: inv.id, status: 'approved' } });
check(ok.status === 200 && ok.body.contractor?.wallet === contractor.address.toLowerCase(), 'approved: contractor returned for the People list');
check((await api('/api/invites', { cookie, method: 'PATCH', body: { id: inv.id, status: 'approved' } })).status === 400, 'cannot approve twice');
check((await api('/api/join', { method: 'POST', body: { code, wallet: contractor.address, confirmTyped: true } })).status === 400, 'approved invite cannot be changed by the link');

// 5. Cancel and expiry.
const second = (await api('/api/invites', { cookie, method: 'POST', body: { name: 'Leo' } })).body;
await api('/api/invites', { cookie, method: 'PATCH', body: { id: second.invite.id, status: 'cancelled' } });
check((await api(`/api/join?code=${second.code}`)).status === 404, 'cancelled invite link stops working');
const third = (await api('/api/invites', { cookie, method: 'POST', body: { name: 'Mia' } })).body;
const sql = postgres(process.env.POSTGRES_URL, { prepare: false, ssl: 'require', max: 1 });
await sql`update contractor_invites set expires_at = now() - interval '1 minute' where id = ${third.invite.id}`;
await sql.end();
check((await api(`/api/join?code=${third.code}`)).status === 404, 'expired invite link stops working');
check((await api('/api/invites', { cookie: outsider })).body.invites.length === 0, 'another company sees none of these invites');

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures ? 1 : 0;
