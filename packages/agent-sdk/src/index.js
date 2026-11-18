// @tempoflow/agent: the code an AI agent runs to spend its TempoFlow budget on Tempo.
//
// The agent signs with its OWN access key. Tempo enforces the limits the company set in TempoFlow
// (daily budget, allowed recipients, expiry); this SDK just makes paying, checking and paid API calls easy.

import { createClient, http, parseUnits, formatUnits, stringToHex, publicActions, walletActions } from 'viem';
import { tempoModerato, tempo as tempoMainnet } from 'viem/chains';
import { Account, P256, tempoActions, withFeePayer } from 'viem/tempo';

export const NETWORKS = { testnet: tempoModerato, mainnet: tempoMainnet };
const DECIMALS = 6;

/** Thrown when Tempo rejects a payment because the agent's budget is used up. */
export class BudgetExceededError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'BudgetExceededError';
    this.cause = cause;
  }
}

/** Thrown when the key is revoked, expired, or not allowed to pay that recipient or contract. */
export class KeyNotAllowedError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'KeyNotAllowedError';
    this.cause = cause;
  }
}

function classify(error) {
  const text = `${error?.shortMessage ?? ''} ${error?.details ?? ''} ${error?.message ?? ''}`;
  if (/SpendingLimitExceeded|exceeded its spending limit/i.test(text)) {
    return new BudgetExceededError('Payment refused by Tempo: this agent has used up its budget for the period.', error);
  }
  if (/KeyExpired|KeyAlreadyRevoked|KeyNotFound|revoked|expired|CallNotAllowed|scope|not allowed/i.test(text)) {
    return new KeyNotAllowedError('Payment refused by Tempo: the agent key is revoked, expired or not allowed to make this call.', error);
  }
  return error;
}

/** TIP-20 memos are exactly 32 bytes. Same format as the TempoFlow panel: "a:<agent>|t:<task>". */
export function taskMemo(agentName, task) {
  const text = `a:${String(agentName).slice(0, 12)}|t:${task}`;
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 32) throw new Error(`Memo "${text}" is ${bytes.length} bytes; keep agent name + task under 32 bytes.`);
  return stringToHex(text, { size: 32 });
}

/** Create a fresh agent key inside the agent runtime. Register only `keyAddress` with TempoFlow. */
export function generateAgentKey() {
  const privateKey = P256.randomPrivateKey();
  const keyAddress = Account.fromP256(privateKey).address;
  return { privateKey, keyAddress };
}

/**
 * @param {object} options
 * @param {`0x${string}`} options.privateKey      The agent's P256 key (keep it in your secret store).
 * @param {`0x${string}`} options.companyAddress  The TempoFlow company account that authorized the key.
 * @param {`0x${string}`} options.token           Stablecoin the budget is in (TIP-20 address).
 * @param {string} [options.name]                 Agent name used in memos.
 * @param {'testnet'|'mainnet'} [options.network] Defaults to 'testnet'.
 * @param {string} [options.relayUrl]             TempoFlow fee-payer relay (e.g. https://your-app/api/relay). Fees then don't use the budget.
 * @param {string} [options.rpcUrl]               Custom Tempo RPC URL.
 */
export function createAgent({ privateKey, companyAddress, token, name = 'agent', network = 'testnet', relayUrl, rpcUrl }) {
  if (!privateKey || !companyAddress || !token) throw new Error('privateKey, companyAddress and token are required');
  const chain = NETWORKS[network];
  if (!chain) throw new Error(`Unknown network "${network}"`);

  const account = Account.fromP256(privateKey, { access: companyAddress });
  const rpc = http(rpcUrl);
  const client = createClient({ chain, transport: relayUrl ? withFeePayer(rpc, http(relayUrl)) : rpc })
    .extend(publicActions)
    .extend(walletActions)
    .extend(tempoActions());

  return {
    account,
    /** Address of this access key (what TempoFlow shows as "key"). */
    keyAddress: account.accessKeyAddress,
    companyAddress,
    token,
    network,

    /** Pay `amount` (e.g. "2.50") of the budget token to `to`, tagged with a task ID. Returns the tx hash. */
    async pay({ to, amount, task, memo }) {
      try {
        const result = await client.token.transferSync({
          account,
          token,
          to,
          amount: parseUnits(String(amount), DECIMALS),
          memo: memo ?? taskMemo(name, task ?? 'none'),
          ...(relayUrl ? { feePayer: true } : {}),
        });
        return result.receipt.transactionHash;
      } catch (e) {
        throw classify(e);
      }
    },

    /** How much of today's budget is left, read live from Tempo. */
    async remaining() {
      const { remaining, periodEnd } = await client.accessKey.getRemainingLimit({
        account: companyAddress,
        accessKey: account.accessKeyAddress,
        token,
      });
      return { remaining: Number(formatUnits(remaining, DECIMALS)), resetsAt: periodEnd ? new Date(Number(periodEnd) * 1000) : null };
    },

    /** True if `amount` still fits in today's budget. Check before starting expensive work. */
    async canSpend(amount) {
      return (await this.remaining()).remaining >= Number(amount);
    },

    /**
     * A fetch that pays for HTTP 402 (MPP) APIs from the agent's budget. Requires the optional `mppx` package.
     * `maxPerCall` refuses any single charge above it (in the budget token), on top of Tempo's own limit.
     */
    async paidFetch({ maxPerCall = '1' } = {}) {
      const { Mppx, tempo } = await import('mppx/client');
      const mppx = Mppx.create({
        polyfill: false,
        methods: [
          tempo({
            account,
            getClient: () => client,
            expectedChainId: chain.id,
            currencies: [token],
            decimals: DECIMALS,
            maxAmount: String(maxPerCall),
          }),
        ],
      });
      return mppx.fetch;
    },

    client,
  };
}
