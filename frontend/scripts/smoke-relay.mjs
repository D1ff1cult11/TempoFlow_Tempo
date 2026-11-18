// Smoke test of server-side fee sponsorship on Tempo testnet.
// Starts the real relay handler (api/_relay.mjs) in-process with a throwaway, in-memory sponsor key,
// then sends an agent payment with `feePayer: true` through the `withFeePayer` transport.
// Checks: the agent's budget is charged only the payment (no fee), and a non-TIP-20 call is refused.
//
// Run: node scripts/smoke-relay.mjs   (from the frontend/ folder)

import { createServer } from 'node:http';
import { createClient as createViemClient, http, parseUnits, formatUnits, stringToHex, publicActions, walletActions } from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Account, P256, Expiry, tempoActions, withFeePayer } from 'viem/tempo';

const ALPHA_USD = '0x20c0000000000000000000000000000000000001';
const log = (...a) => console.log('•', ...a);

process.env.TEMPO_SPONSOR_PRIVATE_KEY = generatePrivateKey(); // throwaway, never printed
const sponsor = privateKeyToAccount(process.env.TEMPO_SPONSOR_PRIVATE_KEY).address;
const { handle, validate } = await import('../../api/_relay.mjs');

const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const r = await handle(new Request('http://localhost/api/relay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: Buffer.concat(chunks) }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(0);
const relayUrl = `http://localhost:${server.address().port}/api/relay`;

const plain = createViemClient({ chain: tempoModerato, transport: http() }).extend(publicActions).extend(walletActions).extend(tempoActions());
const sponsored = createViemClient({ chain: tempoModerato, transport: withFeePayer(http(), http(relayUrl)) })
  .extend(publicActions).extend(walletActions).extend(tempoActions());

try {
  await plain.faucet.fundSync({ account: sponsor });
  const company = Account.fromSecp256k1(generatePrivateKey());
  await plain.faucet.fundSync({ account: company.address });
  log('sponsor', sponsor, 'company', company.address);

  const agentKey = Account.fromP256(P256.randomPrivateKey(), { access: company.address });
  await plain.accessKey.authorizeSync({
    account: company,
    accessKey: { accessKeyAddress: agentKey.accessKeyAddress, keyType: 'p256' },
    expiry: Expiry.days(1),
    limits: [{ token: ALPHA_USD, limit: parseUnits('5', 6), period: 86_400 }],
    scopes: [{ address: ALPHA_USD, selector: 'transferWithMemo(address,uint256,bytes32)' }],
  });

  const to = privateKeyToAccount(generatePrivateKey()).address;
  const pay = await sponsored.token.transferSync({
    account: agentKey, token: ALPHA_USD, to, amount: parseUnits('1', 6),
    memo: stringToHex('a:relay-test|t:1', { size: 32 }), feePayer: true,
  });
  log('sponsored agent payment', pay.receipt.transactionHash, pay.receipt.feePayer ? `fee payer ${pay.receipt.feePayer}` : '');

  const { remaining } = await plain.accessKey.getRemainingLimit({ account: company.address, accessKey: agentKey.accessKeyAddress, token: ALPHA_USD });
  log('remaining', formatUnits(remaining, 6), Number(formatUnits(remaining, 6)) === 4 ? '(exactly 4: fee was sponsored by the server)' : '(fee was NOT sponsored)');
  if (Number(formatUnits(remaining, 6)) !== 4) process.exitCode = 1;

  log('policy refuses non-TIP-20 call:', validate({ chainId: 42431, calls: [{ to: '0x1111111111111111111111111111111111111111' }] }) === false);
  log('policy refuses other chain:', validate({ chainId: 4217, calls: [{ to: ALPHA_USD }] }) === false);
} finally {
  server.close();
}
