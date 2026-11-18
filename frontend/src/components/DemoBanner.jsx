import React from 'react';
import { useTempoStore } from '../store/useTempoStore';
import { Sparkles, FastForward, ArrowRightLeft, Send, CheckCircle2 } from 'lucide-react';

export function DemoBanner() {
  const {
    isDemoMode,
    simulateSolanaPayment,
    simulateTimeWarp,
    simulateFXSwap,
    relayerStep,
    connectedAddress,
    connectWallet,
    mintTestnetFaucet,
    addTempoNetworkToMetamask,
  } = useTempoStore();

  if (!isDemoMode) {
    return (
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
        padding: '10px 24px',
        boxShadow: 'none',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="pulse-dot"></span>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                Live Web3 Mode (not available yet)
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                TempoFlow's contracts are not deployed to Tempo yet, so on-chain actions here will fail. Use Demo Mode to try the product.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {!connectedAddress ? (
              <>
                <button
                  onClick={connectWallet}
                  className="btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  Connect Wallet
                </button>
                <button
                  onClick={addTempoNetworkToMetamask}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px', borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)', color: 'var(--tempo-cyan)' }}
                >
                  + Add Tempo L1 to MetaMask
                </button>
              </>
            ) : (
              <>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                  border: '1px solid var(--tempo-emerald)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--tempo-emerald)',
                }}>
                  {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                </div>
                <button
                  onClick={() => mintTestnetFaucet('USDC')}
                  className="btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 10px', color: 'var(--tempo-emerald)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}
                >
                  🚰 Mint 1,000 USDC Faucet
                </button>
                <button
                  onClick={() => mintTestnetFaucet('EURC')}
                  className="btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 10px', color: 'var(--tempo-cyan)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}
                >
                  🚰 Mint 1,000 EURC
                </button>
                <a
                  href="https://explorer.testnet.tempo.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 10px', color: 'var(--text-muted)' }}
                >
                  Explorer ↗
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
      padding: '12px 24px',
      boxShadow: 'none',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--tempo-emerald)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-ink)',
          }}>
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              Demo Mode (simulated, no wallet needed)
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Try payments, payroll and currency conversion in a browser simulation. No wallet or real funds involved:
            </div>
          </div>
        </div>

        {/* 3 Instant Action Triggers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => simulateSolanaPayment(50.0)}
            disabled={relayerStep !== 'IDLE'}
            className="btn-primary"
            style={{ fontSize: '0.82rem', padding: '8px 14px' }}
          >
            <Send size={14} />
            {relayerStep === 'IDLE' ? '1. Simulate a $50 customer payment' : 'Processing Settlement...'}
          </button>

          <button
            onClick={() => simulateTimeWarp(24)}
            className="btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '8px 14px',
              borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
              color: 'var(--tempo-cyan)',
            }}
          >
            <FastForward size={14} />
            2. Fast-Forward 24H Payroll
          </button>

          <button
            onClick={() => simulateFXSwap(100.0)}
            className="btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '8px 14px',
              borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
              color: 'var(--tempo-emerald)',
            }}
          >
            <ArrowRightLeft size={14} />
            3. Simulate Currency Conversion (USDC→EURC)
          </button>
        </div>
      </div>
    </div>
  );
}
