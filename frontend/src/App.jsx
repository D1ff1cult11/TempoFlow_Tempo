import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { DemoBanner } from './components/DemoBanner';
import { MerchantTerminal } from './components/MerchantTerminal';
import { PayrollOdometer } from './components/PayrollOdometer';
import { TreasuryVault } from './components/TreasuryVault';
import { SettlementModal } from './components/SettlementModal';
import { CompanySetup } from './components/control/CompanySetup';
import { AgentsPanel } from './components/control/AgentsPanel';
import { PeoplePanel } from './components/control/PeoplePanel';
import { LedgerPanel } from './components/control/LedgerPanel';
import { TreasuryPanel } from './components/control/TreasuryPanel';
import { Bot, Users, BookOpen, ArrowRightLeft, FlaskConical, Github } from 'lucide-react';

const TABS = [
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'people', label: 'People', icon: Users },
  { id: 'ledger', label: 'Ledger', icon: BookOpen },
  { id: 'treasury', label: 'Treasury', icon: ArrowRightLeft },
  { id: 'demos', label: 'Prototype demos', icon: FlaskConical },
];

const initialTab = () => {
  const h = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === h) ? h : 'agents';
};

export default function App() {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      {tab === 'demos' && <DemoBanner />}

      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '24px', flex: 1 }}>
        <div style={{ marginBottom: '22px' }}>
          <h1 style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
            fontWeight: 800,
            fontFamily: 'var(--font-sans)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}>
            One treasury for your people and your AI agents
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '8px', maxWidth: '820px', lineHeight: 1.55 }}>
            Give every agent its own budget, allowed payees and expiry, enforced by Tempo itself. Pay contractors in one
            batched transaction. See all spending, for people and agents, in one ledger. Live on Tempo testnet with free
            test stablecoins.
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <CompanySetup />
        </div>

        <div className="cp-tabs" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" className="cp-tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === 'agents' && <AgentsPanel />}
        {tab === 'people' && <PeoplePanel />}
        {tab === 'ledger' && <LedgerPanel />}
        {tab === 'treasury' && <TreasuryPanel />}
        {tab === 'demos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div className="cp-note warn">
              These are early prototypes and are fully simulated in your browser: merchant checkout, per-second
              streaming payroll and a merchant vault. Their contracts are not deployed yet.
            </div>
            <MerchantTerminal />
            <PayrollOdometer />
            <TreasuryVault />
          </div>
        )}
      </main>

      <SettlementModal />

      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(6, 8, 13, 0.95)',
        padding: '24px 16px',
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
            <strong>TempoFlow</strong> • Spend controls for people and AI agents on Tempo
          </div>
          <a
            href="https://github.com/D1ff1cult11/TempoFlow_Tempo"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Github size={15} />
            GitHub Repository
          </a>
        </div>
      </footer>
    </div>
  );
}
