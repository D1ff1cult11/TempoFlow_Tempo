import React, { useState } from 'react';
import { Users, Plus, Trash2, Banknote, Shuffle } from 'lucide-react';
import { privateKeyToAddress, generatePrivateKey } from 'viem/accounts';
import { useWorkspace, actions } from '../../store/useWorkspace';
import { TOKENS, DEFAULT_TOKEN, usd, tokenSymbol } from '../../lib/tempo';
import { AsyncButton, Result, AddressLink, Field } from './ui';

const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a.trim());
const thisPeriod = () => new Date().toISOString().slice(0, 7); // e.g. 2026-11

export function PeoplePanel() {
  const ws = useWorkspace();
  const [form, setForm] = useState({ name: '', role: '', address: '', amount: '' });
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [period, setPeriod] = useState(thisPeriod());
  const [result, setResult] = useState(null);
  const total = ws.contractors.reduce((s, c) => s + Number(c.amount), 0);
  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="cp-stack">
      <div className="glass-panel cp-card cp-stack">
        <div>
          <div className="cp-title">
            <Users size={18} /> People you pay
          </div>
          <p className="cp-sub">
            Contractors are paid in stablecoins from the same treasury as your agents. Every payout carries an invoice
            number as its on-chain memo, so your books reconcile automatically.
          </p>
        </div>
        <div className="cp-form">
          <Field label="Name">
            <input className="cp-input" value={form.name} onChange={up('name')} placeholder="Ana" />
          </Field>
          <Field label="Role">
            <input className="cp-input" value={form.role} onChange={up('role')} placeholder="Design" />
          </Field>
          <Field label="Wallet address">
            <div className="cp-row" style={{ flexWrap: 'nowrap' }}>
              <input className="cp-input cp-mono" value={form.address} onChange={up('address')} placeholder="0x…" />
              <button
                className="btn-secondary btn-sm"
                title="Fill a random test address (testnet only)"
                onClick={() => setForm((f) => ({ ...f, address: privateKeyToAddress(generatePrivateKey()) }))}
              >
                <Shuffle size={13} />
              </button>
            </div>
          </Field>
          <Field label="Amount per pay run (USD)">
            <input className="cp-input" type="number" min="0.01" step="0.01" value={form.amount} onChange={up('amount')} />
          </Field>
          <button
            className="btn-secondary"
            disabled={!form.name.trim() || !isAddress(form.address) || !(Number(form.amount) > 0)}
            onClick={() => {
              actions.addContractor({ ...form, name: form.name.trim(), address: form.address.trim() });
              setForm({ name: '', role: '', address: '', amount: '' });
            }}
          >
            <Plus size={15} /> Add person
          </button>
        </div>

        {ws.contractors.length > 0 && (
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Wallet</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ws.contractors.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.role || '—'}</td>
                    <td>
                      <AddressLink address={c.address} />
                    </td>
                    <td className="cp-mono">{usd(c.amount)}</td>
                    <td>
                      <button className="btn-secondary btn-sm" onClick={() => actions.removeContractor(c.id)} title="Remove">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass-panel cp-card cp-stack">
        <div>
          <div className="cp-title">
            <Banknote size={18} /> Pay run
          </div>
          <p className="cp-sub">
            Pays everyone above in <strong>one Tempo transaction</strong> (batched calls). If it fails, nobody is paid, so
            there are no half-finished pay runs.{' '}
            {ws.sponsorFees ? 'Network fees are sponsored.' : 'Fees are paid by the company account.'}
          </p>
        </div>
        <div className="cp-form">
          <Field label="Pay period (used in invoice memos)">
            <input className="cp-input" value={period} onChange={(e) => setPeriod(e.target.value)} maxLength={10} />
          </Field>
          <Field label="Stablecoin">
            <select className="cp-select" value={token} onChange={(e) => setToken(e.target.value)}>
              {TOKENS.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </Field>
          <AsyncButton
            disabled={!ws.company || ws.contractors.length === 0}
            onClick={() => actions.runPayroll({ token, period })}
            onResult={setResult}
          >
            <Banknote size={16} /> Pay {ws.contractors.length} {ws.contractors.length === 1 ? 'person' : 'people'} ·{' '}
            {usd(total)} {tokenSymbol(token)}
          </AsyncButton>
        </div>
        <Result result={result} okText="Pay run settled on Tempo testnet in one transaction." />
        <div className="cp-note warn">
          Testnet only. Paying real salaries needs a licensed partner for cash-out and compliance in each country; that
          is planned, not built.
        </div>
      </div>
    </div>
  );
}
