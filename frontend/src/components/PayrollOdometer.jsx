import React from 'react';
import { useTempoStore } from '../store/useTempoStore';
import { Timer, ArrowDownCircle, Download, FastForward, CheckCircle2, TrendingUp, ShieldCheck } from 'lucide-react';

export function PayrollOdometer() {
  const {
    isDemoMode,
    streamClaimableBalance,
    streamTotalAccrued,
    streamRemainingEscrow,
    streamRatePerSecond,
    streamEmployeeAddress,
    claimSalary,
    simulateTimeWarp,
  } = useTempoStore();

  const handleDownloadProof = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      "Timestamp,Employer,Employee,Token,RatePerSecond,ClaimableBalance,Network,Finality\n" +
      `${new Date().toISOString()},0xf39F...2266,${streamEmployeeAddress},USDC,$${streamRatePerSecond.toFixed(7)},$${streamClaimableBalance.toFixed(6)},Tempo,Simulated`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TempoFlow_Income_Certificate_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
      {/* Background Accent Glow */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '180px',
        height: '180px',
        background: 'radial-gradient(circle, rgba(0, 210, 106, 0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(0, 240, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--tempo-cyan)',
          }}>
            <Timer size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-sans)', color: '#FFFFFF' }}>
              Streaming Payroll
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Salary accrues every second; withdraw any time
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="badge-pill badge-emerald">
            <span className="pulse-dot"></span>
            Simulated
          </div>
        </div>
      </div>

      {/* The Odometer Display */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(11, 15, 23, 0.9) 0%, rgba(6, 8, 13, 0.95) 100%)',
        border: '1px solid rgba(0, 210, 106, 0.3)',
        borderRadius: '16px',
        padding: '28px 24px',
        textAlign: 'center',
        marginBottom: '24px',
        boxShadow: '0 0 30px rgba(0, 210, 106, 0.12)',
      }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Accrued Unclaimed Earnings
        </div>
        
        {/* Living Monospace Numbers */}
        <div style={{
          fontSize: 'clamp(2.4rem, 6vw, 3.8rem)',
          fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color: '#FFFFFF',
          letterSpacing: '-0.02em',
          textShadow: '0 0 24px rgba(0, 210, 106, 0.4)',
        }}>
          $<span style={{ color: 'var(--tempo-emerald)' }}>
            {streamClaimableBalance.toFixed(6)}
          </span>
          <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginLeft: '6px' }}>USDC</span>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '10px',
          padding: '4px 14px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '9999px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          <TrendingUp size={14} color="var(--tempo-cyan)" />
          Flow Velocity: ${(streamRatePerSecond * 3600).toFixed(2)} / hour • $0.003805 / sec
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Annualized Wage</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#FFFFFF', marginTop: '2px' }}>
            $120,000 / yr
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Streamed to Date</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--tempo-cyan)', marginTop: '2px' }}>
            ${streamTotalAccrued.toFixed(2)}
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Remaining Escrow</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#FFFFFF', marginTop: '2px' }}>
            ${streamRemainingEscrow.toFixed(2)}
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Network Fees</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--tempo-emerald)', marginTop: '2px' }}>
            Paid in stablecoins
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={claimSalary}
          disabled={streamClaimableBalance <= 0}
          className="btn-primary"
          style={{
            flex: 2,
            justifyContent: 'center',
            padding: '14px 20px',
            fontSize: '1rem',
            background: !isDemoMode ? 'linear-gradient(135deg, #00D26A 0%, #00F0FF 100%)' : undefined,
            color: !isDemoMode ? '#07090E' : undefined,
            fontWeight: 700,
          }}
        >
          <ArrowDownCircle size={20} />
          {!isDemoMode
            ? `Withdraw Salary On-Chain ($${streamClaimableBalance.toFixed(2)})`
            : `Claim Earned Salary ($${streamClaimableBalance.toFixed(2)})`}
        </button>

        <button
          onClick={() => simulateTimeWarp(24)}
          className="btn-secondary"
          style={{ flex: 1, justifyContent: 'center', borderColor: 'rgba(0, 240, 255, 0.4)', color: 'var(--tempo-cyan)' }}
        >
          <FastForward size={16} />
          Fast-Forward 24H (+$240)
        </button>

        <button
          onClick={handleDownloadProof}
          className="btn-secondary"
          style={{ justifyContent: 'center' }}
          title="Download a CSV of this stream (demo data)"
        >
          <Download size={16} />
          Export Proof
        </button>
      </div>
    </div>
  );
}
