import React, { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { txUrl, addressUrl, short, errorText } from '../../lib/tempo';

/** Button that runs an async action, shows a spinner, and reports errors/success to `onResult`. */
export function AsyncButton({ onClick, children, className = 'btn-primary', disabled, onResult, title }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={disabled || busy}
      title={title}
      onClick={async () => {
        setBusy(true);
        onResult?.(null);
        try {
          const r = await onClick();
          onResult?.({ ok: true, value: r });
        } catch (e) {
          console.warn(e);
          onResult?.({ ok: false, error: errorText(e) });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 size={15} className="spin" /> : null}
      {children}
    </button>
  );
}

export function Result({ result, okText }) {
  if (!result) return null;
  if (!result.ok) return <div className="cp-note error">{result.error}</div>;
  const hash = typeof result.value === 'string' && result.value.startsWith('0x') ? result.value : null;
  return (
    <div className="cp-note ok">
      {okText || 'Done.'} {hash ? <TxLink hash={hash} /> : null}
    </div>
  );
}

export const TxLink = ({ hash, label }) =>
  hash ? (
    <a className="cp-link cp-mono" href={txUrl(hash)} target="_blank" rel="noreferrer">
      {label || short(hash)} <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
    </a>
  ) : null;

export const AddressLink = ({ address }) =>
  address ? (
    <a className="cp-link cp-mono" href={addressUrl(address)} target="_blank" rel="noreferrer">
      {short(address)}
    </a>
  ) : null;

export const Stat = ({ label, value, hint }) => (
  <div className="cp-stat">
    <div className="cp-stat-label">{label}</div>
    <div className="cp-stat-value">{value}</div>
    {hint ? <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>{hint}</div> : null}
  </div>
);

export const Field = ({ label, children }) => (
  <label className="cp-field">
    {label}
    {children}
  </label>
);

export function Bar({ used, total }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, ((total - used) / total) * 100)) : 0;
  return (
    <div className={`cp-bar ${pct < 20 ? 'low' : ''}`} title={`${pct.toFixed(0)}% left`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
