// Thin wrapper around viem/tempo for the TempoFlow control panel.
// Everything here talks to Tempo testnet (Moderato, chain 42431) with faucet funds only.

import {
  createClient,
  http,
  parseUnits,
  formatUnits,
  stringToHex,
  hexToString,
  publicActions,
  walletActions,
} from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';
import { Account, Abis, Actions, Addresses, Expiry, P256, WebAuthnP256, tempoActions } from 'viem/tempo';

export const CHAIN = tempoModerato;
export const EXPLORER = tempoModerato.blockExplorers.default.url;
export const DECIMALS = 6;

// Faucet stablecoins on Moderato (TIP-20, 6 decimals).
export const TOKENS = [
  { symbol: 'AlphaUSD', address: '0x20c0000000000000000000000000000000000001' },
  { symbol: 'BetaUSD', address: '0x20c0000000000000000000000000000000000002' },
  { symbol: 'ThetaUSD', address: '0x20c0000000000000000000000000000000000003' },
  { symbol: 'pathUSD', address: Addresses.pathUsd },
];
export const DEFAULT_TOKEN = TOKENS[0].address;
export const tokenSymbol = (address) =>
  TOKENS.find((t) => t.address.toLowerCase() === String(address).toLowerCase())?.symbol ?? short(address);

export const client = createClient({ chain: tempoModerato, transport: http() })
  .extend(publicActions)
  .extend(walletActions)
  .extend(tempoActions());

// ---------- formatting ----------
export const short = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
export const toUnits = (value) => parseUnits(String(value || 0), DECIMALS);
export const fromUnits = (value) => Number(formatUnits(BigInt(value ?? 0), DECIMALS));
export const usd = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const txUrl = (hash) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address) => `${EXPLORER}/address/${address}`;

// A TIP-20 memo is exactly 32 bytes. We keep memos short and readable, e.g. "a:research|t:1042" or "INV-2026-11-001".
export function encodeMemo(text) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 32) throw new Error(`Memo "${text}" is ${bytes.length} bytes; the limit is 32.`);
  return stringToHex(text, { size: 32 });
}
export function decodeMemo(hex) {
  try {
    return hexToString(hex).replace(/\u0000+$/g, '');
  } catch {
    return hex;
  }
}

export function errorText(e) {
  return (e?.shortMessage || e?.details || e?.message || String(e)).split('\n')[0];
}

// ---------- company (root) account ----------
// Two options, both created by the person in their own browser:
//  - passkey: a WebAuthn P256 credential (Face ID / Windows Hello / security key). Only the public key is stored.
//  - testKey: a throwaway secp256k1 key kept in this browser's storage. Testnet only.
export async function createPasskeyCompany(label) {
  const credential = await WebAuthnP256.createCredential({ label });
  const account = Account.fromWebAuthnP256({ id: credential.id, publicKey: credential.publicKey });
  return { type: 'passkey', credential: { id: credential.id, publicKey: credential.publicKey }, address: account.address };
}

export function createTestKeyCompany() {
  const privateKey = generatePrivateKey();
  const account = Account.fromSecp256k1(privateKey);
  return { type: 'testKey', privateKey, address: account.address };
}

export function companyAccount(company) {
  if (!company) return null;
  if (company.type === 'passkey') return Account.fromWebAuthnP256(company.credential);
  return Account.fromSecp256k1(company.privateKey);
}

// Testnet stand-in for TempoFlow's fee-payer service. In production this key lives on a server
// (viem/tempo `withFeePayer` transport) and is never in the browser.
export function createSponsor() {
  const privateKey = generatePrivateKey();
  return { privateKey, address: Account.fromSecp256k1(privateKey).address };
}
export const sponsorAccount = (sponsor) => (sponsor ? Account.fromSecp256k1(sponsor.privateKey) : undefined);

export async function fundFromFaucet(address) {
  return client.faucet.fundSync({ account: address });
}

export async function getBalances(address) {
  const entries = await Promise.all(
    TOKENS.map(async (t) => {
      const b = await client.token.getBalance({ account: address, token: t.address });
      return [t.address, Number(b.formatted)];
    }),
  );
  return Object.fromEntries(entries);
}

// ---------- agents (Tempo access keys) ----------
export function newAgentKey(companyAddress) {
  const privateKey = P256.randomPrivateKey();
  const key = Account.fromP256(privateKey, { access: companyAddress });
  return { privateKey, keyAddress: key.accessKeyAddress };
}

export const agentAccount = (agent, companyAddress) => Account.fromP256(agent.privateKey, { access: companyAddress });

/**
 * Authorize an agent key on-chain.
 * Tempo enforces: daily `limit` of `token`, only `transferWithMemo`, only to `recipients`, until `expiryDays`.
 */
export async function authorizeAgent({ company, agent }) {
  const scope = { address: agent.token, selector: 'transferWithMemo(address,uint256,bytes32)' };
  if (agent.recipients?.length) scope.recipients = agent.recipients;
  const result = await client.accessKey.authorizeSync({
    account: companyAccount(company),
    accessKey: { accessKeyAddress: agent.keyAddress, keyType: 'p256' },
    expiry: Expiry.days(Number(agent.expiryDays || 30)),
    limits: [{ token: agent.token, limit: toUnits(agent.dailyLimit), period: 86_400 }],
    scopes: [scope],
  });
  const receipt = result.receipt ?? result;
  return { hash: receipt.transactionHash, blockNumber: receipt.blockNumber };
}

