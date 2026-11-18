import React, { useEffect, useState } from 'react';
import { AppShell, PageHead, PAGES, EXTRA_PAGES } from './components/layout/AppShell';
import { Overview } from './components/control/Overview';
import { AgentsPanel } from './components/control/AgentsPanel';
import { PeoplePanel } from './components/control/PeoplePanel';
import { LedgerPanel } from './components/control/LedgerPanel';
import { TreasuryPanel } from './components/control/TreasuryPanel';
import { DemoBanner } from './components/DemoBanner';
import { MerchantTerminal } from './components/MerchantTerminal';
import { PayrollOdometer } from './components/PayrollOdometer';
import { TreasuryVault } from './components/TreasuryVault';
import { SettlementModal } from './components/SettlementModal';
import { actions, useWorkspace } from './store/useWorkspace';
import { CompanySetup } from './components/control/CompanySetup';

const HEADS = {
  overview: {
    title: 'One treasury for your people and your AI agents',
    sub: 'Budgets enforced by Tempo, batched pay runs and one ledger. Live on Tempo testnet with free test stablecoins.',
  },
  agents: {
    title: 'Agents',
    sub: 'Each agent gets its own key with a daily limit, allowed payees and an expiry. Tempo rejects anything outside them.',
  },
  people: { title: 'People', sub: 'Pay contractors in one transaction, each payout tagged with its invoice number.' },
  ledger: { title: 'Ledger', sub: 'Every payment from your treasury, rebuilt from the chain and matched to the agent or person.' },
  treasury: { title: 'Treasury', sub: 'Convert between stablecoins at live rates from Tempo’s built-in exchange.' },
  demos: { title: 'Prototype demos', sub: 'Earlier ideas, fully simulated in your browser. Their contracts are not deployed.' },
};

const ALL = [...PAGES, ...EXTRA_PAGES].map((p) => p.id);
const fromHash = () => {
  const h = window.location.hash.replace('#', '');
  return ALL.includes(h) ? h : 'overview';
};

export default function App() {
  const [page, setPage] = useState(fromHash);
  const ws = useWorkspace();

  useEffect(() => {
    actions.checkRelay();
    const onHash = () => setPage(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (id) => {
    setPage(id);
    history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0 });
  };

  return (
    <AppShell page={page} onNavigate={navigate}>
      {page === 'demos' && <DemoBanner />}
      <main className="page">
        <PageHead title={HEADS[page].title} sub={HEADS[page].sub} />
        {!ws.company && !['overview', 'demos'].includes(page) && (
          <div style={{ marginBottom: 20 }}>
            <CompanySetup />
          </div>
        )}
        {page === 'overview' && <Overview onNavigate={navigate} />}
        {page === 'agents' && <AgentsPanel />}
        {page === 'people' && <PeoplePanel />}
        {page === 'ledger' && <LedgerPanel />}
        {page === 'treasury' && <TreasuryPanel />}
        {page === 'demos' && (
          <div className="cp-stack" style={{ gap: 24 }}>
            <MerchantTerminal />
            <PayrollOdometer />
            <TreasuryVault />
          </div>
        )}
      </main>
      <SettlementModal />
    </AppShell>
  );
}
