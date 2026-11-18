// Tests scheduled pay runs, reminder model (issue #13), against the local API and Tempo testnet.
// Needs: node scripts/api-dev.mjs --allow-local-webhooks
// Run: node scripts/test-api-schedules.mjs
import { createServer } from 'node:http';
import * as T from '../src/lib/tempo.js';
import { nextDate } from '../api/schedules.mjs';

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
const received = [];
const hook = createServer(async (req, res) => {
  let s = '';
  for await (const c of req) s += c;
  received.push(JSON.parse(s));
  res.writeHead(200).end('ok');
}).listen(0);

try {
  const today = new Date().toISOString().slice(0, 10);
  const company = T.createTestKeyCompany();
  await T.fundFromFaucet(company.address);
  const cookie = await signIn(company);
  await api('/api/alerts', { cookie, method: 'POST', body: { kind: 'limit_hit', webhookUrl: `http://localhost:${hook.address().port}/h` } });

  check((await api('/api/schedules', { cookie, method: 'POST', body: { cadence: 'daily', firstRun: today, token: T.DEFAULT_TOKEN } })).status === 400, 'unknown cadence refused');
  const made = await api('/api/schedules', { cookie, method: 'POST', body: { cadence: 'weekly', firstRun: today, token: T.DEFAULT_TOKEN } });
  check(made.status === 200 && made.body.schedule.next_run === today, 'weekly schedule created, first run today');
  const id = made.body.schedule.id;

  let view = (await api('/api/schedules', { cookie })).body;
  check(view.due.length === 1 && view.due[0].period === today, 'the run is due today');

  const r1 = (await api('/api/schedules', { cookie, method: 'POST', body: { action: 'remind' } })).body.reminded;
  check(r1.length === 1 && received.some((m) => /weekly pay run for .* is due/.test(m.text)), 'reminder sent to the company webhook');
  const r2 = (await api('/api/schedules', { cookie, method: 'POST', body: { action: 'remind' } })).body.reminded;
  check(r2.length === 0, 'reminder is sent only once per period');

  // Paying needs a real successful transaction from the company.
  const someoneElse = T.createTestKeyCompany();
  const foreign = (await T.fundFromFaucet(someoneElse.address))[0]?.transactionHash;
  if (foreign) check((await api('/api/schedules', { cookie, method: 'PATCH', body: { scheduleId: id, period: today, tx: foreign } })).status === 400, "someone else's transaction is not accepted as proof");

  const tx = await T.payRun({
    company,
    token: T.DEFAULT_TOKEN,
    lines: [
      { address: T.createTestKeyCompany().address, amount: '3', memo: `INV-${today}-001` },
      { address: T.createTestKeyCompany().address, amount: '4', memo: `INV-${today}-002` },
    ],
  });
  const paid = await api('/api/schedules', { cookie, method: 'PATCH', body: { scheduleId: id, period: today, tx, total: 7 } });
  check(paid.status === 200 && paid.body.nextRun === nextDate(today, 'weekly'), `paid; next run moves to ${paid.body?.nextRun}`);
  check((await api('/api/schedules', { cookie, method: 'PATCH', body: { scheduleId: id, period: today, tx } })).status === 400, 'the same period cannot be paid twice');
  view = (await api('/api/schedules', { cookie })).body;
  check(view.due.length === 0 && view.runs[0].status === 'paid' && view.runs[0].tx_hash === tx, 'nothing due; run recorded with its transaction');

  // An overdue monthly schedule skips missed months when paid.
  const old = await api('/api/schedules', { cookie, method: 'POST', body: { cadence: 'monthly', firstRun: '2026-01-15', token: T.DEFAULT_TOKEN } });
  const p2 = await api('/api/schedules', { cookie, method: 'PATCH', body: { scheduleId: old.body.schedule.id, period: '2026-01-15', tx } });
  check(p2.body?.nextRun > today && p2.body.nextRun.endsWith('-15'), `overdue monthly schedule jumps to the next future date (${p2.body?.nextRun})`);

  const outsider = await signIn(T.createTestKeyCompany());
  check((await api('/api/schedules', { cookie: outsider })).body.schedules.length === 0, 'another company sees none of these schedules');
  await api(`/api/schedules?id=${id}`, { cookie: outsider, method: 'DELETE' });
  check((await api('/api/schedules', { cookie })).body.schedules.length === 2, "another company can't delete them");
  await api(`/api/schedules?id=${id}`, { cookie, method: 'DELETE' });
  check((await api('/api/schedules', { cookie })).body.schedules.length === 1, 'owner can delete a schedule');
} finally {
  hook.close();
}
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures ? 1 : 0;
