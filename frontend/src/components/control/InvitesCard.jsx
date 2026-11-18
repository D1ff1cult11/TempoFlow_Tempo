import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Copy, Check, X } from 'lucide-react';
import { useWorkspace, actions } from '../../store/useWorkspace';
import { listInvites, createInvite, decideInvite } from '../../lib/api';
import { usd } from '../../lib/tempo';
import { AsyncButton, Result, Field, AddressLink } from './ui';
import { ServerGate } from './ServerGate';

const linkFor = (code) => `${window.location.origin}/#join=${code}`;

function Invites() {
  const ws = useWorkspace();
  const [invites, setInvites] = useState([]);
  const [form, setForm] = useState({ name: '', amount: '' });
  const [link, setLink] = useState(null);
  const [result, setResult] = useState(null);
  const refresh = useCallback(async () => setInvites((await listInvites()).invites), []);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  return (
    <div className="cp-stack">
      <div className="cp-form">
        <Field label="Contractor name">
          <input className="cp-input" value={form.name} maxLength={64} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya" />
        </Field>
        <Field label="Amount per pay run (optional)">
          <input className="cp-input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <AsyncButton
          className="btn-secondary"
          disabled={!form.name.trim()}
          onClick={async () => {
            const { code } = await createInvite(form.name.trim(), form.amount === '' ? null : Number(form.amount));
            setLink(linkFor(code));
            setForm({ name: '', amount: '' });
            await refresh();
          }}
          onResult={setResult}
        >
          <UserPlus size={14} /> Create invite link
        </AsyncButton>
      </div>
      {link && (
        <div className="cp-note ok" style={{ wordBreak: 'break-all' }}>
          Send this link to the contractor (it's shown only once and works for 14 days):
          <div className="cp-row" style={{ marginTop: 6 }}>
            <code className="cp-mono">{link}</code>
            <button className="btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(link)}>
              <Copy size={13} /> Copy
            </button>
          </div>
        </div>
      )}
      {result && !result.ok && <Result result={result} />}

      {invites.length > 0 && (
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Wallet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td className="cp-mono">{i.amount ? usd(i.amount) : '—'}</td>
                  <td>
                    <span className={`status ${i.status === 'approved' ? 'active' : 'pending'}`}>
                      {i.status === 'sent' ? 'waiting for wallet' : i.status === 'submitted' ? 'ready to approve' : i.status}
                    </span>
                  </td>
                  <td>{i.wallet ? <AddressLink address={i.wallet} /> : '—'}</td>
                  <td>
                    {i.status !== 'approved' && (
                      <div className="cp-row" style={{ gap: 6 }}>
                        {i.status === 'submitted' && (
                          <AsyncButton
                            className="btn-primary btn-sm"
                            onClick={async () => {
                              const { contractor } = await decideInvite(i.id, 'approved');
                              const exists = ws.contractors.some((c) => c.address.toLowerCase() === contractor.wallet);
                              if (!exists) actions.addContractor({ name: contractor.name, address: contractor.wallet, amount: contractor.amount ?? 0, role: '' });
                              await refresh();
                              return `${contractor.name} added to People`;
                            }}
                            onResult={setResult}
                          >
                            <Check size={13} /> Approve
                          </AsyncButton>
                        )}
                        <AsyncButton
                          className="btn-danger btn-sm"
                          onClick={async () => {
                            await decideInvite(i.id, 'cancelled');
                            await refresh();
                          }}
                          onResult={setResult}
                        >
                          <X size={13} />
                        </AsyncButton>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result?.ok && typeof result.value === 'string' && <Result result={result} okText={result.value} />}
    </div>
  );
}

export function InvitesCard() {
  return (
    <div className="glass-panel cp-card cp-stack">
      <div>
        <div className="cp-title">
          <UserPlus size={18} /> Invite contractors
        </div>
        <p className="cp-sub">
          Send a link; the contractor adds their wallet themselves (or creates one with a passkey). You approve before
          they're added to pay runs, so nobody can slip in a wrong address.
        </p>
      </div>
      <ServerGate what="contractor invites">
        <Invites />
      </ServerGate>
    </div>
  );
}
