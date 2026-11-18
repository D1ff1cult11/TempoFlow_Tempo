import React, { useCallback, useEffect, useState } from 'react';
import { Inbox, Check, X, RefreshCw } from 'lucide-react';
import { useWorkspace, actions } from '../../store/useWorkspace';
import { listLimitRequests, decideLimitRequest } from '../../lib/api';
import { usd, short } from '../../lib/tempo';
import { AsyncButton, Result, TxLink } from './ui';
import { ServerGate } from './ServerGate';

const REFRESH_MS = 60 * 1000;

function Requests() {
  const ws = useWorkspace();
  const [requests, setRequests] = useState([]);
  const [result, setResult] = useState(null);
  const refresh = useCallback(async () => setRequests((await listLimitRequests()).requests), []);

  useEffect(() => {
    refresh().catch(() => {});
    const t = setInterval(() => refresh().catch(() => {}), REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending').slice(0, 5);
  const agentFor = (r) => ws.agents.find((a) => a.keyAddress.toLowerCase() === r.key_address && a.status === 'active');

  return (
    <div className="cp-stack">
      <div className="cp-row" style={{ justifyContent: 'space-between' }}>
        <span className="cp-sub" style={{ marginTop: 0 }}>
          {pending.length ? `${pending.length} waiting for you` : 'No requests waiting.'} Agents ask with{' '}
          <code>agent.requestLimit()</code> from <code>@tempoflow/agent</code>.
        </span>
        <AsyncButton className="btn-secondary btn-sm" onClick={refresh} onResult={setResult}>
          <RefreshCw size={13} /> Refresh
        </AsyncButton>
      </div>

      {pending.map((r) => {
        const agent = agentFor(r);
        return (
          <div key={r.id} className="cp-note" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <strong>{r.agent_name || short(r.key_address)}</strong> asks to go from{' '}
              {r.current_limit != null ? usd(r.current_limit) : '?'} to <strong>{usd(r.requested_limit)}</strong> a day
              {r.reason ? `: "${r.reason}"` : ''} <span style={{ color: 'var(--text-faint)' }}>· {new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div className="cp-row">
              <AsyncButton
                className="btn-primary btn-sm"
                disabled={!agent}
                title={agent ? 'Changes the limit on Tempo, then records the approval' : 'This agent is not in this browser\'s workspace'}
                onClick={async () => {
                  const tx = await actions.raiseLimit(agent.id, Number(r.requested_limit));
                  await decideLimitRequest(r.id, 'approved', tx);
                  await refresh();
                  return tx;
                }}
                onResult={setResult}
              >
                <Check size={14} /> Approve
              </AsyncButton>
              <AsyncButton
                className="btn-danger btn-sm"
                onClick={async () => {
                  await decideLimitRequest(r.id, 'rejected');
                  await refresh();
                }}
                onResult={setResult}
              >
                <X size={14} /> Reject
              </AsyncButton>
              {!agent && <span className="cp-sub" style={{ marginTop: 0 }}>Approve from the browser that manages this agent.</span>}
            </div>
          </div>
        );
      })}
      <Result result={result} okText="Limit changed on Tempo and request approved." />

      {decided.length > 0 && (
        <ul className="activity">
          {decided.map((r) => (
            <li key={r.id}>
              <time>{new Date(r.decided_at || r.created_at).toLocaleDateString()}</time>
              <span style={{ flex: 1, minWidth: 0 }}>
                {r.agent_name || short(r.key_address)} → {usd(r.requested_limit)}/day
              </span>
              <span className={`status ${r.status === 'approved' ? 'active' : 'revoked'}`}>{r.status}</span>
              {r.decided_tx && <TxLink hash={r.decided_tx} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LimitRequestsCard() {
  return (
    <div className="glass-panel cp-card cp-stack">
      <div>
        <div className="cp-title">
          <Inbox size={18} /> Limit requests
        </div>
        <p className="cp-sub">
          Agents can ask for a higher daily limit. Approving changes the limit on Tempo (signed by your company account),
          still within the team's cap.
        </p>
      </div>
      <ServerGate what="limit requests">
        <Requests />
      </ServerGate>
    </div>
  );
}
