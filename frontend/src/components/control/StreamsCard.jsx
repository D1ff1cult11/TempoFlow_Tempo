import React, { useEffect, useState } from 'react';
import { Timer, Play, Square, Link2 } from 'lucide-react';
import { useWorkspace, actions } from '../../store/useWorkspace';
import { streamInfo, TOKENS, DEFAULT_TOKEN, tokenSymbol, usd, PAYROLL_STREAM } from '../../lib/tempo';
import { AsyncButton, Result, Field, TxLink, AddressLink } from './ui';

/** Live, ticking view of one stream: reads the chain every 15s and counts up locally in between. */
export function useStream(id) {
  const [info, setInfo] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () =>
      streamInfo(id)
        .then((i) => live && setInfo({ ...i, readAt: Date.now() }))
        .catch(() => {});
    load();
    const poll = setInterval(load, 15000);
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => {
      live = false;
      clearInterval(poll);
      clearInterval(t);
    };
  }, [id]);
  if (!info) return null;
  const extra = info.active ? ((Math.min(Date.now(), info.stop) - info.readAt) / 1000) * info.perSecond : 0;
  return { ...info, claimableNow: Math.max(0, Math.min(info.remaining, info.claimable + Math.max(0, extra))) };
}

function StreamRow({ s, onResult }) {
  const live = useStream(s.id);
  const link = `${window.location.origin}/#stream=${s.id}`;
  const done = live && !live.active;
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{s.name}</div>
        <div className="cp-mono" style={{ color: 'var(--text-faint)' }}>{s.label}</div>
      </td>
      <td className="cp-mono">
        {usd(s.amount)} / {s.days}d
        <div style={{ color: 'var(--text-faint)' }}>{live ? `$${live.perSecond.toFixed(6)}/s` : '…'}</div>
      </td>
      <td className="cp-mono" style={{ color: 'var(--accent)' }}>
        {live ? `$${live.claimableNow.toFixed(6)}` : '…'}
      </td>
      <td className="cp-mono">{live ? usd(live.remaining) : '…'}</td>
      <td>
        <span className={`status ${done ? 'revoked' : 'active'}`}>{done ? 'ended' : 'streaming'}</span>
      </td>
      <td>
        <div className="cp-row" style={{ gap: 6 }}>
          <button className="btn-secondary btn-sm" title="Link for the contractor to watch and withdraw" onClick={() => navigator.clipboard?.writeText(link)}>
            <Link2 size={13} /> Link
          </button>
          {!done && (
            <AsyncButton className="btn-danger btn-sm" onClick={() => actions.stopStream(s.id)} onResult={onResult} title="Pays what was earned, returns the rest">
              <Square size={12} /> Stop
            </AsyncButton>
          )}
          <TxLink hash={s.hash} label="tx" />
        </div>
      </td>
    </tr>
  );
}

export function StreamsCard() {
  const ws = useWorkspace();
  const [form, setForm] = useState({ contractorId: '', amount: '100', days: '30', token: DEFAULT_TOKEN });
  const [result, setResult] = useState(null);
  const contractor = ws.contractors.find((c) => c.id === form.contractorId) || ws.contractors[0];
  const perSecond = Number(form.amount) / (Number(form.days) * 86_400);

  return (
    <div className="glass-panel cp-card cp-stack">
      <div>
        <div className="cp-title">
          <Timer size={18} /> Pay per second
        </div>
        <p className="cp-sub">
          Lock a contractor's pay in the streaming contract; it accrues every second and they can withdraw any time. Stop
          it and they keep what they earned, the rest comes back. Contract <AddressLink address={PAYROLL_STREAM} /> has
          no owner, so nobody else can touch the money.
        </p>
      </div>
      {ws.contractors.length === 0 ? (
        <div className="cp-note">Add a person above first.</div>
      ) : (
        <div className="cp-form">
          <Field label="Contractor">
            <select className="cp-select" value={contractor?.id} onChange={(e) => setForm({ ...form, contractorId: e.target.value })}>
              {ws.contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Total amount">
            <input className="cp-input" type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Over (days)">
            <input className="cp-input" type="number" min="0.01" step="0.01" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
          </Field>
          <Field label="Stablecoin">
            <select className="cp-select" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })}>
              {TOKENS.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </Field>
          <AsyncButton
            disabled={!ws.company || !contractor || !(Number(form.amount) > 0) || !(Number(form.days) > 0) || perSecond < 0.000001}
            onClick={() => actions.startStream({ contractor, amount: form.amount, days: form.days, token: form.token })}
            onResult={setResult}
          >
            <Play size={14} /> Start stream
          </AsyncButton>
        </div>
      )}
      {Number(form.days) > 0 && Number(form.amount) > 0 && (
        <div className="cp-sub" style={{ marginTop: 0 }}>
          That's ${perSecond.toFixed(6)} {tokenSymbol(form.token)} per second, about {usd(perSecond * 3600)} per hour.
        </div>
      )}
      <Result result={result} okText="Done on Tempo testnet." />
      {ws.streams.length > 0 && (
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Rate</th>
                <th>Earned, not withdrawn</th>
                <th>Still locked</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ws.streams.map((s) => (
                <StreamRow key={s.id} s={s} onResult={setResult} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
