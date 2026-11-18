# TempoFlow roadmap

**Goal:** one stablecoin treasury where a company pays its **people** (contractors worldwide) and its **AI agents**, with
spend rules enforced by Tempo, one ledger, and exports an accountant can use.

Work is tracked as GitHub issues, grouped by milestone. Labels: `agents`, `payroll`, `treasury`, `infra`, `protocol`,
`research`.

## Why this, and not something already built

| Who | What they do | What they don't do |
| --- | --- | --- |
| Deel (on Tempo) | Stablecoin wallet for **contractors** of Deel customers | Pay or govern AI agents; serve teams outside Deel's platform |
| Ramp Agent Cards | Card-based spend controls for agents | Stablecoin-native, non-US companies, pay people and agents from one treasury |
| Tempo access keys | Per-agent limit, scope, expiry, revoke (protocol) | Teams, pooled caps, approvals, ledger, alerts, exports (a product layer) |
| Mercator / MPP | One agent paying for tools within a plan budget | Company-wide control over many agents |

## M1: Testnet MVP (done)

- [x] Correct Tempo testnet config (Moderato, chain 42431, `rpc.moderato.tempo.xyz`)
- [x] Company account: passkey or throwaway test key
- [x] Agents: authorize access key with daily limit, allowed recipients, expiry; live remaining limit; change limit; revoke
- [x] Teams with daily caps (sum of agent limits ≤ cap); stop a whole team
- [x] Pay runs: many payouts in one batched Tempo transaction, invoice numbers as TIP-20 memos
- [x] Fee sponsorship (testnet demo sponsor)
- [x] Real stablecoin FX via the Stablecoin DEX
- [x] Ledger rebuilt from chain (`TransferWithMemo` + `AccessKeySpend`), CSV export
- [x] Solana intake parked in `archive/`

## M2: Pilot-ready (next 4–6 weeks)

- [x] Server-side fee payer (`withFeePayer` transport + Vercel relay); browser sponsor key removed
- [x] Redesign: sidebar app, Overview page, 60/30/10 color system (graphite amber)
- [x] Agent SDK (`packages/agent-sdk`): pay with a task memo, budget checks, paid APIs over MPP
- [x] Hand-off of agent keys: generated in the agent runtime (`npx tempoflow-agent-keygen`); the panel only stores the key address
- [x] Alerts by webhook (Slack, Discord, any https URL) when an agent runs low, hits its limit, or nears expiry; email later
- [x] Limit-raise requests and approvals (agent asks with its own key, admin approves, `updateLimit` on-chain)
- [ ] Multiple admins per company (configurable accounts once available on testnet/mainnet)
- [x] Ledger: database-backed history synced from chain; filters by type, agent, team and date
- [ ] Accounting export formats (QuickBooks / Xero CSV)

## M3: People payouts for real

- [ ] Choose a licensed partner for KYC/KYB, cash-out and local rails (candidates: Bridge, BlindPay, Zero Hash)
- [x] Contractor self-onboarding by invite link: wallet pasted or created with a passkey, approved by an admin (bank details via a partner later)
- [x] Scheduled pay runs: reminders on the due date and one-click batched payment (no server-held keys; autopay with a limited payroll key is a possible later option)
- [ ] Deploy `TempoPayrollStream` to testnet using TIP-20 + memos, as the "pay per second" option
- [ ] Private payroll with Tempo Zones

## M4: Protocol work with Tempo

- [ ] Propose **pooled budgets across access keys** (a team/fleet limit enforced on-chain); today limits are per key only
- [ ] Adopt access-key policy contracts (TIP-1161) when live: richer per-call rules for agents
- [ ] Organization accounts (TIP-1164) for member policies, if it fits

## Not doing now

- Solana intake and a custom relayer (parked)
- Our own money-transmission licences (use a licensed partner)
- Mainnet with real funds before an audit