export async function updateAgentLimit({ company, agent, newLimit }) {
  const result = await client.accessKey.updateLimitSync({
    account: companyAccount(company),
    accessKey: agent.keyAddress,
    token: agent.token,
    limit: toUnits(newLimit),
  });
  return (result.receipt ?? result).transactionHash;
}

export async function revokeAgent({ company, agent }) {
  const result = await client.accessKey.revokeSync({ account: companyAccount(company), accessKey: agent.keyAddress });
  return (result.receipt ?? result).transactionHash;
}

export async function remainingLimit({ companyAddress, agent }) {
  const { remaining, periodEnd } = await client.accessKey.getRemainingLimit({
    account: companyAddress,
    accessKey: agent.keyAddress,
    token: agent.token,
  });
  return { remaining: fromUnits(remaining), periodEnd: periodEnd ? Number(periodEnd) * 1000 : null };
}

/** The agent itself pays, signing with its own access key. With a sponsor, the fee does not eat the agent's budget. */
export async function agentPay({ companyAddress, agent, to, amount, memo, sponsor }) {
  const result = await client.token.transferSync({
    account: agentAccount(agent, companyAddress),
    token: agent.token,
    to,
    amount: toUnits(amount),
    memo: encodeMemo(memo),
    ...(sponsor ? { feePayer: sponsorAccount(sponsor) } : {}),
  });
  return result.receipt.transactionHash;
}

// ---------- people (batched pay run) ----------
/** Pays every line in ONE Tempo transaction; each transfer carries its own memo (invoice ID). */
export async function payRun({ company, lines, token, sponsor }) {
  const calls = lines.map((l) =>
    Actions.token.transfer.call({ token, to: l.address, amount: toUnits(l.amount), memo: encodeMemo(l.memo) }),
  );
  const receipt = await client.sendTransactionSync({
    account: companyAccount(company),
    calls,
    ...(sponsor ? { feePayer: sponsorAccount(sponsor) } : {}),
  });
  if (receipt.status !== 'success') throw new Error('Pay run transaction reverted');
  return receipt.transactionHash;
}

// ---------- treasury FX (Stablecoin DEX) ----------
export async function fxQuote({ tokenIn, tokenOut, amount }) {
  const out = await client.dex.getSellQuote({ tokenIn, tokenOut, amountIn: toUnits(amount) });
  return fromUnits(out);
}

export async function fxConvert({ company, tokenIn, tokenOut, amount, slippageBps = 50 }) {
  const amountIn = toUnits(amount);
  const quote = await client.dex.getSellQuote({ tokenIn, tokenOut, amountIn });
  const minAmountOut = (quote * BigInt(10_000 - slippageBps)) / 10_000n;
  const result = await client.dex.sellSync({ account: companyAccount(company), tokenIn, tokenOut, amountIn, minAmountOut });
  return { hash: result.receipt.transactionHash, quoted: fromUnits(quote) };
}

// ---------- history from chain ----------
const SPAN = 99_000n; // the public RPC accepts ~100k blocks per log query

async function chunkedEvents(params, fromBlock) {
  const latest = await client.getBlockNumber();
  const out = [];
  let start = BigInt(fromBlock ?? latest - SPAN);
  if (latest - start > SPAN * 5n) start = latest - SPAN * 5n; // cap work for the demo
  while (start <= latest) {
    const end = start + SPAN > latest ? latest : start + SPAN;
    out.push(...(await client.getContractEvents({ ...params, fromBlock: start, toBlock: end })));
    start = end + 1n;
  }
  return out;
}

/** Every AccessKeySpend event for this company account (payments AND fees an agent key paid). */
export async function spendEvents({ companyAddress, fromBlock }) {
  const logs = await chunkedEvents(
    { address: Addresses.accountKeychain, abi: Abis.accountKeychain, eventName: 'AccessKeySpend', args: { account: companyAddress } },
    fromBlock,
  );
  return logs.map((l) => ({
    hash: l.transactionHash,
    blockNumber: Number(l.blockNumber),
    keyAddress: l.args.publicKey,
    token: l.args.token,
    amount: fromUnits(l.args.amount),
    remaining: fromUnits(l.args.remainingLimit),
  }));
}

/** Outgoing memo transfers for one token from the company account. */
export async function memoTransfers({ companyAddress, token, fromBlock }) {
  const logs = await chunkedEvents(
    { address: token, abi: Abis.tip20, eventName: 'TransferWithMemo', args: { from: companyAddress } },
    fromBlock,
  );
  return logs.map((l) => ({
    hash: l.transactionHash,
    blockNumber: Number(l.blockNumber),
    to: l.args.to,
    token,
    amount: fromUnits(l.args.amount),
    memo: decodeMemo(l.args.memo),
  }));
}

export async function blockTime(blockNumber) {
  const b = await client.getBlock({ blockNumber: BigInt(blockNumber) });
  return Number(b.timestamp) * 1000;
}
