// Smoke test of a payroll "pay run" on Tempo testnet (Moderato, chain 42431).
//
// Throwaway keys, testnet faucet funds only.
//   1. Batching: pay 3 contractors in ONE Tempo transaction, each transfer carrying an invoice memo.
//   2. Fee sponsorship: a separate sponsor account pays the network fee for that transaction.
//   3. FX: get a real quote from the Stablecoin DEX (AlphaUSD -> BetaUSD) and sell a small amount.
//
// Run: node scripts/smoke-payrun.mjs   (from the frontend/ folder)

import { createClient as createViemClient, http, parseUnits, formatUnits, stringToHex, publicActions, walletActions } from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';
import { Account, Actions, tempoActions } from 'viem/tempo';

const ALPHA_USD = '0x20c0000000000000000000000000000000000001';
const BETA_USD = '0x20c0000000000000000000000000000000000002';

const client = createViemClient({ chain: tempoModerato, transport: http() })
  .extend(publicActions)
  .extend(walletActions)
  .extend(tempoActions());
const log = (...a) => console.log('•', ...a);
const bal = async (who, token = ALPHA_USD) => (await client.token.getBalance({ account: who, token })).formatted;

const company = Account.fromSecp256k1(generatePrivateKey());
const sponsor = Account.fromSecp256k1(generatePrivateKey());
await client.faucet.fundSync({ account: company.address });
await client.faucet.fundSync({ account: sponsor.address });
log('company', company.address, 'AlphaUSD', await bal(company.address));

const contractors = [
  { name: 'Ana (design)', amount: '12.50', invoice: 'INV-2026-11-001' },
  { name: 'Ravi (backend)', amount: '20.00', invoice: 'INV-2026-11-002' },
  { name: 'Lea (QA)', amount: '7.25', invoice: 'INV-2026-11-003' },
].map((c) => ({ ...c, address: Account.fromSecp256k1(generatePrivateKey()).address }));

const calls = contractors.map((c) =>
  Actions.token.transfer.call({
    token: ALPHA_USD,
    to: c.address,
    amount: parseUnits(c.amount, 6),
    memo: stringToHex(c.invoice, { size: 32 }),
  }),
);

const companyBefore = await bal(company.address);
const sponsorBefore = await bal(sponsor.address);
const receipt = await client.sendTransactionSync({ account: company, calls, feePayer: sponsor });
log('pay run: 1 transaction, 3 payouts, tx', receipt.transactionHash, 'status', receipt.status);
for (const c of contractors) log('  ', c.name, c.invoice, '->', await bal(c.address));
log('company paid', (Number(companyBefore) - Number(await bal(company.address))).toFixed(6), '(should be exactly 39.75: sponsor paid the fee)');
log('sponsor spent on fees', (Number(sponsorBefore) - Number(await bal(sponsor.address))).toFixed(6));

const amountIn = parseUnits('10', 6);
const quote = await client.dex.getSellQuote({ tokenIn: ALPHA_USD, tokenOut: BETA_USD, amountIn });
log('DEX quote: 10 AlphaUSD ->', formatUnits(quote, 6), 'BetaUSD');
const minOut = (quote * 995n) / 1000n; // 0.5% slippage guard
const sold = await client.dex.sellSync({ account: company, tokenIn: ALPHA_USD, tokenOut: BETA_USD, amountIn, minAmountOut: minOut });
log('swapped on DEX, tx', sold.receipt.transactionHash, 'BetaUSD balance', await bal(company.address, BETA_USD));
