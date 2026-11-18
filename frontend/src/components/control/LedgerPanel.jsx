import React, { useEffect, useState } from 'react';
import { BookOpen, Download, RefreshCw, LogIn, Database, Filter } from 'lucide-react';
import { useWorkspace } from '../../store/useWorkspace';
import { spendEvents, memoTransfers, blockTime, tokenSymbol, usd, short, TOKENS } from '../../lib/tempo';
import { AsyncButton, Result, TxLink, AddressLink, Field, downloadCsv } from './ui';
import { EXPORTS, DATE_FORMATS } from '../../lib/exports';
import { matchEvents, KIND_LABEL } from '../../lib/ledger-core';
import { useServer, checkServer, signIn, signedInAs, saveDirectory, syncLedger, fetchLedger } from '../../lib/api';

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
  const matched = matchEvents({ spends, transfers: transfersPerToken.flat() });
  const keyToAgent = Object.fromEntries(ws.agents.map((a) => [a.keyAddress.toLowerCase(), a]));
  const nameOf = (addr) => ws.contractors.find((c) => c.address.toLowerCase() === addr)?.name;

  const times = {};
  await Promise.all(
    [...new Set(matched.map((r) => r.blockNumber))].slice(0, 200).map(async (b) => {
      times[b] = await blockTime(b);
    }),
  );
  return matched.map((r) => {
    const agent = r.keyAddress ? keyToAgent[r.keyAddress] : null;
    const team = agent ? ws.teams.find((x) => x.id === agent.teamId)?.name : null;
    return {
      ...r,
      kind: KIND_LABEL[r.kind],
      who: agent ? agent.name : r.keyAddress ? short(r.keyAddress) : nameOf(r.payee) || short(r.payee),
      team: team || (r.kind === 'payroll' ? 'People' : '—'),
      to: r.payee,
      at: times[r.blockNumber],
    };
  });
}

/** A database row from /api/ledger in the same shape as the chain rows above. */
const fromServerRow = (r) => ({
  hash: r.tx_hash,
  blockNumber: Number(r.block_number),
  at: r.at ? new Date(r.at).getTime() : null,
  kind: KIND_LABEL[r.kind] || r.kind,
  team: r.agent_team || (r.kind === 'payroll' ? 'People' : '—'),
  who: r.agent_name || r.payee_name || short(r.key_address || r.payee),
  to: r.payee,
  token: r.token,
  amount: Number(r.amount),
  memo: r.memo,
  remaining: r.remaining == null ? null : Number(r.remaining),
});

const EMPTY_FILTERS = { kind: '', agent: '', team: '', from: '', to: '' };

