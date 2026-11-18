import React from 'react';
import { Zap, LayoutDashboard, Bot, Users, BookOpen, ArrowRightLeft, FlaskConical, Github } from 'lucide-react';
import { useWorkspace } from '../../store/useWorkspace';
import { short } from '../../lib/tempo';

export const PAGES = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'people', label: 'People', icon: Users },
  { id: 'ledger', label: 'Ledger', icon: BookOpen },
  { id: 'treasury', label: 'Treasury', icon: ArrowRightLeft },
];
export const EXTRA_PAGES = [{ id: 'demos', label: 'Prototype demos', icon: FlaskConical }];

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Zap size={16} strokeWidth={2.5} />
      </span>
      TempoFlow
    </div>
  );
}

const NetworkBadge = () => (
  <span className="badge-pill badge-emerald" style={{ alignSelf: 'flex-start' }}>
    <span className="pulse-dot" /> Tempo testnet
  </span>
);

function NavButton({ page, current, onNavigate }) {
  const Icon = page.icon;
  return (
    <button className="nav-item" aria-current={current === page.id ? 'page' : undefined} onClick={() => onNavigate(page.id)}>
      <Icon size={17} />
      {page.label}
    </button>
  );
}

export function AppShell({ page, onNavigate, children }) {
  const ws = useWorkspace();

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        {PAGES.map((p) => (
          <NavButton key={p.id} page={p} current={page} onNavigate={onNavigate} />
        ))}
        <div className="nav-section">More</div>
        {EXTRA_PAGES.map((p) => (
          <NavButton key={p.id} page={p} current={page} onNavigate={onNavigate} />
        ))}
        <div className="sidebar-footer">
          <NetworkBadge />
          {ws.company && <span className="cp-mono" style={{ color: 'var(--text-muted)' }}>{short(ws.company.address)}</span>}
          <a
            className="cp-link"
            href="https://github.com/D1ff1cult11/TempoFlow_Tempo"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}
          >
            <Github size={14} /> Source on GitHub
          </a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Brand />
          <NetworkBadge />
        </header>
        {children}
        <nav className="bottom-nav" aria-label="Main">
          {PAGES.map((p) => (
            <NavButton key={p.id} page={p} current={page} onNavigate={onNavigate} />
          ))}
        </nav>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="cp-row">{actions}</div>}
    </div>
  );
}
