import React, { useEffect, useState } from 'react';
import { Zap, Fingerprint, Wallet, CheckCircle2 } from 'lucide-react';
import { viewJoin, submitJoin, joinMessage } from '../../lib/api';
import { createPasskeyCompany, companyAccount, usd, short } from '../../lib/tempo';
import { AsyncButton, Result, Field, AddressLink } from './ui';

const WALLET_KEY = 'tempoflow.contractorWallet';
const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a.trim());

/** Public page a contractor opens from an invite link (#join=<code>). No TempoFlow account needed. */
export function JoinPage({ code }) {
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [typed, setTyped] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    viewJoin(code).then(setInvite, (e) => setError(e.message));
  }, [code]);

  const finish = (wallet, verified) => setDone({ wallet, verified });

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="brand" style={{ padding: '8px 0 24px' }}>
        <span className="brand-mark">
          <Zap size={16} strokeWidth={2.5} />
        </span>
        TempoFlow
      </div>
      {error && <div className="cp-note error">{error}</div>}
      {!invite && !error && <div className="cp-note">Loading your invite…</div>}
      {invite && !done && invite.status !== 'approved' && (
        <div className="card cp-card cp-stack">
          <div>
            <h1 className="page-title">Hi {invite.name}, add your wallet</h1>
            <p className="page-sub">
              Company <AddressLink address={invite.company} /> wants to pay you in stablecoins on Tempo
              {invite.amount ? ` (${usd(invite.amount)} per pay run)` : ''}. Tell them where to send it. This is Tempo
              testnet: no real money.
            </p>
          </div>

          <div className="cp-stack" style={{ gap: 8 }}>
            <div className="cp-title">
              <Fingerprint size={16} /> Create a wallet with a passkey
            </div>
            <p className="cp-sub" style={{ marginTop: 0 }}>
              Uses Face ID, Windows Hello or a security key. The wallet signs a message to prove it's yours.
            </p>
            <AsyncButton
              onClick={async () => {
                const w = await createPasskeyCompany('TempoFlow wallet (testnet)');
                try {
                  localStorage.setItem(WALLET_KEY, JSON.stringify(w));
                } catch {
                  /* still works without storage */
                }
                const proof = await companyAccount(w).signMessage({ message: joinMessage(code.split('.')[0], w.address) });
                await submitJoin({ code, wallet: w.address, proof });
                finish(w.address, true);
              }}
              onResult={setResult}
            >
              <Fingerprint size={15} /> Create wallet and send it
            </AsyncButton>
          </div>

          <div className="cp-stack" style={{ gap: 8 }}>
            <div className="cp-title">
              <Wallet size={16} /> I already have a wallet
            </div>
            <Field label="Your wallet address on Tempo">
              <input className="cp-input cp-mono" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="0x…" />
            </Field>
            <label className="cp-row" style={{ fontSize: '0.84rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              I checked this address character by character. Payments sent to a wrong address can't be recovered.
            </label>
            <AsyncButton
              className="btn-secondary"
              disabled={!isAddress(typed) || !confirm}
              onClick={async () => {
                await submitJoin({ code, wallet: typed.trim(), confirmTyped: true });
                finish(typed.trim(), false);
              }}
              onResult={setResult}
            >
              Send my address
            </AsyncButton>
          </div>
          {result && !result.ok && <Result result={result} />}
        </div>
      )}
      {(done || invite?.status === 'approved') && (
        <div className="cp-note ok">
          <CheckCircle2 size={16} style={{ verticalAlign: -3 }} />{' '}
          {invite?.status === 'approved' && !done
            ? `You're already set up with wallet ${short(invite.wallet)}.`
            : `Sent. The company will confirm wallet ${short(done.wallet)}${done.verified ? ' (verified by signature)' : ''}, then you'll be in their next pay run.`}
        </div>
      )}
    </div>
  );
}
