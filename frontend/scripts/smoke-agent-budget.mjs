// End-to-end smoke test of an agent budget on Tempo testnet (Moderato, chain 42431).
//
// Every run creates throwaway keys in memory. Nothing is saved and no real money is involved.
//   1. Create a company (root) account and fund it from the public testnet faucet.
//   2. Authorize an agent access key: 5 AlphaUSD per day, may only call transferWithMemo,
//      only to one allowed recipient, expires in 1 day.
//   3. The agent pays 1.25 AlphaUSD with a 32-byte memo.
//   4. Read the remaining limit.
//   5. Try to overspend (expected to fail), then revoke the key.
//
// Run: node scripts/smoke-agent-budget.mjs   (from the frontend/ folder)

import { createClient as createViemClient, http, parseUnits, formatUnits, stringToHex, publicActions, walletActions } from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';
import { Account, P256, Expiry, tempoActions } from 'viem/tempo';

const ALPHA_USD = '0x20c0000000000000000000000000000000000001';

const client = createViemClient({ chain: tempoModerato, transport: http() })
  .extend(publicActions)
  .extend(walletActions)
  .extend(tempoActions());

const log = (...a) => console.log('•', ...a);

const company = Account.fromSecp256k1(generatePrivateKey());
log('company account', company.address);

const funded = await client.faucet.fundSync({ account: company.address });
log('faucet funded, receipts:', funded.length);

const symbol = await client.token.getMetadata({ token: ALPHA_USD });
log('token', symbol.symbol, 'decimals', symbol.decimals);

const recipient = Account.fromSecp256k1(generatePrivateKey()).address;
const agentKey = Account.fromP256(P256.randomPrivateKey(), { access: company.address });
log('agent access key', agentKey.accessKeyAddress);

const auth = await client.accessKey.authorizeSync({
  account: company,
  accessKey: { accessKeyAddress: agentKey.accessKeyAddress, keyType: 'p256' },
  expiry: Expiry.days(1),
  limits: [{ token: ALPHA_USD, limit: parseUnits('5', 6), period: 86_400 }],
  scopes: [{ address: ALPHA_USD, selector: 'transferWithMemo(address,uint256,bytes32)', recipients: [recipient] }],
});
log('authorized, tx', auth.receipt?.transactionHash ?? auth.transactionHash ?? '(see receipt)');

const pay = await client.token.transferSync({
  account: agentKey,
  token: ALPHA_USD,
  to: recipient,
  amount: parseUnits('1.25', 6),
  memo: stringToHex('agent:research|task:1042', { size: 32 }),
});
log('agent paid 1.25, tx', pay.receipt.transactionHash);

const { remaining, periodEnd } = await client.accessKey.getRemainingLimit({
  account: company.address,
  accessKey: agentKey.accessKeyAddress,
  token: ALPHA_USD,
});
log('remaining today', formatUnits(remaining, 6), 'period ends', new Date(Number(periodEnd) * 1000).toISOString());

try {
  await client.token.transferSync({
    account: agentKey, token: ALPHA_USD, to: recipient, amount: parseUnits('10', 6),
    memo: stringToHex('overspend-test', { size: 32 }),
  });
  log('UNEXPECTED: overspend went through');
  process.exitCode = 1;
} catch (e) {
  log('overspend blocked as expected:', (e.shortMessage || e.message).split('\n')[0]);
}

const rev = await client.accessKey.revokeSync({ account: company, accessKey: agentKey.accessKeyAddress });
log('revoked, tx', rev.receipt?.transactionHash ?? '(done)');
log('explorer', `${tempoModerato.blockExplorers.default.url}/address/${company.address}`);
