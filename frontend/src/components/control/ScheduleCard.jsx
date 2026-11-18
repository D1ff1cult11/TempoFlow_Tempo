import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Banknote, Trash2, Plus } from 'lucide-react';
import { useWorkspace, actions } from '../../store/useWorkspace';
import { listSchedules, createSchedule, remindSchedules, markRunPaid, deleteSchedule } from '../../lib/api';
import { TOKENS, DEFAULT_TOKEN, tokenSymbol, usd } from '../../lib/tempo';
import { AsyncButton, Result, Field, TxLink } from './ui';
import { ServerGate } from './ServerGate';

const today = () => new Date().toISOString().slice(0, 10);

function Schedules() {
  const ws = useWorkspace();
  const [data, setData] = useState({ schedules: [], due: [], runs: [] });
  const [form, setForm] = useState({ cadence: 'monthly', firstRun: today(), token: DEFAULT_TOKEN });
  const [result, setResult] = useState(null);
  const refresh = useCallback(async () => setData(await listSchedules()), []);
  const total = ws.contractors.reduce((s, c) => s + Number(c.amount), 0);

  useEffect(() => {
    // Opening the page also sends any due reminders (the daily cron does the same).
    remindSchedules()
      .catch(() => {})
      .finally(() => refresh().catch(() => {}));
  }, [refresh]);

  return (
    <div className="cp-stack">
      {data.due.map((d) => (
        <div key={`${d.schedule_id}-${d.period}`} className="cp-note warn" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            The {d.cadence} pay run for <strong>{d.period}</strong> is due: {ws.contractors.length} people, {usd(total)}{' '}
            {tokenSymbol(d.token)}.
          </div>
          <div className="cp-row">
            <AsyncButton
              className="btn-primary btn-sm"
              disabled={!ws.contractors.length}
              onClick={async () => {
                const tx = await actions.runPayroll({ token: d.token, period: d.period });
                await markRunPaid(d.schedule_id, d.period, tx, total);
                await refresh();
                return tx;
              }}
              onResult={setResult}
            >
              <Banknote size={14} /> Pay now
            </AsyncButton>
            <span className="cp-sub" style={{ marginTop: 0 }}>One transaction for everyone, signed with your company account.</span>
          </div>
        </div>
      ))}
      <Result result={result} okText="Pay run settled and recorded." />

      {data.schedules.length > 0 && (
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Every</th>
                <th>Next run</th>
                <th>Stablecoin</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.cadence === 'weekly' ? 'Week' : 'Month'}</td>
                  <td className="cp-mono">{s.next_run}</td>
                  <td>{tokenSymbol(s.token)}</td>
                  <td>
                    <AsyncButton className="btn-danger btn-sm" onClick={async () => { await deleteSchedule(s.id); await refresh(); }} onResult={setResult}>
                      <Trash2 size={13} />
                    </AsyncButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="cp-form">
        <Field label="Repeat">
          <select className="cp-select" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </Field>
        <Field label="First run">
          <input className="cp-input" type="date" value={form.firstRun} onChange={(e) => setForm({ ...form, firstRun: e.target.value })} />
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
          className="btn-secondary"
          disabled={!form.firstRun}
          onClick={async () => {
            await createSchedule(form);
            await refresh();
          }}
          onResult={setResult}
        >
          <Plus size={14} /> Add schedule
        </AsyncButton>
      </div>

      {data.runs.filter((r) => r.status === 'paid').length > 0 && (
        <ul className="activity">
          {data.runs
            .filter((r) => r.status === 'paid')
            .slice(0, 6)
            .map((r) => (
              <li key={`${r.schedule_id}-${r.period}`}>
                <time>{r.period}</time>
                <span style={{ flex: 1 }}>Paid{r.total != null ? ` ${usd(r.total)}` : ''}</span>
                <TxLink hash={r.tx_hash} />
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export function ScheduleCard() {
  return (
    <div className="glass-panel cp-card cp-stack">
      <div>
        <div className="cp-title">
          <CalendarClock size={18} /> Pay schedule
        </div>
        <p className="cp-sub">
          On each due date TempoFlow reminds you (your alert webhooks, and here). You pay with one click and your passkey;
          TempoFlow never holds a key that can move your money.
        </p>
      </div>
      <ServerGate what="pay schedules">
        <Schedules />
      </ServerGate>
    </div>
  );
}
