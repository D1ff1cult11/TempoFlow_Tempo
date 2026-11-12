import React, { useEffect, useState, useCallback } from 'react';
import { Building2, KeyRound, Fingerprint, Droplets, RefreshCw } from 'lucide-react';
import { useWorkspace, actions } from '../../store/useWorkspace';
import { getBalances, TOKENS, usd } from '../../lib/tempo';
import { AsyncButton, Result, AddressLink, Stat } from './ui';

export function useBalances(address) {
  const [balances, setBalances] = useState(null);
  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      setBalances(await getBalances(address));
    } catch (e) {
      console.warn('balance read failed', e);
    }
  }, [address]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);
  return [balances, refresh];
}

export function CompanySetup() {
  const ws = useWorkspace();
  const [result, setResult] = useState(null);
  const [balances, refresh] = useBalances(ws.company?.address);
  const total = balances ? Object.values(balances).reduce((a, b) => a + b, 0) : null;

  if (!ws.company) {
    return (
      <div className="glass-panel cp-card cp-stack">
        <div>
          <div className="cp-title">
            <Building2 size={18} /> Create your company account
          </div>
          <p className="cp-sub">
            This is the treasury that pays your people and your AI agents. It runs on <strong>Tempo testnet</strong> with
            free faucet stablecoins, so no real money is involved. You create it in your own browser; TempoFlow never sees
            your passkey.
          </p>
        </div>
        <div className="cp-row">
          <AsyncButton onClick={() => actions.createCompany('passkey')} onResult={setResult}>
            <Fingerprint size={16} /> Create with a passkey
          </AsyncButton>
          <AsyncButton className="btn-secondary" onClick={() => actions.createCompany('testKey')} onResult={setResult}>
            <KeyRound size={16} /> Use a throwaway test key
          </AsyncButton>
        </div>
        <div className="cp-note">
          Passkey: uses Face ID, Touch ID, Windows Hello or a security key, and asks you to confirm each admin action.
          Test key: a random key stored only in this browser, for quick testing on testnet.
        </div>
        <Result result={result} okText="Company account created. Next, fund it from the faucet." />
      </div>
    );
  }

  return (
    <div className="glass-panel cp-card cp-stack">
      <div className="cp-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="cp-title">
            <Building2 size={18} /> Company treasury <span className="badge-pill badge-cyan">Tempo testnet</span>
          </div>
          <p className="cp-sub">
            Account <AddressLink address={ws.company.address} /> · {ws.company.type === 'passkey' ? 'passkey' : 'test key'} ·
            fee sponsor <AddressLink address={ws.sponsor?.address} />
          </p>
        </div>
        <div className="cp-row">
          <AsyncButton
            className="btn-secondary btn-sm"
            onClick={async () => {
              await actions.fund();
              await refresh();
            }}
            onResult={setResult}
          >
            <Droplets size={14} /> Get testnet funds
          </AsyncButton>
          <button className="btn-secondary btn-sm" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>
      <div className="cp-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <Stat label="Total stablecoins" value={total == null ? '…' : usd(total)} />
        {TOKENS.map((t) => (
          <Stat key={t.address} label={t.symbol} value={balances ? balances[t.address].toLocaleString() : '…'} />
        ))}
      </div>
      <label className="cp-row" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
        <input type="checkbox" checked={ws.sponsorFees} onChange={(e) => actions.setSponsorFees(e.target.checked)} />
        Sponsor network fees for agents and pay runs (so fees never eat an agent's budget)
      </label>
      <Result result={result} okText="Funded from the testnet faucet." />
    </div>
  );
}
