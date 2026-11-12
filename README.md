# ⚡ TempoFlow

> **One stablecoin treasury for your people and your AI agents, on [Tempo](https://tempo.xyz).**

[![Live Demo](https://img.shields.io/badge/Demo-tempoflow--app.vercel.app-00F0FF?style=for-the-badge&logo=vercel)](https://tempoflow-app.vercel.app/)
[![Network](https://img.shields.io/badge/Tempo-testnet%20(Moderato)-00D26A)](https://explore.testnet.tempo.xyz)
[![Status](https://img.shields.io/badge/Status-Early%20prototype-orange)](#-project-status)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<p align="center">
  <img src="assets/tempoflow_hero_banner.jpg" alt="TempoFlow" width="100%" style="border-radius: 12px;" />
</p>

Companies now pay two kinds of workers: **people** (contractors around the world) and **AI agents** (that buy APIs,
data, compute and services on their own). TempoFlow is the control panel for both, from one treasury:

- **Agent budgets**: give every agent its own key with a daily limit, an allowed-payee list and an expiry. **Tempo
  enforces these rules on-chain** (access keys), so a buggy or compromised agent cannot overspend. Revoke any agent, or a
  whole team, in one click.
- **Team caps**: group agents into teams; TempoFlow keeps the sum of agent limits in a team under the team's daily cap.
- **Pay runs for people**: pay every contractor in **one Tempo transaction** (batched calls). Each payout carries its
  invoice number as an on-chain **memo**.
- **One ledger**: rebuilt from the chain (memo transfers + `AccessKeySpend` events): who spent what, for which task or
  invoice, by team. Export to CSV for your accountant.
- **Fee sponsorship**: network fees can be paid by a sponsor, so fees never eat an agent's budget.
- **Real FX**: convert between stablecoins with live quotes from Tempo's built-in Stablecoin DEX.

## 🚦 Project status

| Area | Status |
| :--- | :--- |
| Agent budgets: authorize, live remaining limit, change limit, revoke, team caps | ✅ **Live on Tempo testnet** (`viem/tempo` access keys) |
| Pay runs: batched transfers with invoice memos | ✅ **Live on Tempo testnet** |
| Ledger rebuilt from chain + CSV export | ✅ **Live on Tempo testnet** |
| Stablecoin conversion via the Stablecoin DEX | ✅ **Live on Tempo testnet** |
| Fee sponsorship | ✅ **Server-side** fee-payer relay (`api/relay.mjs`, a Vercel function). The sponsor key lives only in the server environment; the relay only sponsors stablecoin (TIP-20) calls on testnet |
| Company account | 🟡 Passkey (WebAuthn) or a throwaway test key, stored in your browser. Testnet only |
| Agent keys | 🟡 Kept in the browser for testing. In production they live in the agent's own runtime |
| Pooled team budgets enforced on-chain | ❌ Not possible natively today (Tempo limits are per key). See [ROADMAP](ROADMAP.md) |
| Cash-out to local bank accounts / compliance | ❌ Planned through a licensed partner. Not built |
| Streaming payroll, merchant router and vault contracts | 🟡 Written and tested locally (10 Hardhat tests); **not deployed**. Shown as simulated demos |
| Mainnet | ❌ Not used. Do not use with real funds; nothing is audited |

## 🏛️ How it works

```
                 ┌───────────────────────── TempoFlow web app ─────────────────────────┐
                 │  Agents · Teams · People · Ledger · Treasury                         │
                 └──────────────┬───────────────────────────────┬──────────────────────┘
                                │ viem/tempo                    │ reads events
                                ▼                               ▼
┌──────────────────────────────────── Tempo (testnet: Moderato, chain 42431) ───────────────────────────────┐
│  Company account (passkey or test key)                                                                   │
│   ├─ Account Keychain: one access key per agent → daily limit · allowed recipients · expiry · revoke     │
│   ├─ TIP-20 transferWithMemo: every payment tagged with an agent/task or invoice memo                    │
│   ├─ Tempo transactions: batched calls (pay runs) · fee payer (sponsorship)                              │
│   └─ Stablecoin DEX: live quotes and swaps between stablecoins                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

TempoFlow adds no new contract for budgets: the protocol already enforces them. TempoFlow is the layer that companies
need on top: teams, caps, a ledger that joins agents and people, alerts and export.

## ⚡ Getting started

### Web app
```bash
npm run frontend:dev
```
Open the app, create a company account (passkey or test key), click **Get testnet funds**, then add an agent.
The UI uses one dark "graphite amber" theme on a 60/30/10 color system (see `frontend/src/index.css`).

### Fee sponsorship (optional)
Locally, run the relay next to the app. `--throwaway` uses a fresh in-memory testnet key funded by the faucet:
```bash
node scripts/relay-dev.mjs --throwaway
```
On Vercel, create a testnet sponsor key with `node scripts/new-sponsor-key.mjs` and add it as the environment
variable `TEMPO_SPONSOR_PRIVATE_KEY`. Without it, the app still works and agents pay their own fees.

### End-to-end smoke tests against Tempo testnet
Each run creates throwaway keys and uses faucet funds only.
```bash
cd frontend
node scripts/smoke-agent-budget.mjs   # authorize agent, pay with memo, overspend blocked, revoke
node scripts/smoke-payrun.mjs         # 3 payouts in 1 sponsored transaction, DEX quote + swap
node scripts/smoke-relay.mjs          # server relay sponsors an agent payment; policy refuses other calls
```

### Contracts (streaming payroll, merchant router, vault)
```bash
npm install
npx hardhat test
```
`hardhat.config.cjs` has a `tempoTestnet` network (Moderato, chain 42431). Nothing is deployed yet; see
[`deployments/`](deployments/README.md).

## 📦 Repository layout

| Path | What |
| :--- | :--- |
| `frontend/src/lib/tempo.js` | All Tempo calls: accounts, access keys, memos, pay runs, DEX, event history |
| `frontend/src/store/useWorkspace.js` | Workspace state (company, teams, agents, people) and the team-cap rule |
| `frontend/src/components/control/` | Control panel screens (Overview, Agents, People, Ledger, Treasury) |
| `frontend/src/components/layout/` | Sidebar app shell, bottom navigation on phones, theme switch |
| `frontend/src/index.css` | Design tokens: 60/30/10 color system (graphite amber) |
| `api/` | Vercel serverless fee-payer relay |
| `packages/agent-sdk/` | `@tempoflow/agent`: what an agent runs to pay, check its budget and call paid (MPP) APIs |
| `frontend/scripts/` | Testnet smoke tests |
| `contracts/` | `TempoFlowRouter`, `TempoPayrollStream`, `MerchantSettlementVault` (+ mocks) |
| `archive/` | Parked code (Solana intake) |
| `ROADMAP.md` | What's next and how work is tracked |

## 🔒 Security notes

- Testnet only. Keys in this prototype are stored in the browser's localStorage for convenience.
- Never give an agent an admin key: TempoFlow only creates limited, scoped, expiring keys.
- Contracts use checks-effects-interactions, a reentrancy lock, replay protection and an emergency pause, but are not
  audited.

## 📄 License
MIT. See [LICENSE](LICENSE).
