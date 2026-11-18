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
| Pay schedules (weekly/monthly): reminder on the due date, one-click batched pay run | ✅ Reminder model: the server never holds a key that can move money; each run is recorded with its transaction |
| Contractor invites: a link where the contractor adds (or creates, with a passkey) their wallet; admin approves | ✅ Only a hash of the link secret is stored; links expire after 14 days |
| Limit requests: an agent asks for a higher limit (signed with its own key); an admin approves on-chain | ✅ Approval is checked against the company's real `updateLimit` transaction |
| Alerts: low budget, limit used up, key expiring → Slack/Discord/any webhook | ✅ Checked while the Agents page is open, after each ledger sync, and daily by Vercel Cron (needs `CRON_SECRET`) |
| Database ledger: full history, filters by type/agent/team/date | ✅ Supabase Postgres, synced from chain; sign in by signing a message (passkey or key), no passwords |
| Stablecoin conversion via the Stablecoin DEX | ✅ **Live on Tempo testnet** |
| Fee sponsorship | ✅ **Server-side** fee-payer relay (`frontend/api/relay.mjs`, a Vercel function). The sponsor key lives only in the server environment; the relay only sponsors stablecoin (TIP-20) calls on testnet |
| Company account | 🟡 Passkey (WebAuthn) or a throwaway test key, stored in your browser. Testnet only |
| Agent keys | ✅ Created in the agent's own runtime (`npx tempoflow-agent-keygen`); TempoFlow stores only the key address. A browser test key is still available for quick demos |
| Pooled team budgets enforced on-chain | ❌ Not possible natively today (Tempo limits are per key). See [ROADMAP](ROADMAP.md) |
| Cash-out to local bank accounts / compliance | ❌ Planned through a licensed partner. Not built |
| Pay per second: `TempoPayrollStream` on Tempo testnet ([0x70d6…97af](https://explore.testnet.tempo.xyz/address/0x70d6e4df698adc0d91ab57a020877bc61e0597af)) | ✅ Funded in one transaction; every movement carries the stream label as its TIP-20 memo; contractor link to watch and withdraw; no owner or admin |
| Merchant router and vault contracts | 🟡 Tested locally (Hardhat); not deployed. Shown as simulated demos |
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
node scripts/api-dev.mjs --throwaway
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
node scripts/smoke-key-handoff.mjs    # agent makes its own key; app authorizes only the address; agent pays
```

### Database (optional)
Server features (full ledger history and filters, and later alerts, approvals, onboarding and schedules) use Postgres,
for example Supabase connected through Vercel → Storage. Vercel then provides `POSTGRES_URL`. Locally, put the same
values in `frontend/.env.local` (git-ignored), then:
```bash
cd frontend
node db/migrate.mjs                 # creates the tables (safe to re-run; Row Level Security on)
node ../scripts/api-dev.mjs          # local stand-in for the Vercel functions (in another terminal)
node scripts/test-api-session.mjs   # sign-in tests
node scripts/test-api-ledger.mjs    # database ledger tests against testnet
node scripts/test-api-alerts.mjs    # alerts (start api-dev with --throwaway --allow-local-webhooks)
node scripts/test-api-limit-requests.mjs  # limit requests and approvals
node scripts/test-api-invites.mjs   # contractor invites and onboarding
node scripts/test-api-schedules.mjs # pay schedules, reminders and recorded runs
node scripts/smoke-stream.mjs       # pay per second on the deployed stream contract
```
The daily alert check and pay-run reminders run as a Vercel Cron job (`frontend/vercel.json`). Set `CRON_SECRET` in Vercel (any long random
string) so only Vercel can trigger it.

Sign-in sessions are signed with `TEMPOFLOW_SESSION_SECRET` (or the Supabase integration's `SUPABASE_JWT_SECRET`).

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
| `frontend/api/` | Vercel functions: fee-payer relay, sign-in, ledger sync and queries (Vercel builds from `frontend/`) |
| `frontend/db/` | Database schema and migration script |
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
