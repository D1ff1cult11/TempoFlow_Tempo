import React, { useEffect, useState, useCallback } from 'react';
import { Bot, Plus, ShieldOff, Send, ArrowUpCircle, Users, Copy } from 'lucide-react';
import { useWorkspace, actions, teamAllocated } from '../../store/useWorkspace';
import { TOKENS, DEFAULT_TOKEN, tokenSymbol, usd, remainingLimit, short } from '../../lib/tempo';
import { AsyncButton, Result, AddressLink, TxLink, Field, Bar } from './ui';
import { AlertsCard } from './AlertsCard';

const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a.trim());

function useRemaining(companyAddress, agents) {
  const [map, setMap] = useState({});
  const refresh = useCallback(async () => {
    const active = agents.filter((a) => a.status === 'active');
    const entries = await Promise.all(
      active.map(async (a) => {
        try {
          return [a.id, await remainingLimit({ companyAddress, agent: a })];
        } catch {
          return [a.id, null];
        }
      }),
    );
    setMap(Object.fromEntries(entries));
  }, [companyAddress, agents]);
  useEffect(() => {
    if (!companyAddress) return;
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh, companyAddress]);
  return [map, refresh];
}

function TeamsCard() {
  const ws = useWorkspace();
  const [name, setName] = useState('');
  const [cap, setCap] = useState('25');
  const [result, setResult] = useState(null);
  return (
    <div className="glass-panel cp-card cp-stack">
      <div>
        <div className="cp-title">
          <Users size={18} /> Teams and daily caps
        </div>
        <p className="cp-sub">
          Each agent belongs to a team. TempoFlow never lets the agents in a team add up to more than the team's daily cap.
          Tempo itself enforces each agent's own limit on-chain.
        </p>
      </div>
      <div className="cp-table-wrap">
        <table className="cp-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Daily cap</th>
              <th>Allocated to agents</th>
              <th>Active agents</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ws.teams.map((t) => {
              const allocated = teamAllocated(ws, t.id);
              const count = ws.agents.filter((a) => a.teamId === t.id && a.status === 'active').length;
              return (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="cp-mono">{usd(t.dailyCap)}</td>
                  <td style={{ minWidth: 160 }}>
                    <div className="cp-mono" style={{ marginBottom: 4 }}>
                      {usd(allocated)} / {usd(t.dailyCap)}
                    </div>
                    <Bar used={allocated} total={t.dailyCap} />
                  </td>
                  <td>{count}</td>
                  <td>
                    {count > 0 && (
                      <AsyncButton className="btn-danger btn-sm" onClick={() => actions.revokeTeam(t.id)} onResult={setResult}>
                        <ShieldOff size={13} /> Stop whole team
                      </AsyncButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="cp-form">
        <Field label="New team">
          <input className="cp-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Support" />
        </Field>
        <Field label="Daily cap (USD)">
          <input className="cp-input" type="number" min="1" value={cap} onChange={(e) => setCap(e.target.value)} />
        </Field>
        <button
          className="btn-secondary"
          disabled={!name.trim() || !(Number(cap) > 0)}
          onClick={() => {
            actions.addTeam(name.trim(), cap);
            setName('');
          }}
        >
          <Plus size={15} /> Add team
        </button>
      </div>
      <Result result={result} okText="All agents in the team were revoked." />
    </div>
  );
}

function NewAgentCard() {
  const ws = useWorkspace();
  const [form, setForm] = useState({
    name: 'research-bot',
    teamId: ws.teams[0]?.id ?? '',
    token: DEFAULT_TOKEN,
    dailyLimit: '10',
    recipients: '',
    expiryDays: '30',
    allowMpp: false,
    keySource: 'runtime', // 'runtime': the agent made its own key | 'browser': quick test key made here
    keyAddress: '',
  });
  const [result, setResult] = useState(null);
  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const recipients = form.recipients
    .split(/[\s,]+/)
    .map((r) => r.trim())
    .filter(Boolean);
  const badRecipient = recipients.find((r) => !isAddress(r));
  const runtime = form.keySource === 'runtime';
  const keyTaken = ws.agents.some(
    (a) => a.status === 'active' && a.keyAddress.toLowerCase() === form.keyAddress.trim().toLowerCase(),
  );
  const keyProblem = !runtime
    ? null
    : !form.keyAddress.trim()
      ? 'Paste the key address your agent created.'
      : !isAddress(form.keyAddress)
        ? 'That is not a valid key address (0x + 40 hex characters).'
        : keyTaken
          ? 'An active agent already uses this key.'
          : null;

  return (
    <div className="glass-panel cp-card cp-stack">
      <div>
        <div className="cp-title">
          <Plus size={18} /> Add an agent
        </div>
        <p className="cp-sub">
          Authorizes the agent's key on Tempo with a daily limit, an expiry date and (optionally) a list of the only
          addresses it may pay. The agent can only send memo-tagged transfers, so every payment is traceable.
        </p>
      </div>
      <div className="cp-row" role="radiogroup" aria-label="Where the agent key comes from">
        {[
          ['runtime', "Agent's own key (recommended)"],
          ['browser', 'Generate in this browser (quick test)'],
        ].map(([value, label]) => (
          <label key={value} className="cp-row" style={{ gap: 6, cursor: 'pointer', fontSize: '0.86rem' }}>
            <input
              type="radio"
              name="keySource"
              checked={form.keySource === value}
              onChange={() => setForm((f) => ({ ...f, keySource: value }))}
              style={{ accentColor: 'var(--accent)' }}
            />
            {label}
          </label>
        ))}
      </div>
      {runtime && (
        <>
          <div className="cp-note">
            Create the key where the agent runs, so its private key never touches TempoFlow:{' '}
            <code>npx tempoflow-agent-keygen</code> or <code>generateAgentKey()</code> from <code>@tempoflow/agent</code>.
            Keep the private key in the agent's secret store and paste only the key address here.
          </div>
          <Field label="Agent key address">
            <input className="cp-input cp-mono" value={form.keyAddress} onChange={up('keyAddress')} placeholder="0x…" />
          </Field>
          {form.keyAddress && keyProblem && <div className="cp-note error">{keyProblem}</div>}
        </>
      )}
      <div className="cp-form">
        <Field label="Agent name">
          <input className="cp-input" value={form.name} onChange={up('name')} maxLength={24} />
        </Field>
        <Field label="Team">
          <select className="cp-select" value={form.teamId} onChange={up('teamId')}>
            {ws.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({usd(t.dailyCap - teamAllocated(ws, t.id))} free)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stablecoin">
          <select className="cp-select" value={form.token} onChange={up('token')}>
            {TOKENS.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Daily limit (USD)">
          <input className="cp-input" type="number" min="0.01" step="0.01" value={form.dailyLimit} onChange={up('dailyLimit')} />
        </Field>
        <Field label="Expires in (days)">
          <input className="cp-input" type="number" min="1" max="365" value={form.expiryDays} onChange={up('expiryDays')} />
        </Field>
      </div>
      <Field label="Allowed recipients (optional, comma or space separated). Leave empty to allow any address.">
        <input className="cp-input cp-mono" value={form.recipients} onChange={up('recipients')} placeholder="0x…, 0x…" />
      </Field>
      {badRecipient && <div className="cp-note error">Not a valid address: {badRecipient}</div>}
      <label className="cp-row" style={{ fontSize: '0.84rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={form.allowMpp}
          onChange={(e) => setForm((f) => ({ ...f, allowMpp: e.target.checked }))}
          style={{ accentColor: 'var(--accent)' }}
        />
        Allow paid APIs (MPP). The agent can also pay HTTP 402 APIs with <code>@tempoflow/agent</code>; these
        payments have no task memo.
      </label>
      <div className="cp-row">
        <AsyncButton
          disabled={!ws.company || !form.name.trim() || !(Number(form.dailyLimit) > 0) || !!badRecipient || !!keyProblem}
          onClick={async () => {
            await actions.addAgent({ ...form, name: form.name.trim(), recipients, keyAddress: form.keyAddress.trim() });
            setForm((f) => ({ ...f, keyAddress: '' }));
          }}
          onResult={setResult}
        >
          <Bot size={16} /> Authorize agent on Tempo
        </AsyncButton>
        {!ws.company && <span className="cp-sub">Create the company account first.</span>}
      </div>
      <Result result={result} okText="Agent authorized on Tempo testnet." />
    </div>
  );
}

/** What to put in the agent's environment. Never includes the private key: the agent already holds it. */
function SdkSetup({ agent }) {
  const ws = useWorkspace();
  const relay = `${window.location.origin}/api/relay`;
  const env = [
    `TEMPOFLOW_COMPANY=${ws.company.address}`,
    `TEMPOFLOW_TOKEN=${agent.token}`,
    `TEMPOFLOW_KEY_ADDRESS=${agent.keyAddress}`,
    ws.relayReady ? `TEMPOFLOW_RELAY_URL=${relay}` : null,
    'TEMPOFLOW_AGENT_KEY=<the private key your agent already holds>',
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <div className="cp-stack" style={{ gap: 8 }}>
      <div className="cp-sub">
        This agent holds its own key, so only its code can pay with it. Give the agent these settings and use{' '}
        <code>@tempoflow/agent</code>:
      </div>
      <pre className="cp-note cp-mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
        {env}
      </pre>
      <button className="btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigator.clipboard?.writeText(env)}>
        <Copy size={13} /> Copy SDK setup
      </button>
    </div>
  );
}

function AgentRow({ agent, remaining, onChanged }) {
  const ws = useWorkspace();
  const team = ws.teams.find((t) => t.id === agent.teamId);
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState({ to: agent.recipients?.[0] ?? '', amount: '1.00', task: '1042' });
  const [newLimit, setNewLimit] = useState(String(agent.dailyLimit));
  const [result, setResult] = useState(null);
  const left = remaining?.remaining;
  const low = left != null && left < agent.dailyLimit * 0.2;

  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 700 }}>{agent.name}</div>
          <div className="cp-mono" style={{ color: 'var(--text-dim)' }}>
            key {short(agent.keyAddress)} · {agent.privateKey ? 'test key' : 'own key'}
          </div>
        </td>
        <td>{team?.name ?? '—'}</td>
        <td>
          <span className={`status ${agent.status}`}>{agent.status}</span>
        </td>
        <td style={{ minWidth: 170 }}>
          {agent.status === 'active' ? (
            <>
              <div className="cp-mono" style={{ marginBottom: 4, color: low ? 'var(--warning)' : undefined }}>
                {left == null ? '…' : `${usd(left)} left`} of {usd(agent.dailyLimit)} {tokenSymbol(agent.token)}
              </div>
              <Bar used={left == null ? 0 : agent.dailyLimit - left} total={agent.dailyLimit} />
              {remaining?.periodEnd ? (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 3 }}>
                  resets {new Date(remaining.periodEnd).toLocaleString()}
                </div>
              ) : null}
            </>
          ) : (
            <span className="cp-sub">—</span>
          )}
        </td>
        <td>
          {agent.recipients?.length ? `${agent.recipients.length} allowed` : 'any'} · {agent.expiryDays}d
          {agent.allowMpp ? ' · MPP' : ''}
        </td>
        <td>
          <TxLink hash={agent.authTx} label="auth tx" />
        </td>
        <td>
          {agent.status === 'active' && (
            <button className="btn-secondary btn-sm" onClick={() => setOpen((o) => !o)}>
              {open ? 'Close' : 'Manage'}
            </button>
          )}
        </td>
      </tr>
      {open && agent.status === 'active' && (
        <tr>
          <td colSpan={7} style={{ background: 'rgba(0,0,0,0.25)' }}>
            <div className="cp-stack" style={{ padding: '6px 0' }}>
              {!agent.privateKey && <SdkSetup agent={agent} />}
              {agent.privateKey && (
              <div className="cp-form">
                <Field label="Test payment: pay to">
                  <input
                    className="cp-input cp-mono"
                    value={pay.to}
                    onChange={(e) => setPay({ ...pay, to: e.target.value })}
                    placeholder="0x… recipient"
                  />
                </Field>
                <Field label="Amount">
                  <input className="cp-input" type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                </Field>
                <Field label="Task ID (goes in the memo)">
                  <input className="cp-input" value={pay.task} maxLength={12} onChange={(e) => setPay({ ...pay, task: e.target.value })} />
                </Field>
                <AsyncButton
                  className="btn-secondary"
                  disabled={!isAddress(pay.to) || !(Number(pay.amount) > 0)}
                  onClick={async () => {
                    const h = await actions.agentTestPay(agent.id, pay);
                    onChanged();
                    return h;
                  }}
                  onResult={setResult}
                >
                  <Send size={14} /> Pay as this agent
                </AsyncButton>
              </div>
              )}
              <div className="cp-form">
                <Field label={`New daily limit (team "${team?.name}" cap ${usd(team?.dailyCap)})`}>
                  <input className="cp-input" type="number" step="0.01" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} />
                </Field>
                <AsyncButton
                  className="btn-secondary"
                  disabled={!(Number(newLimit) > 0) || Number(newLimit) === agent.dailyLimit}
                  onClick={async () => {
                    await actions.raiseLimit(agent.id, newLimit);
                    onChanged();
                  }}
                  onResult={setResult}
                >
                  <ArrowUpCircle size={14} /> Change limit
                </AsyncButton>
                {agent.privateKey && (
                  <button
                    className="btn-secondary"
                    title="Copy the test key made in this browser (testnet only)"
                    onClick={() => navigator.clipboard?.writeText(agent.privateKey)}
                  >
                    <Copy size={14} /> Copy test key
                  </button>
                )}
                <AsyncButton className="btn-danger" onClick={() => actions.revoke(agent.id)} onResult={setResult}>
                  <ShieldOff size={14} /> Revoke now
                </AsyncButton>
              </div>
              {agent.privateKey && (
                <div className="cp-note warn">
                  Test key: this agent's private key is stored in this browser so you can try "Pay as this agent". For
                  real agents, use "Agent's own key" so the key never leaves the agent's runtime.
                </div>
              )}
              <Result result={result} okText="Done on Tempo testnet." />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function AgentsPanel() {
  const ws = useWorkspace();
  const [remaining, refresh] = useRemaining(ws.company?.address, ws.agents);
  const active = ws.agents.filter((a) => a.status === 'active');

  return (
    <div className="cp-stack">
      <TeamsCard />
      <AlertsCard />
      <NewAgentCard />
      <div className="glass-panel cp-card cp-stack">
        <div className="cp-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="cp-title">
              <Bot size={18} /> Agents ({active.length} active)
            </div>
            <p className="cp-sub">Remaining budgets are read live from Tempo every 10 seconds.</p>
          </div>
          {ws.company && <AddressLink address={ws.company.address} />}
        </div>
        {ws.agents.length === 0 ? (
          <div className="cp-note">No agents yet. Add one above.</div>
        ) : (
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Budget today</th>
                  <th>Rules</th>
                  <th>On-chain</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ws.agents.map((a) => (
                  <AgentRow key={a.id} agent={a} remaining={remaining[a.id]} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
