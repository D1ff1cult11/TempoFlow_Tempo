import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { DemoBanner } from './components/DemoBanner';
import { MerchantTerminal } from './components/MerchantTerminal';
import { PayrollOdometer } from './components/PayrollOdometer';
import { TreasuryVault } from './components/TreasuryVault';
import { CrossChainRelay } from './components/CrossChainRelay';
import { SettlementModal } from './components/SettlementModal';
import { Store, Timer, ExternalLink, Github, BookOpen, Award, Vault } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'MERCHANT' | 'PAYROLL' | 'TREASURY'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header & Live Telemetry Navbar */}
      <Navbar />

      {/* 2. Top sticky demo simulation bar */}
      <DemoBanner />

      {/* 3. Main Protocol Terminal Workspace */}
      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '24px', flex: 1 }}>
        {/* Hero Value Proposition Card */}
        <div style={{
          marginBottom: '28px',
          padding: '24px 28px',
          background: 'linear-gradient(135deg, rgba(15, 21, 32, 0.8) 0%, rgba(11, 15, 23, 0.9) 100%)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="badge-pill badge-emerald">Tempo L1 Ecosystem</span>
                <span className="badge-pill badge-solana">Solana Retail Ingress</span>
              </div>
              <h1 style={{
                fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
                fontWeight: 800,
                fontFamily: 'var(--font-sans)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}>
                Stablecoin payments &amp; payroll on Tempo
              </h1>
              <p style={{
                fontSize: '0.92rem',
                color: 'var(--text-muted)',
                marginTop: '8px',
                maxWidth: '780px',
                lineHeight: 1.5,
              }}>
                Accept stablecoin payments with a <strong>10 bps protocol fee</strong>, convert between currencies, and stream contractor salaries that accrue every second. Early prototype: in Demo Mode everything below is simulated.
              </p>
            </div>

            {/* Quick Portal Switcher Tabs */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveTab('ALL')}
                className={activeTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.85rem' }}
              >
                All Systems View
              </button>
              <button
                onClick={() => setActiveTab('MERCHANT')}
                className={activeTab === 'MERCHANT' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.85rem' }}
              >
                <Store size={15} />
                Merchant POS
              </button>
              <button
                onClick={() => setActiveTab('PAYROLL')}
                className={activeTab === 'PAYROLL' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.85rem' }}
              >
                <Timer size={15} />
                Payroll Odometer
              </button>
              <button
                onClick={() => setActiveTab('TREASURY')}
                className={activeTab === 'TREASURY' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.85rem' }}
              >
                <Vault size={15} />
                Treasury Vault
              </button>
            </div>
          </div>
        </div>

        {/* 4. Cross-Chain Telemetry Pipeline Visualizer */}
        <CrossChainRelay />

        {/* 5. Core Portals Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {(activeTab === 'ALL' || activeTab === 'MERCHANT') && (
            <section>
              <MerchantTerminal />
            </section>
          )}

          {(activeTab === 'ALL' || activeTab === 'PAYROLL') && (
            <section>
              <PayrollOdometer />
            </section>
          )}

          {(activeTab === 'ALL' || activeTab === 'TREASURY') && (
            <section>
              <TreasuryVault />
            </section>
          )}
        </div>
      </main>

      {/* 6. Cryptographic Settlement Receipt Modal */}
      <SettlementModal />

      {/* 7. Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(6, 8, 13, 0.95)',
        padding: '24px',
        marginTop: '40px',
        fontSize: '0.82rem',
        color: 'var(--text-dim)',
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
          <div>
            <strong>TempoFlow</strong> • Stablecoin payments & streaming payroll on Tempo
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <a
              href="https://github.com/D1ff1cult11/TempoFlow_Tempo"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Github size={15} />
              GitHub Repository
            </a>
            <span style={{ color: 'var(--tempo-emerald)' }}>
              MIT Licensed Public Good
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
