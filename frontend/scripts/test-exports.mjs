// Unit tests for ledger exports (no network). Run: node scripts/test-exports.mjs   (from frontend/)
import assert from 'node:assert/strict';
import { formatDate, safeText, money, toQuickBooks, toXero, toFull, toCsv } from '../src/lib/exports.js';

const ALPHA = '0x20c0000000000000000000000000000000000001';
const at = Date.UTC(2026, 10, 3, 14, 5); // 3 Nov 2026
const rows = [
  { at, kind: 'Agent', team: 'Research', who: 'research-bot', to: '0xabc', token: ALPHA, amount: 1.25, memo: 'a:research-bot|t:1042', remaining: 8.75, hash: '0xh1' },
  { at, kind: 'Payroll', team: 'People', who: 'Ana', to: '0xdef', token: ALPHA, amount: 12.5, memo: 'INV-2026-11-001', hash: '0xh2' },
  { at, kind: 'Agent fee', team: '—', who: 'research-bot', to: '', token: ALPHA, amount: 0.000184, memo: '(network fee)', hash: '0xh3' },
  { at, kind: 'Agent', team: 'Ops', who: '=HYPERLINK("x")', to: '0x1', token: ALPHA, amount: 2, memo: '+cmd', hash: '0xh4' },
];
let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log('ok', name);
};

t('dates in all three formats (UTC)', () => {
  assert.equal(formatDate(at, 'DD/MM/YYYY'), '03/11/2026');
  assert.equal(formatDate(at, 'MM/DD/YYYY'), '11/03/2026');
  assert.equal(formatDate(at, 'YYYY-MM-DD'), '2026-11-03');
  assert.equal(formatDate(null), '');
});

t('outflows are negative, 2 decimals, zero becomes blank', () => {
  assert.equal(money(1.25), '-1.25');
  assert.equal(money(12.5), '-12.50');
  assert.equal(money(0.000184), '');
});

t('formula injection is neutralised in text cells', () => {
  assert.equal(safeText('=HYPERLINK("x")'), `'=HYPERLINK("x")`);
  assert.equal(safeText('+cmd'), "'+cmd");
  assert.equal(safeText('-x'), "'-x");
  assert.equal(safeText('INV-1'), 'INV-1');
});

t('QuickBooks: 3 columns, fee row dropped', () => {
  const out = toQuickBooks(rows, 'MM/DD/YYYY');
  assert.deepEqual(out[0], ['Date', 'Description', 'Amount']);
  assert.equal(out.length, 1 + 3);
  assert.deepEqual(out[1], ['11/03/2026', 'Agent · research-bot · team Research · a:research-bot|t:1042 · tx 0xh1', '-1.25']);
  assert.ok(out.every((r) => r.length === 3));
});

t('Xero: required columns, payee and reference', () => {
  const out = toXero(rows, 'DD/MM/YYYY');
  assert.deepEqual(out[0], ['*Date', '*Amount', 'Payee', 'Description', 'Reference']);
  assert.deepEqual(out[2], ['03/11/2026', '-12.50', 'Ana', 'Payroll · team People · AlphaUSD · tx 0xh2', 'INV-2026-11-001']);
  assert.equal(out[3][2], `'=HYPERLINK("x")`);
  assert.equal(out[3][4], "'+cmd");
});

t('full export keeps every row with 6 decimals', () => {
  const out = toFull(rows);
  assert.equal(out.length, 1 + rows.length);
  assert.equal(out[3][6], '0.000184');
});

t('CSV quoting escapes quotes and uses CRLF', () => {
  assert.equal(toCsv([['a"b', 'c']]), '"a""b","c"');
  assert.equal(toCsv([['1'], ['2']]), '"1"\r\n"2"');
});

console.log(`${n} tests passed`);
