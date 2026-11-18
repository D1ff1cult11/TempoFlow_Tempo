# Deployments

**Tempo testnet (Moderato, 42431):** `TempoPayrollStream` is deployed. See [`tempoTestnet.json`](tempoTestnet.json). Deploy
again with `npx hardhat compile && node scripts/deploy-payroll-stream.mjs`. Nothing is deployed to mainnet.

`scripts/deploy.js` writes one file per network here, named after the Hardhat network
(e.g. `localhost.json`, `tempoTestnet.json`), with the chain ID it actually deployed to.
Only commit a file here after a real deployment you can look up on that network's explorer.

Note: the live control panel (agent budgets, pay runs, ledger, FX) needs **no TempoFlow contract**. It uses Tempo's
built-in precompiles (Account Keychain, TIP-20, Stablecoin DEX) on testnet. This folder is only for the optional
payroll-stream, router and vault contracts.
