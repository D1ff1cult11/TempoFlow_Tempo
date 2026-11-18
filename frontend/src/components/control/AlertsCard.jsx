import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Plus, Trash2, Send, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../store/useWorkspace';
import { listAlerts, addAlert, deleteAlert, testAlert, checkAlerts, saveDirectory } from '../../lib/api';
import { AsyncButton, Result, Field } from './ui';
import { ServerGate } from './ServerGate';

const KINDS = {
  low_budget: { label: 'Budget running low', unit: '% left', default: 20 },
  limit_hit: { label: 'Daily limit used up', unit: null },
  expiry: { label: 'Key expiring soon', unit: 'days before', default: 3 },
};
const CHECK_EVERY_MS = 5 * 60 * 1000;

function Alerts() {
  const ws = useWorkspace();
  const [data, setData] = useState({ rules: [], events: [] });
  const [form, setForm] = useState({ kind: 'low_budget', threshold: '20', webhookUrl: '' });
  const [result, setResult] = useState(null);

  const refresh = useCallback(async () => setData(await listAlerts()), []);
  const check = useCallback(async () => {
    await saveDirectory(ws);
    const { fired } = await checkAlerts();
    await refresh();
    return fired.length ? `${fired.length} alert(s) sent` : 'Checked: nothing to report';
  }, [ws, refresh]);

  // While this page is open, check the rules every few minutes (Vercel Cron also checks once a day).
  useEffect(() => {
    refresh().catch(() => {});
    const t = setInterval(() => check().catch(() => {}), CHECK_EVERY_MS);
    return () => clearInterval(t);
  }, [refresh, check]);

  const kind = KINDS[form.kind];
  return (
    <div className="cp-stack">
      {data.rules.length > 0 && (
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Alert</th>
                <th>When</th>
                <th>Sends to</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rules.map((r) => (
                <tr key={r.id}>
                  <td>{KINDS[r.kind]?.label ?? r.kind}</td>
                  <td>{KINDS[r.kind]?.unit ? `${Number(r.threshold)} ${KINDS[r.kind].unit}` : 'at $0 left'}</td>
                  <td className="cp-mono">{r.webhook_url}</td>
                  <td>
                    <div className="cp-row" style={{ gap: 6 }}>
                      <AsyncButton className="btn-secondary btn-sm" onClick={async () => { await testAlert(r.id); return 'Test message sent'; }} onResult={setResult}>
                        <Send size={13} /> Test
                      </AsyncButton>
                      <AsyncButton className="btn-danger btn-sm" onClick={async () => { await deleteAlert(r.id); await refresh(); }} onResult={setResult}>
                        <Trash2 size={13} />
                      </AsyncButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="cp-form">
        <Field label="Alert me when">
          <select className="cp-select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, threshold: String(KINDS[e.target.value].default ?? '') })}>
            {Object.entries(KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        {kind.unit && (
          <Field label={kind.unit}>
            <input className="cp-input" type="number" min="1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
          </Field>
        )}
        <Field label="Webhook URL (Slack, Discord or any https endpoint)">
          <input className="cp-input cp-mono" value={form.webhookUrl} placeholder="https://hooks.slack.com/services/…" onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} />
        </Field>
        <AsyncButton
          className="btn-secondary"
          disabled={!form.webhookUrl.startsWith('https://')}
          onClick={async () => {
            await addAlert({ kind: form.kind, threshold: form.threshold === '' ? undefined : Number(form.threshold), webhookUrl: form.webhookUrl.trim() });
            setForm({ ...form, webhookUrl: '' });
            await refresh();
            return 'Alert added';
          }}
          onResult={setResult}
        >
          <Plus size={14} /> Add alert
        </AsyncButton>
      </div>

      <div className="cp-row" style={{ justifyContent: 'space-between' }}>
        <span className="cp-sub" style={{ marginTop: 0 }}>
          Checked every 5 minutes while this page is open, after each ledger sync, and once a day automatically. Each
          alert is sent once per agent per budget period.
        </span>
        <AsyncButton className="btn-secondary btn-sm" onClick={check} onResult={setResult}>
          <RefreshCw size={13} /> Check now
        </AsyncButton>
      </div>
      <Result result={result} okText={typeof result?.value === 'string' ? result.value : 'Done.'} />

      {data.events.length > 0 && (
        <ul className="activity">
          {data.events.slice(0, 8).map((e, i) => (
            <li key={i}>
              <time>{new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              <span style={{ flex: 1, minWidth: 0 }}>{e.message}</span>
              <span className={`status ${e.status === 'sent' ? 'active' : 'revoked'}`}>{e.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AlertsCard() {
  return (
    <div className="glass-panel cp-card cp-stack">
      <div>
        <div className="cp-title">
          <Bell size={18} /> Alerts
        </div>
        <p className="cp-sub">Get a message in Slack, Discord or any webhook when an agent runs low, hits its limit, or its key is about to expire.</p>
      </div>
      <ServerGate what="alerts">
        <Alerts />
      </ServerGate>
    </div>
  );
}
