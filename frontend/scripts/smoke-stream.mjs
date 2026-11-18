// End-to-end test of streaming payroll (issue #14) on Tempo testnet with the deployed TempoPayrollStream.
// Throwaway accounts and faucet funds only.
// Run: node scripts/smoke-stream.mjs   (from frontend/)
import { Abis } from 'viem/tempo';
import { decodeEventLog } from 'viem';
globalThis.__viem = { decodeEventLog };
import * as T from '../src/lib/tempo.js';

let failures = 0;
const check = (ok, label) => {
  console.log(ok ? 'ok  ' : 'FAIL', label);
  if (!ok) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const bal = async (who) => Number((await T.client.token.getBalance({ account: who, token: T.DEFAULT_TOKEN })).formatted);

const company = T.createTestKeyCompany();
const contractor = T.createTestKeyCompany(); // stands in for the contractor's wallet
await Promise.all([T.fundFromFaucet(company.address), T.fundFromFaucet(contractor.address)]);

// 1 hour, $36 -> $0.01 per second.
const label = `S-${new Date().toISOString().slice(0, 10)}-priya-${Math.random().toString(36).slice(2, 6)}`;
const { id, hash } = await T.createStream({ company, employee: contractor.address, token: T.DEFAULT_TOKEN, amount: '36', durationSeconds: 3600, label });
check(/^0x[0-9a-f]{64}$/.test(hash), `stream funded in one transaction (approve + create): ${hash.slice(0, 10)}…`);

let info = await T.streamInfo(id);
check(info.active && info.employee.toLowerCase() === contractor.address.toLowerCase() && Math.abs(info.perSecond - 0.01) < 1e-9, 'stream active at $0.01/second');

await wait(8000);
info = await T.streamInfo(id);
check(info.claimable > 0.03 && info.claimable < 1, `pay accrues by the second: $${info.claimable} claimable after ~8s`);

const before = await bal(contractor.address);
const wtx = await T.withdrawStream({ account: T.companyAccount(contractor), id });
const after = await bal(contractor.address);
check(after - before > 0.03, `contractor withdrew $${(after - before).toFixed(6)} (net of their fee)`);

const receipt = await T.client.getTransactionReceipt({ hash: wtx });
const memoLogs = receipt.logs
  .filter((l) => l.address.toLowerCase() === T.DEFAULT_TOKEN.toLowerCase())
  .map((l) => {
    try {
      return T.client.chain && l.topics.length ? decodeTransferWithMemo(l) : null;
    } catch {
      return null;
    }
  })
  .filter(Boolean);
check(memoLogs.some((m) => T.decodeMemo(m.memo) === label), `withdrawal memo on-chain is the stream label "${label}"`);

const companyBefore = await bal(company.address);
await T.cancelStream({ company, id });
info = await T.streamInfo(id);
const refund = (await bal(company.address)) - companyBefore;
check(!info.active && info.remaining === 0, 'cancelled: stream closed with nothing left inside');
check(refund > 34 && refund < 36, `company got the unearned part back: $${refund.toFixed(2)}`);

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exitCode = failures ? 1 : 0;

function decodeTransferWithMemo(log) {
  const { decodeEventLog } = globalThis.__viem;
  const ev = decodeEventLog({ abi: Abis.tip20, data: log.data, topics: log.topics });
  return ev.eventName === 'TransferWithMemo' ? ev.args : null;
}
