# ⚡ TempoFlow

> **Stablecoin payments, streaming payroll and merchant settlement on [Tempo](https://tempo.xyz).**

[![Live Demo](https://img.shields.io/badge/Demo-tempoflow--app.vercel.app-00F0FF?style=for-the-badge&logo=vercel)](https://tempoflow-app.vercel.app/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Status](https://img.shields.io/badge/Status-Early%20prototype-orange)](#-project-status)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<p align="center">
  <img src="assets/tempoflow_hero_banner.jpg" alt="TempoFlow" width="100%" style="border-radius: 12px;" />
</p>

TempoFlow is a set of smart contracts and a web app for moving stablecoins on Tempo:

- **Payments & settlement**: a router that takes a stablecoin payment, charges a 10 bps protocol fee, optionally converts currency (e.g. USDC → EURC), and pays the merchant, with replay protection and an emergency pause.
- **Streaming payroll**: an employer locks funds into a stream and the employee's balance accrues every second; they can withdraw what has accrued at any time, and cancelling splits the balance fairly.
- **Merchant vaults**: non-custodial, multi-token balances for a merchant, with optional automatic revenue splits to another address.
- **Solana payment intake (experimental)**: an Anchor program where a payer escrows SPL tokens for a payment destined for Tempo, with a refund after a 1-hour timeout.

---

## 🚦 Project Status

This is an **early prototype**. Be clear about what is real and what isn't:

| Area | Status |
| :--- | :--- |
| EVM contracts (`TempoFlowRouter`, `TempoPayrollStream`, `MerchantSettlementVault`) | ✅ Written and covered by a local Hardhat test suite (10 tests) |
| Deployment to Tempo (testnet or mainnet) | ❌ **Not deployed yet.** See [`deployments/`](deployments/README.md) |
| Currency conversion (FX) | 🟡 **Mocked.** `contracts/mocks/MockEnshrinedAMM.sol` uses a fixed, admin-set rate; not yet wired to Tempo's real FX |
| Stablecoins | 🟡 **Mocked** in tests and local deploys (`MockERC20`, 6 decimals) |
| Solana Anchor program | 🟡 Code only. Not deployed; program ID is a placeholder |
| Solana → Tempo relayer | ❌ Not built. The app only simulates this step |
| Security audit | ❌ None. Do not use with real funds |
| Web app | ✅ Runs in **Demo Mode** (fully simulated in the browser, no wallet needed). **Live Web3 Mode** needs real deployed contract addresses, which don't exist yet |

---

## 🏛️ Architecture

```
┌────────────────────────────────────────────────────────┐
│        Solana payment intake (Anchor, experimental)    │
│  • Payer escrows SPL tokens in a program PDA           │
│  • Refund available after a 1-hour timeout             │
│  • Emits a payment intent with the Tempo (EVM) address │
└───────────────────────────┬────────────────────────────┘
                            │ relayer (not built yet)
                            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                             Tempo (EVM)                                   │
│                                                                           │
│  ┌───────────────────────────┐      ┌──────────────────────────────────┐  │
│  │    TempoFlowRouter        │─────►│  FX conversion                   │  │
│  │  • 10 bps protocol fee    │      │  (MockEnshrinedAMM for now)      │  │
│  │  • Replay protection      │      └──────────────────────────────────┘  │
│  │  • Emergency pause        │                                            │
│  └─────────────┬─────────────┘                                            │
│                ▼                                                          │
│  ┌───────────────────────────┐      ┌──────────────────────────────────┐  │
│  │  MerchantSettlementVault  │      │       TempoPayrollStream         │  │
│  │  • Non-custodial balances │      │  • Per-second linear accrual     │  │
│  │  • Auto-split forwarding  │      │  • Withdraw any time             │  │
│  └───────────────────────────┘      │  • Fair cancellation             │  │
│                                     └──────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

Network-level features such as paying gas in stablecoins and fast finality come from **Tempo itself**, not from TempoFlow.

---

## 📦 Contracts

| Contract | Purpose |
| :--- | :--- |
| `contracts/TempoFlowRouter.sol` | Payment routing, 10 bps fee, optional FX, split payments, replay guard, pause |
| `contracts/TempoPayrollStream.sol` | Per-second payroll streams: create, withdraw, cancel |
| `contracts/MerchantSettlementVault.sol` | Merchant balances, withdrawals, auto-forward splits |
| `contracts/mocks/MockEnshrinedAMM.sol` | Test stand-in for FX conversion (fixed rates) |
| `contracts/mocks/MockERC20.sol` | Test stablecoins (USDC/EURC, 6 decimals) |
| `solana-ingress/` | Anchor program for Solana-side escrow (experimental, not deployed) |

---

## ⚡ Getting Started

### Run the contract tests
```bash
npm install
npx hardhat test
```

### Deploy locally
```bash
npx hardhat node
# in a second terminal:
npx hardhat run scripts/deploy.js --network localhost
```
This writes `deployments/localhost.json`. A `tempoTestnet` network is configured in `hardhat.config.cjs` (set `TEMPO_TESTNET_RPC` and `PRIVATE_KEY` in your environment) but has not been used for a real deployment yet.

### Run the web app
```bash
npm run frontend:dev
```
The app opens in **Demo Mode**: payments, payroll and FX are simulated in the browser. **Live Web3 Mode** connects a wallet, but it will only work once contract addresses in `frontend/src/config/contracts.js` point at a real deployment.

---

## 🔒 Security Notes

Design measures in the contracts (not audited):
- Checks-Effects-Interactions ordering on state changes
- Reentrancy lock on external entry points
- On-chain order IDs to prevent a payment being executed twice
- Owner-controlled emergency pause
- Solana escrow refund after a 1-hour timeout

---

## 📄 License
MIT. See [LICENSE](LICENSE).
