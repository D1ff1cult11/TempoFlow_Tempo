// Turns raw Tempo events into ledger rows. Pure function, used by the browser (chain view) and the server (indexer).
//
//  spends:    AccessKeySpend events  { hash, logIndex, blockNumber, keyAddress, token, amount, remaining }
//  transfers: TransferWithMemo events from the company { hash, logIndex, blockNumber, to, token, amount, memo }
//
// A transfer with a matching spend (same tx, token and amount) was made by an agent key; otherwise the company paid it
// (payroll). A spend with no matching transfer is a network fee the agent key paid itself (not sponsored).

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const equalAmount = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-9;

export function matchEvents({ spends, transfers }) {
  const used = new Set();
  const rows = transfers.map((t) => {
    const spend = spends.find(
      (s, i) => !used.has(i) && s.hash === t.hash && same(s.token, t.token) && equalAmount(s.amount, t.amount) && used.add(i),
    );
    return {
      kind: spend ? 'agent' : 'payroll',
      hash: t.hash,
      logIndex: t.logIndex,
      blockNumber: t.blockNumber,
      keyAddress: spend ? spend.keyAddress.toLowerCase() : null,
      payee: t.to.toLowerCase(),
      token: t.token.toLowerCase(),
      amount: Number(t.amount),
      memo: t.memo,
      remaining: spend ? Number(spend.remaining) : null,
    };
  });
  spends.forEach((s, i) => {
    if (used.has(i)) return;
    rows.push({
      kind: 'agent_fee',
      hash: s.hash,
      logIndex: s.logIndex,
      blockNumber: s.blockNumber,
      keyAddress: s.keyAddress.toLowerCase(),
      payee: '',
      token: s.token.toLowerCase(),
      amount: Number(s.amount),
      memo: '(network fee)',
      remaining: Number(s.remaining),
    });
  });
  return rows.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
}

export const KIND_LABEL = { agent: 'Agent', payroll: 'Payroll', agent_fee: 'Agent fee' };
