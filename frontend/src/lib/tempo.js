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
  parseAbi,
  encodeFunctionData,
} from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';
import { Account, Abis, Actions, Addresses, Expiry, P256, WebAuthnP256, tempoActions, withFeePayer } from 'viem/tempo';

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

// Fee sponsorship goes through TempoFlow's server relay (/api/relay). The sponsor key lives only on the server.
export const RELAY_URL = import.meta.env?.VITE_RELAY_URL || '/api/relay';
const relayHttp = () => http(new URL(RELAY_URL, globalThis.location?.origin ?? 'http://localhost').toString());
export const sponsoredClient = createClient({ chain: tempoModerato, transport: withFeePayer(http(), relayHttp()) })
  .extend(publicActions)
  .extend(walletActions)
  .extend(tempoActions());

/** True when the server relay is deployed and has a sponsor key configured. */
export async function relayAvailable() {
  try {
    const r = await fetch(RELAY_URL, { method: 'GET' });
    if (!r.ok) return false;
    return Boolean((await r.json()).sponsored);
  } catch {
    return false;
  }
}

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
  const withRecipients = (s) => (agent.recipients?.length ? { ...s, recipients: agent.recipients } : s);
  const scopes = [withRecipients({ address: agent.token, selector: 'transferWithMemo(address,uint256,bytes32)' })];
  // Paid APIs over MPP settle with a plain TIP-20 transfer, so the key needs that call too.
  if (agent.allowMpp) scopes.push(withRecipients({ address: agent.token, selector: 'transfer(address,uint256)' }));
  const result = await client.accessKey.authorizeSync({
    account: companyAccount(company),
    accessKey: { accessKeyAddress: agent.keyAddress, keyType: 'p256' },
    expiry: Expiry.days(Number(agent.expiryDays || 30)),
    limits: [{ token: agent.token, limit: toUnits(agent.dailyLimit), period: 86_400 }],
    scopes,
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
export async function agentPay({ companyAddress, agent, to, amount, memo, sponsored }) {
  const result = await (sponsored ? sponsoredClient : client).token.transferSync({
    account: agentAccount(agent, companyAddress),
    token: agent.token,
    to,
    amount: toUnits(amount),
    memo: encodeMemo(memo),
    ...(sponsored ? { feePayer: true } : {}),
  });
  return result.receipt.transactionHash;
}

// ---------- people (batched pay run) ----------
/** Pays every line in ONE Tempo transaction; each transfer carries its own memo (invoice ID). */
export async function payRun({ company, lines, token, sponsored }) {
  const calls = lines.map((l) =>
    Actions.token.transfer.call({ token, to: l.address, amount: toUnits(l.amount), memo: encodeMemo(l.memo) }),
  );
  const receipt = await (sponsored ? sponsoredClient : client).sendTransactionSync({
    account: companyAccount(company),
    calls,
    ...(sponsored ? { feePayer: true } : {}),
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

/** Reads logs in RPC-sized chunks. Without toBlock: up to the chain head, capped to ~5 chunks (browser use). */
async function chunkedEvents(params, fromBlock, toBlock) {
  const latest = toBlock != null ? BigInt(toBlock) : await client.getBlockNumber();
  const out = [];
  let start = BigInt(fromBlock ?? latest - SPAN);
  if (toBlock == null && latest - start > SPAN * 5n) start = latest - SPAN * 5n; // cap work in the browser
  while (start <= latest) {
    const end = start + SPAN > latest ? latest : start + SPAN;
    out.push(...(await client.getContractEvents({ ...params, fromBlock: start, toBlock: end })));
    start = end + 1n;
  }
  return out;
}

/** Every AccessKeySpend event for this company account (payments AND fees an agent key paid). */
export async function spendEvents({ companyAddress, fromBlock, toBlock }) {
  const logs = await chunkedEvents(
    { address: Addresses.accountKeychain, abi: Abis.accountKeychain, eventName: 'AccessKeySpend', args: { account: companyAddress } },
    fromBlock,
    toBlock,
  );
  return logs.map((l) => ({
    hash: l.transactionHash,
    logIndex: l.logIndex,
    blockNumber: Number(l.blockNumber),
    keyAddress: l.args.publicKey,
    token: l.args.token,
    amount: fromUnits(l.args.amount),
    remaining: fromUnits(l.args.remainingLimit),
  }));
}

/** Outgoing memo transfers for one token from the company account. */
export async function memoTransfers({ companyAddress, token, fromBlock, toBlock }) {
  const logs = await chunkedEvents(
    { address: token, abi: Abis.tip20, eventName: 'TransferWithMemo', args: { from: companyAddress } },
    fromBlock,
    toBlock,
  );
  return logs.map((l) => ({
    hash: l.transactionHash,
    logIndex: l.logIndex,
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

// ---------- streaming payroll (issue #14) ----------
// TempoPayrollStream on Tempo testnet: no owner or admin; every movement carries the stream id as its TIP-20 memo.
export const PAYROLL_STREAM = '0x70d6e4df698adc0d91ab57a020877bc61e0597af';
export const STREAM_ABI = parseAbi([
  'function createStream(bytes32 streamId, address employee, address token, uint256 totalAmount, uint256 durationSeconds)',
  'function withdrawFromStream(bytes32 streamId) returns (uint256)',
  'function cancelStream(bytes32 streamId) returns (uint256 employeePayout, uint256 employerRefund)',
  'function getStreamSummary(bytes32 streamId) view returns (address employer, address employee, address token, uint256 ratePerSecond, uint256 remainingBalance, uint256 claimableNow, bool isActive)',
  'function getStream(bytes32 streamId) view returns ((address employer, address employee, address token, uint256 ratePerSecond, uint256 startTime, uint256 stopTime, uint256 remainingBalance, uint256 lastClaimTime, bool isActive))',
]);

/** Funds a stream in ONE Tempo transaction: approve + createStream (batched calls). The label becomes the memo. */
export async function createStream({ company, employee, token, amount, durationSeconds, label, sponsored }) {
  const id = encodeMemo(label);
  const total = toUnits(amount);
  const calls = [
    { to: token, data: encodeFunctionData({ abi: Abis.tip20, functionName: 'approve', args: [PAYROLL_STREAM, total] }) },
    {
      to: PAYROLL_STREAM,
      data: encodeFunctionData({ abi: STREAM_ABI, functionName: 'createStream', args: [id, employee, token, total, BigInt(durationSeconds)] }),
    },
  ];
  const receipt = await (sponsored ? sponsoredClient : client).sendTransactionSync({
    account: companyAccount(company),
    calls,
    ...(sponsored ? { feePayer: true } : {}),
  });
  if (receipt.status !== 'success') throw new Error('Creating the stream failed');
  return { id, hash: receipt.transactionHash };
}

export async function streamInfo(id) {
  const s = await client.readContract({ address: PAYROLL_STREAM, abi: STREAM_ABI, functionName: 'getStream', args: [id] });
  const claimable = await client.readContract({ address: PAYROLL_STREAM, abi: STREAM_ABI, functionName: 'getStreamSummary', args: [id] });
  return {
    employer: s.employer,
    employee: s.employee,
    token: s.token,
    perSecond: fromUnits(s.ratePerSecond),
    start: Number(s.startTime) * 1000,
    stop: Number(s.stopTime) * 1000,
    remaining: fromUnits(s.remainingBalance),
    claimable: fromUnits(claimable[5]),
    active: s.isActive,
  };
}

/** The contractor withdraws what has accrued (signs with their own account). */
export async function withdrawStream({ account, id, sponsored }) {
  const { request } = await client.simulateContract({ account, address: PAYROLL_STREAM, abi: STREAM_ABI, functionName: 'withdrawFromStream', args: [id] });
  const receipt = await (sponsored ? sponsoredClient : client).sendTransactionSync({
    account,
    to: PAYROLL_STREAM,
    data: encodeFunctionData({ abi: STREAM_ABI, functionName: 'withdrawFromStream', args: request.args }),
    ...(sponsored ? { feePayer: true } : {}),
  });
  if (receipt.status !== 'success') throw new Error('Withdrawal failed');
  return receipt.transactionHash;
}

/** The company stops a stream: the contractor gets what accrued, the rest returns to the company. */
export async function cancelStream({ company, id }) {
  const receipt = await client.sendTransactionSync({
    account: companyAccount(company),
    to: PAYROLL_STREAM,
    data: encodeFunctionData({ abi: STREAM_ABI, functionName: 'cancelStream', args: [id] }),
  });
  if (receipt.status !== 'success') throw new Error('Cancelling the stream failed');
  return receipt.transactionHash;
}
