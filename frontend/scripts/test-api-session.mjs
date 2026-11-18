// Tests sign-in against the local API (node scripts/api-dev.mjs must be running) or another base URL.
// Run: node scripts/test-api-session.mjs [http://localhost:8787]
import * as T from '../src/lib/tempo.js';

const base = process.argv[2] || 'http://localhost:8787';
let failures = 0;
const check = (ok, label) => {
  console.log(ok ? 'ok  ' : 'FAIL', label);
  if (!ok) failures++;
};

async function signInAs(company, signer = T.companyAccount(company)) {
  const { nonce, message } = await (await fetch(`${base}/api/session?address=${company.address}`)).json();
  const signature = await signer.signMessage({ message });
  const r = await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: company.address, nonce, signature }),
  });
  return { r, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

const company = T.createTestKeyCompany();
const { r, cookie } = await signInAs(company);
check(r.status === 200 && cookie.startsWith('tf_session='), `sign-in with the company key -> ${r.status}`);

const me = await fetch(`${base}/api/session`, { headers: { cookie } });
const body = await me.json();
check(me.status === 200 && body.address === company.address.toLowerCase(), 'session cookie identifies the company');

const intruder = T.companyAccount(T.createTestKeyCompany());
const forged = await signInAs(company, intruder);
check(forged.r.status === 401, `someone else's signature is refused -> ${forged.r.status}`);

const tampered = cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
check((await fetch(`${base}/api/session`, { headers: { cookie: tampered } })).status === 401, 'tampered cookie is refused');

const out = await fetch(`${base}/api/session`, { method: 'DELETE', headers: { cookie } });
check(/Max-Age=0/.test(out.headers.get('set-cookie') || ''), 'sign-out clears the cookie');

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures ? 1 : 0;
