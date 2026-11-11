import React from 'react';
import { useTempoStore } from '../store/useTempoStore';
import { ArrowRight, Shield, Cpu, Zap, CheckCircle2 } from 'lucide-react';

export function CrossChainRelay() {
  const { relayerStep, relayerLatencyMs } = useTempoStore();

  const steps = [
    {
      id: 'SOLANA_LOCK',
      name: '1. Solana Ingress (Anchor)',
      desc: 'SPL-USDC held in program escrow; payer can reclaim after 1h timeout',
      active: relayerStep === 'SOLANA_LOCK',
      done: relayerStep === 'RELAYER_TRANSIT' || relayerStep === 'TEMPO_FINALITY',
      color: 'var(--solana-purple)',
    },
    {
      id: 'RELAYER_TRANSIT',
      name: '2. Relayer (planned)',
      desc: 'Forwards the payment intent to the Tempo recipient address (not built yet)',
      active: relayerStep === 'RELAYER_TRANSIT',
      done: relayerStep === 'TEMPO_FINALITY',
      color: 'var(--tempo-cyan)',
    },
    {
      id: 'TEMPO_FINALITY',
      name: '3. Tempo Settlement',
      desc: 'TempoFlowRouter pays the merchant, minus a 10 bps protocol fee',
      active: relayerStep === 'TEMPO_FINALITY',
      done: false,
      color: 'var(--tempo-emerald)',
    },
  ];

  return (
    <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-sans)', color: '#FFFFFF' }}>
            Cross-Chain Payment Flow
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Solana payment ──► Tempo settlement (simulated, {relayerLatencyMs}ms)
          </p>
        </div>
        <div className="badge-pill badge-solana">
          Simulated
        </div>
      </div>

      {/* Visual Pipeline Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '12px',
        position: 'relative',
      }}>
        {steps.map((step, idx) => (
          <div
            key={step.id}
            style={{
              background: step.active
                ? 'rgba(0, 210, 106, 0.12)'
                : 'rgba(255, 255, 255, 0.03)',
              border: step.active
                ? '1px solid var(--tempo-emerald)'
                : '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px',
              transition: 'all 0.3s ease',
              boxShadow: step.active ? '0 0 20px rgba(0, 210, 106, 0.25)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: step.active ? 'var(--tempo-emerald)' : '#FFFFFF',
                fontFamily: 'var(--font-sans)',
              }}>
                {step.name}
              </span>
              {step.done ? (
                <CheckCircle2 size={16} color="var(--tempo-emerald)" />
              ) : step.active ? (
                <span className="pulse-dot"></span>
              ) : (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  0{idx + 1}
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
