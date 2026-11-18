import React, { useState } from 'react';
import { Zap, ArrowDownCircle } from 'lucide-react';
import { useStream } from './StreamsCard';
import { withdrawStream, companyAccount, decodeMemo, tokenSymbol, short, PAYROLL_STREAM } from '../../lib/tempo';
import { AsyncButton, Result, AddressLink } from './ui';

const WALLET_KEY = 'tempoflow.contractorWallet';
function savedWallet() {
  try {
    return JSON.parse(localStorage.getItem(WALLET_KEY) || 'null');
  } catch {
    return null;
  }
}

/** Public page for a contractor (#stream=<id>): watch pay accrue and withdraw with the passkey wallet made at sign-up. */
export function StreamPage({ id }) {
  const live = useStream(id);
  const wallet = savedWallet();
  const [result, setResult] = useState(null);
  const mine = live && wallet && wallet.address.toLowerCase() === live.employee.toLowerCase();

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="brand" style={{ padding: '8px 0 24px' }}>
        <span className="brand-mark">
          <Zap size={16} strokeWidth={2.5} />
        </span>
        TempoFlow
      </div>
      {!live && <div className="cp-note">Reading the stream from Tempo…</div>}
      {live && (
        <div className="card cp-card cp-stack">
          <div>
            <div className="cp-sub" style={{ marginTop: 0 }}>{decodeMemo(id)} · Tempo testnet</div>
            <div className="kpi-value" style={{ fontSize: '2.4rem', color: 'var(--accent)' }}>${live.claimableNow.toFixed(6)}</div>
            <div className="cp-sub">
              earned and ready to withdraw · ${live.perSecond.toFixed(6)} {tokenSymbol(live.token)} per second ·{' '}
              {live.active ? `ends ${new Date(live.stop).toLocaleString()}` : 'stream ended'}
            </div>
          </div>
          <div className="cp-sub">
            From <AddressLink address={live.employer} /> to <AddressLink address={live.employee} /> through contract{' '}
            <AddressLink address={PAYROLL_STREAM} />.
          </div>
          {mine ? (
            <AsyncButton
              disabled={!live.active || live.claimableNow < 0.000001}
              onClick={() => withdrawStream({ account: companyAccount(wallet), id })}
              onResult={setResult}
            >
              <ArrowDownCircle size={16} /> Withdraw to my wallet
            </AsyncButton>
          ) : (
            <div className="cp-note">
              Withdraw from the wallet that receives this stream ({short(live.employee)}): call <code>withdrawFromStream</code> on
              the contract, or open this link in the browser where you created your TempoFlow passkey wallet.
            </div>
          )}
          <Result result={result} okText="Withdrawn to your wallet." />
        </div>
      )}
    </div>
  );
}
