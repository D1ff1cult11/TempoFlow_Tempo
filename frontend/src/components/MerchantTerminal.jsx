import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useTempoStore } from '../store/useTempoStore';
import { Store, QrCode, ArrowDownRight, RefreshCw, CheckCircle, ExternalLink, Zap } from 'lucide-react';

export function MerchantTerminal() {
  const [posAmount, setPosAmount] = useState('50.00');
  const [qrTab, setQrTab] = useState('SOLANA'); // 'SOLANA' | 'TEMPO'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const qrCanvasRef = useRef(null);

  const {
    isDemoMode,
    connectedAddress,
    connectWallet,
    executePayment,
    merchantVaultUSDC,
    merchantVaultEURC,
    selectedSettleCurrency,
    setSelectedSettleCurrency,
    relayerStep,
    transactions,
  } = useTempoStore();

  // Generate real dynamic QR code whenever amount or tab changes
  useEffect(() => {
    const payload = qrTab === 'SOLANA'
      ? `solana:TempoF1owIngress111111111111111111111111111?amount=${posAmount}&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&reference=TEMPO-${Date.now()}`
      : `ethereum:0x0165878A594ca255338adfa4d48449f69242Eb8F@4242?value=${posAmount}&token=USDC`;

    QRCode.toDataURL(payload, {
      width: 180,
      margin: 1,
      color: {
        dark: qrTab === 'SOLANA' ? '#9945FF' : '#00D26A',
        light: '#07090E',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error(err));
  }, [posAmount, qrTab]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
      {/* Card 1: Merchant Point-of-Sale (POS) Keypad & QR Generator */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(0, 210, 106, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--tempo-emerald)',
            }}>
              <Store size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                Merchant Point-of-Sale
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Accept stablecoin payments on Tempo (Solana intake simulated)
              </p>
            </div>
          </div>
          <div className="badge-pill badge-emerald">
            <span className="pulse-dot"></span>
            Simulated
          </div>
        </div>

        {/* Currency Auto-FX Mode Switcher */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Settle in (currency conversion uses a mock rate):
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSelectedSettleCurrency('USDC')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: selectedSettleCurrency === 'USDC' ? 'var(--tempo-emerald)' : 'rgba(255, 255, 255, 0.06)',
                color: selectedSettleCurrency === 'USDC' ? '#06080D' : 'var(--text-muted)',
              }}
            >
              💵 Settle in USD (USDC)
            </button>
            <button
              onClick={() => setSelectedSettleCurrency('EURC')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: selectedSettleCurrency === 'EURC' ? 'var(--tempo-cyan)' : 'rgba(255, 255, 255, 0.06)',
                color: selectedSettleCurrency === 'EURC' ? '#06080D' : 'var(--text-muted)',
              }}
            >
              💶 Auto-Convert EUR (EURC)
            </button>
          </div>
        </div>

        {/* Amount Input & Preset Chips */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Invoice Amount ($ USD)
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '1.2rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>$</span>
            <input
              type="number"
              value={posAmount}
              onChange={(e) => setPosAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 32px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono)',
                fontSize: '1.25rem',
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {['10.00', '25.00', '50.00', '100.00'].map((chip) => (
              <button
                key={chip}
                onClick={() => setPosAmount(chip)}
                style={{
                  flex: 1,
                  padding: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                }}
              >
                ${chip}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Dual QR Code Display */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          padding: '16px',
          textAlign: 'center',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => setQrTab('SOLANA')}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: qrTab === 'SOLANA' ? 'rgba(153, 69, 255, 0.25)' : 'transparent',
                color: qrTab === 'SOLANA' ? '#C084FC' : 'var(--text-muted)',
                borderBottom: qrTab === 'SOLANA' ? '2px solid #9945FF' : '2px solid transparent',
              }}
            >
              Solana Pay (Phantom)
            </button>
            <button
              onClick={() => setQrTab('TEMPO')}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: qrTab === 'TEMPO' ? 'rgba(0, 210, 106, 0.25)' : 'transparent',
                color: qrTab === 'TEMPO' ? 'var(--tempo-emerald)' : 'var(--text-muted)',
                borderBottom: qrTab === 'TEMPO' ? '2px solid var(--tempo-emerald)' : '2px solid transparent',
              }}
            >
              Tempo L1 (EVM QR)
            </button>
          </div>

          {qrDataUrl && (
            <div style={{ display: 'inline-block', padding: '8px', background: '#07090E', borderRadius: '10px' }}>
              <img src={qrDataUrl} alt="Payment QR Code" style={{ display: 'block', borderRadius: '6px' }} />
            </div>
          )}

          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
            Example payment QR (demo only)
          </div>
        </div>

        {/* Pay Action Trigger (Dynamic: Live Web3 on-chain vs Demo sandbox) */}
        {!isDemoMode && !connectedAddress ? (
          <button
            onClick={connectWallet}
            className="btn-action-solana"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            <Zap size={18} />
            Connect Wallet to Pay on Tempo
          </button>
        ) : (
          <button
            onClick={() => executePayment(parseFloat(posAmount) || 50)}
            disabled={relayerStep !== 'IDLE'}
            className="btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px',
              background: !isDemoMode ? 'linear-gradient(135deg, #00D26A 0%, #00F0FF 100%)' : undefined,
              color: !isDemoMode ? '#07090E' : undefined,
              fontWeight: 700,
            }}
          >
            <Zap size={18} />
            {relayerStep !== 'IDLE'
              ? 'Processing payment...'
              : !isDemoMode
              ? `Pay $${posAmount} On-Chain (Tempo)`
              : `Simulate Customer Paying $${posAmount} (Demo Sandbox)`}
          </button>
        )}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
          {!isDemoMode
            ? 'Live Mode: calls TempoFlowRouter.sol (requires a real deployment) • 10 bps fee'
            : 'Demo Mode: simulated payment with sound and receipt. No real funds move'}
        </div>
      </div>

      {/* Card 2: Merchant Settlement Treasury & Real-time Live Ticker */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Non-Custodial Settlement Vaults
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Separate balances per stablecoin
            </p>
          </div>
          <div className="badge-pill badge-cyan">
            Fee: 10 bps (0.10%)
          </div>
        </div>

        {/* Treasury Balances Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            background: 'rgba(0, 210, 106, 0.06)',
            border: '1px solid rgba(0, 210, 106, 0.2)',
            borderRadius: '10px',
            padding: '14px',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>USDC Treasury Vault</div>
            <div style={{
              fontSize: '1.45rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--tempo-emerald)',
              marginTop: '4px',
            }}>
              ${merchantVaultUSDC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Auto-forwarding: 20% to Payroll
            </div>
          </div>

          <div style={{
            background: 'rgba(0, 240, 255, 0.06)',
            border: '1px solid rgba(0, 240, 255, 0.2)',
            borderRadius: '10px',
            padding: '14px',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>EURC Treasury Vault</div>
            <div style={{
              fontSize: '1.45rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--tempo-cyan)',
              marginTop: '4px',
            }}>
              €{merchantVaultEURC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Converted at mock rate
            </div>
          </div>
        </div>

        {/* Live Incoming Settlement Stream Ticker */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={14} className="pulse-dot" style={{ display: 'inline-block' }} />
              Settlement Feed (simulated)
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Auto-Refresh</span>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {transactions.map((tx) => (
              <div
                key={tx.id}
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF' }}>{tx.amountIn}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--tempo-cyan)' }}>→ {tx.amountOut}</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {tx.type} • {tx.hash}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--tempo-emerald)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <CheckCircle size={12} />
                    {tx.status}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                    {tx.timestamp}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
