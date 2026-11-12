import React, { useState } from 'react';
import { BookOpen, Download, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../store/useWorkspace';
import { spendEvents, memoTransfers, blockTime, tokenSymbol, usd, short, TOKENS } from '../../lib/tempo';
import { AsyncButton, Result, TxLink, AddressLink, downloadCsv } from './ui';

/**
 * One ledger for people and agents, rebuilt from Tempo itself:
 *  - TransferWithMemo events from the company account (agent payments AND payroll, each with its memo)
 *  - AccessKeySpend events (which agent key spent it, and the limit left afterwards)
 */
async function loadChainLedger(ws) {
  const company = ws.company.address;
  const firstBlock = Math.min(...ws.agents.map((a) => a.authBlock).filter(Boolean), Infinity);
  const fromBlock = Number.isFinite(firstBlock) ? BigInt(firstBlock) : undefined;

  const [spends, ...transfersPerToken] = await Promise.all([
    spendEvents({ companyAddress: company, fromBlock }),
    ...TOKENS.map((t) => memoTransfers({ companyAddress: company, token: t.address, fromBlock })),
  ]);
  const transfers = transfersPerToken.flat();
  const keyToAgent = Object.fromEntries(ws.agents.map((a) => [a.keyAddress.toLowerCase(), a]));
  const nameOf = (addr) => ws.contractors.find((c) => c.address.toLowerCase() === addr.toLowerCase())?.name;

  const rows = transfers.map((t) => {
    const spend = spends.find(
      (s) => s.hash === t.hash && s.token.toLowerCase() === t.token.toLowerCase() && Math.abs(s.amount - t.amount) < 1e-9,
    );
    const agent = spend ? keyToAgent[spend.keyAddress.toLowerCase()] : null;
    const team = agent ? ws.teams.find((x) => x.id === agent.teamId)?.name : null;
    return {
      ...t,
      kind: agent ? 'Agent' : 'Payroll',
      who: agent ? agent.name : nameOf(t.to) || short(t.to),
      team: team || (agent ? '—' : 'People'),
      remaining: spend?.remaining,
    };
  });
  // Fees an unsponsored agent key paid show up as spends without a matching transfer.
  const fees = spends
    .filter((s) => !transfers.some((t) => t.hash === s.hash && Math.abs(t.amount - s.amount) < 1e-9))
    .map((s) => ({
      ...s,
      kind: 'Agent fee',
      who: keyToAgent[s.keyAddress.toLowerCase()]?.name ?? short(s.keyAddress),
      team: ws.teams.find((x) => x.id === keyToAgent[s.keyAddress.toLowerCase()]?.teamId)?.name ?? '—',
      memo: '(network fee)',
      to: '',
    }));

  const all = [...rows, ...fees].sort((a, b) => b.blockNumber - a.blockNumber);
  const times = {};
  await Promise.all(
    [...new Set(all.map((r) => r.blockNumber))].slice(0, 200).map(async (b) => {
      times[b] = await blockTime(b);
    }),
  );
  return all.map((r) => ({ ...r, at: times[r.blockNumber] }));
}

export function LedgerPanel() {
  const ws = useWorkspace();
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null);

  const totals = (rows || []).reduce(
    (acc, r) => {
      if (r.kind === 'Payroll') acc.people += r.amount;
      else acc.agents += r.amount;
      acc.byTeam[r.team] = (acc.byTeam[r.team] || 0) + r.amount;
      return acc;
    },
    { people: 0, agents: 0, byTeam: {} },
  );

  const exportCsv = () =>
    downloadCsv(`tempoflow-ledger-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['time_utc', 'type', 'team', 'payee_or_agent', 'to', 'token', 'amount', 'memo', 'agent_limit_left', 'tx_hash'],
      ...rows.map((r) => [
        r.at ? new Date(r.at).toISOString() : '',
        r.kind,
        r.team,
        r.who,
        r.to,
        tokenSymbol(r.token),
        r.amount.toFixed(6),
        r.memo,
        r.remaining ?? '',
        r.hash,
      ]),
    ]);

  return (
    <div className="glass-panel cp-card cp-stack">
      <div className="cp-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="cp-title">
            <BookOpen size={18} /> Ledger: people and agents
          </div>
          <p className="cp-sub">
            Rebuilt from Tempo, not from our database: every memo transfer from your treasury, matched to the agent key
            that spent it. Export it for your accountant.
          </p>
        </div>
        <div className="cp-row">
          <AsyncButton
            className="btn-secondary btn-sm"
            disabled={!ws.company}
            onClick={async () => setRows(await loadChainLedger(ws))}
            onResult={setResult}
          >
            <RefreshCw size={14} /> Load from chain
          </AsyncButton>
          <button className="btn-secondary btn-sm" disabled={!rows?.length} onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>
      {result && !result.ok && <Result result={result} />}

      {rows && (
        <div className="cp-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <div className="cp-stat">
            <div className="cp-stat-label">Paid to people</div>
            <div className="cp-stat-value">{usd(totals.people)}</div>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-label">Spent by agents</div>
            <div className="cp-stat-value">{usd(totals.agents)}</div>
          </div>
          {Object.entries(totals.byTeam).map(([team, amt]) => (
            <div className="cp-stat" key={team}>
              <div className="cp-stat-label">{team}</div>
              <div className="cp-stat-value">{usd(amt)}</div>
            </div>
          ))}
        </div>
      )}

      {rows && rows.length === 0 && <div className="cp-note">No payments on-chain yet for this company account.</div>}
      {rows && rows.length > 0 && (
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Team</th>
                <th>Agent / payee</th>
                <th>To</th>
                <th>Amount</th>
                <th>Memo</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.hash}-${i}`}>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.at ? new Date(r.at).toLocaleString() : '…'}</td>
                  <td>{r.kind}</td>
                  <td>{r.team}</td>
                  <td>{r.who}</td>
                  <td>{r.to ? <AddressLink address={r.to} /> : '—'}</td>
                  <td className="cp-mono">
                    {r.amount.toFixed(r.amount < 0.01 ? 6 : 2)} {tokenSymbol(r.token)}
                  </td>
                  <td className="cp-mono">{r.memo}</td>
                  <td>
                    <TxLink hash={r.hash} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ws.ledger.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Activity log from this browser ({ws.ledger.length})
          </summary>
          <ul style={{ listStyle: 'none', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
            {ws.ledger.slice(0, 50).map((l) => (
              <li key={l.id} className="cp-row">
                <span style={{ color: 'var(--text-dim)' }}>{new Date(l.at).toLocaleTimeString()}</span>
                <span>{l.label}</span>
                {l.hash && <TxLink hash={l.hash} />}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
