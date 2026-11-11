import React from 'react';
import { useTempoStore } from '../store/useTempoStore';
import { Zap, ShieldCheck, Wallet, Sparkles, Award } from 'lucide-react';

export function Navbar() {
  const {
    isDemoMode,
    toggleDemoMode,
    connectedAddress,
    connectWallet,
    mintTestnetFaucet,
    isConnecting,
  } = useTempoStore();

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(6, 8, 13, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 24px',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        {/* Brand & Track Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00D26A 0%, #00F0FF 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(0, 210, 106, 0.4)',
            }}>
              <Zap size={22} color="#06080D" strokeWidth={2.5} />
            </div>
            <div>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 800,
                fontSize: '1.25rem',
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
              }}>
                Tempo<span className="gradient-text-emerald">Flow</span>
              </span>
            </div>
          </div>

          {/* Network Health Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="badge-pill badge-emerald">
              <span className="pulse-dot"></span>
              Tempo L1 (0.6s)
            </div>
            <div className="badge-pill badge-solana">
              Solana Ingress
            </div>
          </div>
        </div>

        {/* Right Section: Mode Switcher + Live Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Mode Switcher Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
          }}>
            <button
              onClick={() => toggleDemoMode(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isDemoMode ? 'var(--tempo-emerald)' : 'transparent',
                color: isDemoMode ? '#06080D' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
              }}
            >
              <Sparkles size={14} />
              Demo Mode
            </button>
            <button
              onClick={() => toggleDemoMode(false)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: !isDemoMode ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                color: !isDemoMode ? 'var(--tempo-cyan)' : 'var(--text-muted)',
                border: !isDemoMode ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <Wallet size={14} />
              Live Web3 Mode
            </button>
          </div>

          {/* Testnet Faucet Button (Live Mode) */}
          {!isDemoMode && (
            <button
              onClick={() => mintTestnetFaucet('USDC')}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '6px 12px' }}
            >
              💧 Mint +1,000 USDC
            </button>
          )}

          {/* Wallet Button */}
          {connectedAddress ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: 'rgba(0, 210, 106, 0.1)',
              border: '1px solid rgba(0, 210, 106, 0.3)',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              color: 'var(--tempo-emerald)',
            }}>
              <ShieldCheck size={16} />
              {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="btn-secondary"
              disabled={isConnecting}
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            >
              <Wallet size={15} />
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
