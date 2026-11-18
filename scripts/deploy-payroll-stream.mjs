// Deploys TempoPayrollStream to Tempo testnet (Moderato, chain 42431) and records it in deployments/tempoTestnet.json.
// The contract has no owner or admin: nobody, including the deployer, can touch funds in a stream. So the deployer is a
// throwaway in-memory key funded by the testnet faucet (never printed or saved).
// Run: npx hardhat compile && node scripts/deploy-payroll-stream.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { createClient, http, publicActions, walletActions } from 'viem';
import { tempoModerato } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';
import { Account, tempoActions } from 'viem/tempo';

const artifact = JSON.parse(readFileSync(new URL('../artifacts/contracts/TempoPayrollStream.sol/TempoPayrollStream.json', import.meta.url)));
const client = createClient({ chain: tempoModerato, transport: http() }).extend(publicActions).extend(walletActions).extend(tempoActions());

const deployer = Account.fromSecp256k1(generatePrivateKey());
await client.faucet.fundSync({ account: deployer.address });

const hash = await client.deployContract({ account: deployer, abi: artifact.abi, bytecode: artifact.bytecode });
const receipt = await client.waitForTransactionReceipt({ hash });
if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`Deployment failed: ${hash}`);

const code = await client.getCode({ address: receipt.contractAddress });
const record = {
  network: 'tempoTestnet',
  chainId: tempoModerato.id,
  explorer: tempoModerato.blockExplorers.default.url,
  contracts: {
    TempoPayrollStream: {
      address: receipt.contractAddress,
      txHash: hash,
      blockNumber: Number(receipt.blockNumber),
      deployedAt: new Date().toISOString(),
      codeSize: (code.length - 2) / 2,
    },
  },
};
writeFileSync(new URL('../deployments/tempoTestnet.json', import.meta.url), JSON.stringify(record, null, 2) + '\n');
console.log('TempoPayrollStream deployed at', receipt.contractAddress);
console.log(`${record.explorer}/address/${receipt.contractAddress}`);
