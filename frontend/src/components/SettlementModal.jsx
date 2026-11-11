import React from 'react';
import { useTempoStore } from '../store/useTempoStore';
import { CheckCircle2, X, ExternalLink, ShieldCheck, Zap } from 'lucide-react';

export function SettlementModal() {
  const { activeReceipt, closeReceipt } = useTempoStore();

  if (!activeReceipt) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '440px',
        width: '100%',
        padding: '28px',
        background: '#0B0F17',
        border: '1px solid rgba(0, 210, 106, 0.4)',
        boxShadow: '0 0 50px rgba(0, 210, 106, 0.25)',
        position: 'relative',
      }}>
        {/* Close Button */}
        <button
          onClick={closeReceipt}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        {/* Success Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'rgba(0, 210, 106, 0.15)',
            border: '1px solid var(--tempo-emerald)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            color: 'var(--tempo-emerald)',
          }}>
            <CheckCircle2 size={32} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-sans)', color: '#FFFFFF' }}>
            {activeReceipt.isOnChain ? 'Payment Settled' : 'Payment Settled (simulated)'}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {activeReceipt.isOnChain ? 'Confirmed on Tempo' : 'Demo receipt: no real transaction was made'}
          </p>
        </div>

        {/* Receipt Details Table */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          fontSize: '0.82rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Order ID / Hash:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>{activeReceipt.hash}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Gross Amount Paid:</span>
            <span style={{ fontWeight: 700, color: '#FFFFFF' }}>{activeReceipt.amountIn}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Merchant Net Credited:</span>
            <span style={{ fontWeight: 700, color: 'var(--tempo-emerald)' }}>{activeReceipt.amountOut}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Protocol Fee (10 bps):</span>
            <span style={{ color: 'var(--tempo-cyan)' }}>{activeReceipt.fee}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Status:</span>
            <span style={{ color: 'var(--tempo-emerald)', fontWeight: 600 }}>
              {activeReceipt.isOnChain ? 'Confirmed on-chain' : 'Simulated (0.62s)'}
            </span>
          </div>

          {activeReceipt.explorerUrl && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <a
                href={activeReceipt.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--tempo-cyan)',
                  textDecoration: 'none',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600,
                }}
              >
                Inspect On Tempo Block Explorer <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeReceipt.explorerUrl && (
            <a
              href={activeReceipt.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', fontSize: '0.88rem' }}
            >
              Explorer ↗
            </a>
          )}
          <button
            onClick={closeReceipt}
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Close Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
