// Ledger exports for accountants. Pure functions: rows in, CSV rows out.
//
// Ledger row shape (from LedgerPanel): { at, kind, team, who, to, token, amount, memo, remaining, hash }
// Every row is money LEAVING the treasury, so accounting amounts are negative.
//
// Formats
//  - full:       every field TempoFlow knows, for your own records
//  - quickbooks: QuickBooks Online bank upload, 3-column layout: Date, Description, Amount
//  - xero:       Xero bank statement import: *Date, *Amount, Payee, Description, Reference

import { tokenSymbol } from './tempo.js';

export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

export function formatDate(ms, format = 'DD/MM/YYYY') {
  if (!ms) return '';
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  if (format === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
  if (format === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Spreadsheet apps treat cells starting with = + - @ (or tab / CR) as formulas. Memos and names can
 * come from an agent, so neutralise them by prefixing a quote. Only used on text cells, never amounts.
 */
export function safeText(value) {
  const s = String(value ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** Accounting tools take 2 decimals; returns '' for amounts that round to zero. */
export function money(amount) {
  const rounded = Math.round(Number(amount) * 100) / 100;
  return rounded === 0 ? '' : (-rounded).toFixed(2);
}

const describe = (r) =>
  [r.kind, r.who, r.team && r.team !== '—' ? `team ${r.team}` : '', r.memo].filter(Boolean).join(' · ');

export function toFull(rows) {
  return [
    ['time_utc', 'type', 'team', 'payee_or_agent', 'to', 'token', 'amount', 'memo', 'agent_limit_left', 'tx_hash'],
    ...rows.map((r) => [
      r.at ? new Date(r.at).toISOString() : '',
      r.kind,
      safeText(r.team),
      safeText(r.who),
      r.to,
      tokenSymbol(r.token),
      Number(r.amount).toFixed(6),
      safeText(r.memo),
      r.remaining ?? '',
      r.hash,
    ]),
  ];
}

/** Rows whose amount rounds to $0.00 (tiny network fees) are left out, as QuickBooks rejects zero amounts. */
export function toQuickBooks(rows, dateFormat) {
  return [
    ['Date', 'Description', 'Amount'],
    ...rows
      .filter((r) => money(r.amount) !== '')
      .map((r) => [formatDate(r.at, dateFormat), safeText(`${describe(r)} · tx ${r.hash}`), money(r.amount)]),
  ];
}

export function toXero(rows, dateFormat) {
  return [
    ['*Date', '*Amount', 'Payee', 'Description', 'Reference'],
    ...rows
      .filter((r) => money(r.amount) !== '')
      .map((r) => [
        formatDate(r.at, dateFormat),
        money(r.amount),
        safeText(r.who),
        safeText(`${r.kind}${r.team && r.team !== '—' ? ` · team ${r.team}` : ''} · ${tokenSymbol(r.token)} · tx ${r.hash}`),
        safeText(r.memo),
      ]),
  ];
}

export const EXPORTS = {
  full: { label: 'TempoFlow (all fields)', build: (rows) => toFull(rows), file: 'tempoflow-ledger' },
  quickbooks: { label: 'QuickBooks Online (bank CSV)', build: toQuickBooks, file: 'tempoflow-quickbooks' },
  xero: { label: 'Xero (bank statement CSV)', build: toXero, file: 'tempoflow-xero' },
};

export function toCsv(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}
