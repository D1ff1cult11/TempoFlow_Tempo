import React, { useState } from 'react';
import { useTempoStore } from '../store/useTempoStore';
import {
  Vault,
  ArrowDownToLine,
  Settings2,
  RefreshCw,
  Sparkles,
  DollarSign,
  Euro,
  SplitSquareHorizontal,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// ─── Tiny animated number component ───────────────────────────────────────────
function AnimatedBalance({ value, symbol }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
      {value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>{symbol}</span>
    </span>
  );
}

// ─── Token Balance Card ────────────────────────────────────────────────────────
function TokenCard({ symbol, balance, icon: Icon, color, glow, isLoading, onWithdraw, isDemoMode }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, rgba(15,21,32,0.9) 0%, rgba(11,15,23,0.95) 100%)`,
        border: `1px solid ${color}33`,
        borderRadius: '14px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        transition: 'all 0.25s ease',
        boxShadow: isLoading ? `0 0 20px ${glow}` : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow shimmer overlay while loading */}
      {isLoading && (
        <div
          className="shimmer-bg"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '14px',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Token Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: `${color}22`,
              border: `1px solid ${color}55`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={20} color={color} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-sans)', fontSize: '1rem', color: '#fff' }}>
              {symbol}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {symbol === 'USDC' ? 'USD Coin · Tempo L1' : 'Euro Coin · Tempo L1'}
            </div>
          </div>
        </div>

        <div
          className="badge-pill"
          style={{
            background: `${color}18`,
            color,
            border: `1px solid ${color}44`,
            fontSize: '0.7rem',
          }}
        >
          Non-Custodial
        </div>
      </div>

      {/* Balance Display */}
      <div
        style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '10px',
          padding: '14px 16px',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
          VAULT BALANCE
        </div>
        <div style={{ fontSize: '1.6rem', color, letterSpacing: '-0.02em' }}>
          <AnimatedBalance value={balance} symbol={symbol} />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          ≈ ${(balance * (symbol === 'EURC' ? 1.088 : 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
        </div>
      </div>

      {/* Withdraw Button */}
      <button
        onClick={() => onWithdraw(symbol)}
        style={{
          background: isDemoMode ? `${color}22` : `${color}33`,
          border: `1px solid ${color}55`,
          color,
          borderRadius: '8px',
          padding: '9px 14px',
          fontSize: '0.82rem',
          fontWeight: 700,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          transition: 'all 0.2s ease',
          width: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${color}40`;
          e.currentTarget.style.boxShadow = `0 0 16px ${glow}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isDemoMode ? `${color}22` : `${color}33`;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <ArrowDownToLine size={15} />
        Withdraw {symbol} to Wallet
      </button>
    </div>
  );
}

// ─── Main TreasuryVault Component ─────────────────────────────────────────────
export function TreasuryVault() {
  const {
    isDemoMode,
    merchantVaultUSDC,
    merchantVaultEURC,
    merchantSplitBps,
    walletBalanceUSDC,
    walletBalanceEURC,
    connectedAddress,
    withdrawFromVault,
    setMerchantSplitBps,
    refreshVaultBalances,
    isVaultLoading,
  } = useTempoStore();

  const [localSplitBps, setLocalSplitBps] = useState(merchantSplitBps);
  const [splitSaved, setSplitSaved] = useState(false);

  const splitPct = (localSplitBps / 100).toFixed(0);
  const totalVaultUSD = merchantVaultUSDC + merchantVaultEURC * 1.088;

  const handleSaveSplit = () => {
    setMerchantSplitBps(localSplitBps);
    setSplitSaved(true);
    setTimeout(() => setSplitSaved(false), 2000);
  };

  return (
    <div className="glass-panel" style={{ padding: '28px', marginBottom: '28px' }}>
      {/* ── Panel Header ────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(0,210,106,0.3) 0%, rgba(0,240,255,0.2) 100%)',
                border: '1px solid rgba(0,210,106,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Vault size={17} color="var(--tempo-emerald)" />
            </div>
            <h2
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                fontFamily: 'var(--font-sans)',
                letterSpacing: '-0.02em',
                color: '#fff',
              }}
            >
              Merchant Settlement Vault
            </h2>
            {isDemoMode && (
              <span className="badge-pill badge-emerald" style={{ fontSize: '0.68rem' }}>
                <Sparkles size={10} /> Demo Mode
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '560px', lineHeight: 1.5 }}>
            Non-custodial multi-stablecoin treasury. All settled payments land here with automatic
            revenue-split forwarding to payroll reserve.
          </p>
        </div>

        {/* Refresh + Total TVL */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <button
            onClick={refreshVaultBalances}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <RefreshCw size={14} />
            Refresh On-Chain
          </button>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              textAlign: 'right',
            }}
          >
            Total TVL:{' '}
            <span style={{ color: 'var(--tempo-emerald)', fontWeight: 700 }}>
              ${totalVaultUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* ── Token Balance Cards ──────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <TokenCard
          symbol="USDC"
          balance={merchantVaultUSDC}
          icon={DollarSign}
          color="#00D26A"
          glow="rgba(0,210,106,0.25)"
          isLoading={isVaultLoading}
          onWithdraw={withdrawFromVault}
          isDemoMode={isDemoMode}
        />
        <TokenCard
          symbol="EURC"
          balance={merchantVaultEURC}
          icon={Euro}
          color="#00F0FF"
          glow="rgba(0,240,255,0.2)"
          isLoading={isVaultLoading}
          onWithdraw={withdrawFromVault}
          isDemoMode={isDemoMode}
        />
      </div>

      {/* ── Auto-Split Revenue Forwarder ─────────────────── */}
      <div
        style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <SplitSquareHorizontal size={16} color="var(--tempo-cyan)" />
          <span
            style={{
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              fontSize: '0.9rem',
              color: '#fff',
            }}
          >
            Auto-Split Revenue Forwarder
          </span>
          <span className="badge-pill badge-cyan" style={{ fontSize: '0.68rem' }}>
            Configurable
          </span>
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
          Incoming settlement automatically forwards a slice to the payroll reserve fund. Configured
          in <code style={{ color: 'var(--tempo-cyan)' }}>MerchantSettlementVault.sol</code>.
        </p>

        {/* Slider Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>Merchant keeps</span>
              <span style={{ color: 'var(--tempo-emerald)', fontWeight: 700 }}>{100 - parseInt(splitPct)}%</span>
            </div>
            <input
              id="auto-split-slider"
              type="range"
              min={0}
              max={50}
              step={5}
              value={localSplitBps / 100}
              onChange={(e) => {
                setLocalSplitBps(parseInt(e.target.value) * 100);
                setSplitSaved(false);
              }}
              style={{
                width: '100%',
                accentColor: 'var(--tempo-emerald)',
                cursor: 'pointer',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '4px',
                fontSize: '0.72rem',
                color: 'var(--text-dim)',
              }}
            >
              <span>0% split</span>
              <span>Payroll reserve: <strong style={{ color: 'var(--tempo-cyan)' }}>{splitPct}%</strong></span>
              <span>50% max</span>
            </div>
          </div>

          <button
            onClick={handleSaveSplit}
            style={{
              background: splitSaved
                ? 'rgba(0,210,106,0.2)'
                : 'rgba(255,255,255,0.06)',
              border: splitSaved
                ? '1px solid var(--tempo-emerald)'
                : '1px solid var(--border-subtle)',
              color: splitSaved ? 'var(--tempo-emerald)' : 'var(--text-main)',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {splitSaved ? <CheckCircle2 size={15} /> : <Settings2 size={15} />}
            {splitSaved ? 'Saved!' : 'Apply Split'}
          </button>
        </div>
      </div>

      {/* ── Wallet Balances Row (when connected / demo) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginTop: '18px',
          padding: '12px 16px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.05)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          WALLET BALANCES
        </span>
        <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
          USDC:{' '}
          <strong style={{ color: 'var(--tempo-emerald)', fontFamily: 'var(--font-mono)' }}>
            {walletBalanceUSDC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </span>
        <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
          EURC:{' '}
          <strong style={{ color: 'var(--tempo-cyan)', fontFamily: 'var(--font-mono)' }}>
            {walletBalanceEURC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </span>
        {connectedAddress && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            {connectedAddress.slice(0, 8)}…{connectedAddress.slice(-6)}
          </span>
        )}
        {!connectedAddress && isDemoMode && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
            Simulated demo balances
          </span>
        )}
      </div>
    </div>
  );
}