/** Sign-in, sync and filters for the database-backed ledger (shown only when the deployment has a database). */
function ServerLedger({ ws, onRows, onResult }) {
  const server = useServer();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sync, setSync] = useState(null);
  const mine = signedInAs(server, ws.company);
  const up = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const firstBlock = Math.min(...ws.agents.map((a) => a.authBlock).filter(Boolean), Infinity);

  const load = async (f = filters) => {
    const query = { ...f, to: f.to ? new Date(new Date(f.to).getTime() + 86_400_000).toISOString() : '' };
    const data = await fetchLedger(query);
    setSync(data.sync);
    onRows(data.rows.map(fromServerRow));
  };

  if (!server.available || !ws.company) return null;
  if (!mine) {
    return (
      <div className="cp-note">
        <div className="cp-row" style={{ justifyContent: 'space-between' }}>
          <span>
            Keep the full history in TempoFlow's database, with filters by team, agent and date. Sign in once by signing a
            message with your company account (no password, no transaction).
          </span>
          <AsyncButton className="btn-primary btn-sm" onClick={async () => { await signIn(ws.company); return 'Signed in.'; }} onResult={onResult}>
            <LogIn size={14} /> Sign in
          </AsyncButton>
        </div>
      </div>
    );
  }
  return (
    <div className="cp-stack" style={{ gap: 10 }}>
      <div className="cp-row" style={{ justifyContent: 'space-between' }}>
        <span className="cp-sub" style={{ marginTop: 0 }}>
          <Database size={13} style={{ verticalAlign: -2 }} /> Database ledger
          {sync ? ` · synced to block ${Number(sync.last_block).toLocaleString()}` : ' · not synced yet'}
        </span>
        <AsyncButton
          className="btn-primary btn-sm"
          onClick={async () => {
            await saveDirectory(ws);
            const r = await syncLedger(Number.isFinite(firstBlock) ? firstBlock : undefined);
            await load();
            return r.added ? `${r.added} new rows` : undefined;
          }}
          onResult={onResult}
        >
          <RefreshCw size={14} /> Sync from chain
        </AsyncButton>
      </div>
      <div className="cp-form">
        <Field label="Type">
          <select className="cp-select" value={filters.kind} onChange={up('kind')}>
            <option value="">All</option>
            {Object.entries(KIND_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Agent">
          <select className="cp-select" value={filters.agent} onChange={up('agent')}>
            <option value="">All</option>
            {ws.agents.map((a) => (
              <option key={a.id} value={a.keyAddress}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Team">
          <select className="cp-select" value={filters.team} onChange={up('team')}>
            <option value="">All</option>
            {[...ws.teams.map((t) => t.name), 'People'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input className="cp-input" type="date" value={filters.from} onChange={up('from')} />
        </Field>
        <Field label="To">
          <input className="cp-input" type="date" value={filters.to} onChange={up('to')} />
        </Field>
        <AsyncButton className="btn-secondary" onClick={() => load()} onResult={onResult}>
          <Filter size={14} /> Apply
        </AsyncButton>
      </div>
    </div>
  );
}

export function LedgerPanel() {
  const ws = useWorkspace();
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null);
  const [exportFormat, setExportFormat] = useState('quickbooks');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const server = useServer();
  useEffect(() => {
    if (!server.checked) checkServer();
  }, [server.checked]);

  const totals = (rows || []).reduce(
    (acc, r) => {
      if (r.kind === 'Payroll') acc.people += r.amount;
      else acc.agents += r.amount;
      acc.byTeam[r.team] = (acc.byTeam[r.team] || 0) + r.amount;
      return acc;
    },
    { people: 0, agents: 0, byTeam: {} },
  );

  const exportCsv = () => {
    const fmt = EXPORTS[exportFormat];
    downloadCsv(`${fmt.file}-${new Date().toISOString().slice(0, 10)}.csv`, fmt.build(rows, dateFormat));
  };

  return (
    <div className="glass-panel cp-card cp-stack">
      <div className="cp-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="cp-title">
            <BookOpen size={18} /> Ledger: people and agents
          </div>
          <p className="cp-sub">
            Every memo transfer from your treasury, matched to the agent key that spent it, read from Tempo itself.
            Export it for your accountant.
          </p>
        </div>
        <div className="cp-row">
          <AsyncButton
            className="btn-secondary btn-sm"
            disabled={!ws.company}
            onClick={async () => setRows(await loadChainLedger(ws))}
            onResult={setResult}
          >
            <RefreshCw size={14} /> Quick view from chain
          </AsyncButton>
        </div>
      </div>
      <ServerLedger ws={ws} onRows={setRows} onResult={setResult} />
      {result && <Result result={result} okText={typeof result.value === 'string' ? result.value : 'Done.'} />}

      {rows?.length > 0 && (
        <div className="cp-form">
          <Field label="Export for">
            <select className="cp-select" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
              {Object.entries(EXPORTS).map(([id, f]) => (
                <option key={id} value={id}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          {exportFormat !== 'full' && (
            <Field label="Date format (match your accounting settings)">
              <select className="cp-select" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                {DATE_FORMATS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          )}
          <button className="btn-primary" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      )}
      {rows?.length > 0 && exportFormat !== 'full' && (
        <div className="cp-note">
          Payments are exported as negative amounts (money out). Network fees under $0.01 are left out because{' '}
          {exportFormat === 'xero' ? 'Xero' : 'QuickBooks'} only takes cents. Import it into the bank account that
          represents this treasury.
        </div>
      )}

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
