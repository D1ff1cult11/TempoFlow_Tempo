import React from 'react';
import { Zap, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../store/useWorkspace';

export function Navbar() {
  const ws = useWorkspace();

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(6, 8, 13, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 16px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00D26A 0%, #00F0FF 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(0, 210, 106, 0.4)',
            }}>
              <Zap size={20} color="#06080D" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Tempo<span className="gradient-text-emerald">Flow</span>
            </span>
          </div>
          <div className="badge-pill badge-emerald">
            <span className="pulse-dot"></span>
            Tempo testnet
          </div>
        </div>

        {ws.company && (
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
            {ws.company.address.slice(0, 6)}...{ws.company.address.slice(-4)}
          </div>
        )}
      </div>
    </header>
  );
}
