# Deployments

**TempoFlow is not deployed to any public network yet** (no Tempo testnet/mainnet, no Solana devnet).

`scripts/deploy.js` writes one file per network here, named after the Hardhat network
(e.g. `localhost.json`, `tempoTestnet.json`), with the chain ID it actually deployed to.
Only commit a file here after a real deployment you can look up on that network's explorer.
