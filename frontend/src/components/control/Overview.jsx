import React, { useEffect, useState } from 'react';
import { Wallet, Bot, Gauge, Users, ArrowRight, FlaskConical } from 'lucide-react';
import { useWorkspace } from '../../store/useWorkspace';
import { remainingLimit, usd } from '../../lib/tempo';
import { CompanySetup, useBalances } from './CompanySetup';
import { TxLink } from './ui';

function useBudgetLeft(companyAddress, agents) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    const active = agents.filter((a) => a.status === 'active');
    if (!companyAddress || active.length === 0) {
      setLeft(active.length === 0 ? 0 : null);
      return;
    }
    let live = true;
    Promise.all(active.map((a) => remainingLimit({ companyAddress, agent: a }).then((r) => r.remaining).catch(() => 0))).then(
      (vals) => live && setLeft(vals.reduce((s, v) => s + v, 0)),
    );
    return () => {
      live = false;
    };
  }, [companyAddress, agents]);
  return left;
}

const Kpi = ({ icon: Icon, label, value, foot }) => (
  <div className="kpi">
    <div className="kpi-label">
      <Icon size={14} /> {label}
    </div>
    <div className="kpi-value">{value}</div>
    {foot && <div className="kpi-foot">{foot}</div>}
  </div>
);

export function Overview({ onNavigate }) {
  const ws = useWorkspace();
  const [balances] = useBalances(ws.company?.address);
  const total = balances ? Object.values(balances).reduce((a, b) => a + b, 0) : null;
  const active = ws.agents.filter((a) => a.status === 'active');
  const dailyAllocated = active.reduce((s, a) => s + Number(a.dailyLimit), 0);
  const budgetLeft = useBudgetLeft(ws.company?.address, ws.agents);
  const paidPeople = ws.ledger.filter((l) => l.kind === 'payroll' && l.amount).reduce((s, l) => s + l.amount, 0);

  if (!ws.company) return <CompanySetup />;

  const steps = [
    { done: total > 0, text: 'Fund the treasury from the testnet faucet', go: null },
    { done: active.length > 0, text: 'Authorize your first agent with a daily budget', go: 'agents' },
    { done: ws.contractors.length > 0, text: 'Add the people you pay', go: 'people' },
    { done: paidPeople > 0, text: 'Run a pay run in one transaction', go: 'people' },
  ];

  return (
    <div className="cp-stack" style={{ gap: 20 }}>
      <div className="kpi-grid">
        <Kpi icon={Wallet} label="Treasury" value={total == null ? '…' : usd(total)} foot="All stablecoins, testnet" />
        <Kpi icon={Bot} label="Active agents" value={active.length} foot={`${ws.teams.length} teams`} />
        <Kpi
          icon={Gauge}
          label="Agent budget left today"
          value={budgetLeft == null ? '…' : usd(budgetLeft)}
          foot={`of ${usd(dailyAllocated)} allocated`}
        />
        <Kpi icon={Users} label="Paid to people" value={usd(paidPeople)} foot={`${ws.contractors.length} people on file`} />
      </div>

      <div className="cp-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card cp-card cp-stack">
          <div className="cp-title">Get set up</div>
          <ul className="activity">
            {steps.map((s) => (
              <li key={s.text}>
                <span className={`status ${s.done ? 'active' : 'pending'}`}>{s.done ? 'Done' : 'To do'}</span>
                <span style={{ flex: 1 }}>{s.text}</span>
                {!s.done && s.go && (
                  <button className="btn-secondary btn-sm" onClick={() => onNavigate(s.go)}>
                    Open <ArrowRight size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card cp-card cp-stack">
          <div className="cp-row" style={{ justifyContent: 'space-between' }}>
            <div className="cp-title">Recent activity</div>
            <button className="btn-secondary btn-sm" onClick={() => onNavigate('ledger')}>
              Ledger <ArrowRight size={13} />
            </button>
          </div>
          {ws.ledger.length === 0 ? (
            <p className="cp-sub">Actions you take here show up in this list, each linked to Tempo's explorer.</p>
          ) : (
            <ul className="activity">
              {ws.ledger.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <time>{new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                  <span style={{ flex: 1, minWidth: 0 }}>{l.label}</span>
                  {l.hash && <TxLink hash={l.hash} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <CompanySetup />

      <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => onNavigate('demos')}>
        <FlaskConical size={15} /> See the earlier prototypes (simulated)
      </button>
    </div>
  );
}
