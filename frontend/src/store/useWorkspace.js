// Workspace state for the live control panel (Tempo testnet).
// Persisted in this browser's localStorage only. Testnet keys only; never put real funds here.

import { useSyncExternalStore } from 'react';
import * as T from '../lib/tempo';

const STORAGE_KEY = 'tempoflow.workspace.v1';

const EMPTY = {
  company: null, // { type: 'passkey' | 'testKey', address, credential? , privateKey? }
  sponsorFees: true, // use the server fee-payer relay when it is available
  relayReady: false, // not persisted in practice: refreshed on load
  teams: [
    { id: 'team-research', name: 'Research', dailyCap: 50 },
    { id: 'team-ops', name: 'Operations', dailyCap: 30 },
  ],
  agents: [], // { id, name, teamId, token, dailyLimit, recipients[], expiryDays, privateKey, keyAddress, status, authTx, authBlock, createdAt }
  contractors: [], // { id, name, address, amount, role }
  streams: [], // { id (bytes32), label, name, employee, token, amount, days, hash, createdAt, status }
  ledger: [], // local log of actions taken from this panel: { id, at, kind, label, amount, token, hash, memo }
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const { sponsor, ...saved } = JSON.parse(raw); // drop the old browser-held sponsor key
    return { ...EMPTY, ...saved, relayReady: false };
  } catch {
    return { ...EMPTY };
  }
}

let state = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private window): keep working in memory */
  }
}

function set(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  save();
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useWorkspace() {
  return useSyncExternalStore(subscribe, () => state);
}

/** Sponsorship is on only when the person wants it AND the server relay is configured. */
export const sponsoring = () => Boolean(state.sponsorFees && state.relayReady);

const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function log(entry) {
  set((s) => ({ ledger: [{ id: uid('l'), at: Date.now(), ...entry }, ...s.ledger].slice(0, 500) }));
}

// ---------- team budget rule ----------
// Tempo enforces each agent key's own limit on-chain. A pooled team budget is not native to Tempo,
// so TempoFlow keeps the SUM of active agent limits in a team at or under the team's daily cap.
export function teamAllocated(s, teamId, excludeAgentId) {
  return s.agents
    .filter((a) => a.teamId === teamId && a.status === 'active' && a.id !== excludeAgentId)
    .reduce((sum, a) => sum + Number(a.dailyLimit), 0);
}

export function checkTeamCap(s, teamId, dailyLimit, excludeAgentId) {
  const team = s.teams.find((t) => t.id === teamId);
  if (!team) return 'Pick a team';
  const after = teamAllocated(s, teamId, excludeAgentId) + Number(dailyLimit);
  if (after > Number(team.dailyCap) + 1e-9)
    return `Team "${team.name}" cap is ${T.usd(team.dailyCap)}/day; this would allocate ${T.usd(after)}/day.`;
  return null;
}

// ---------- actions ----------
export const actions = {
  async createCompany(kind) {
    const company = kind === 'passkey' ? await T.createPasskeyCompany('TempoFlow company (testnet)') : T.createTestKeyCompany();
    set({ company });
    log({ kind: 'setup', label: `Company account created (${kind === 'passkey' ? 'passkey' : 'test key'})` });
    return company;
  },

  async fund() {
    await T.fundFromFaucet(state.company.address);
    log({ kind: 'setup', label: 'Funded the company account from the testnet faucet' });
  },

  setSponsorFees(on) {
    set({ sponsorFees: on });
  },

  async checkRelay() {
    set({ relayReady: await T.relayAvailable() });
  },

  addTeam(name, dailyCap) {
    set((s) => ({ teams: [...s.teams, { id: uid('team'), name, dailyCap: Number(dailyCap) }] }));
  },

  updateTeamCap(teamId, dailyCap) {
    const allocated = teamAllocated(state, teamId);
    if (Number(dailyCap) < allocated) throw new Error(`Active agents already use ${T.usd(allocated)}/day of this team.`);
    set((s) => ({ teams: s.teams.map((t) => (t.id === teamId ? { ...t, dailyCap: Number(dailyCap) } : t)) }));
  },

  async addAgent({ name, teamId, token, dailyLimit, recipients, expiryDays, allowMpp, keySource = 'browser', keyAddress }) {
    const problem = checkTeamCap(state, teamId, dailyLimit);
    if (problem) throw new Error(problem);
    // 'runtime': the agent created its own key and shared only the address, so no private key is stored here.
    const key =
      keySource === 'runtime' ? { keyAddress, keySource: 'runtime' } : { ...T.newAgentKey(state.company.address), keySource: 'browser' };
    const agent = {
      id: uid('agent'),
      name,
      teamId,
      token,
      dailyLimit: Number(dailyLimit),
      recipients,
      expiryDays: Number(expiryDays),
      allowMpp: Boolean(allowMpp),
      ...key,
      status: 'pending',
      createdAt: Date.now(),
    };
    set((s) => ({ agents: [agent, ...s.agents] }));
    try {
      const { hash, blockNumber } = await T.authorizeAgent({ company: state.company, agent });
      set((s) => ({
        agents: s.agents.map((a) => (a.id === agent.id ? { ...a, status: 'active', authTx: hash, authBlock: Number(blockNumber) } : a)),
      }));
      log({ kind: 'agent', label: `Authorized agent "${name}" (${T.usd(dailyLimit)}/day)`, hash });
    } catch (e) {
      set((s) => ({ agents: s.agents.filter((a) => a.id !== agent.id) }));
      throw e;
    }
  },

  async raiseLimit(agentId, newLimit) {
    const agent = state.agents.find((a) => a.id === agentId);
    const problem = checkTeamCap(state, agent.teamId, newLimit, agentId);
    if (problem) throw new Error(problem);
    const hash = await T.updateAgentLimit({ company: state.company, agent, newLimit });
    set((s) => ({ agents: s.agents.map((a) => (a.id === agentId ? { ...a, dailyLimit: Number(newLimit) } : a)) }));
    log({ kind: 'agent', label: `Changed "${agent.name}" limit to ${T.usd(newLimit)}/day`, hash });
    return hash;
  },

  async revoke(agentId) {
    const agent = state.agents.find((a) => a.id === agentId);
    const hash = await T.revokeAgent({ company: state.company, agent });
    set((s) => ({ agents: s.agents.map((a) => (a.id === agentId ? { ...a, status: 'revoked', privateKey: undefined } : a)) }));
    log({ kind: 'agent', label: `Revoked agent "${agent.name}"`, hash });
  },

  async revokeTeam(teamId) {
    const active = state.agents.filter((a) => a.teamId === teamId && a.status === 'active');
    for (const a of active) await actions.revoke(a.id);
  },

  async agentTestPay(agentId, { to, amount, task }) {
    const agent = state.agents.find((a) => a.id === agentId);
    if (!agent.privateKey) throw new Error("This agent's key lives in its own runtime, so only the agent can pay with it.");
    const memo = `a:${agent.name.slice(0, 12)}|t:${task}`.slice(0, 32);
    const hash = await T.agentPay({
      companyAddress: state.company.address,
      agent,
      to,
      amount,
      memo,
      sponsored: sponsoring(),
    });
    log({ kind: 'agent-spend', label: `Agent "${agent.name}" paid ${T.short(to)}`, amount: Number(amount), token: agent.token, hash, memo });
    return hash;
  },

  addContractor({ name, address, amount, role }) {
    set((s) => ({ contractors: [...s.contractors, { id: uid('person'), name, address, amount: Number(amount), role }] }));
  },

  removeContractor(id) {
    set((s) => ({ contractors: s.contractors.filter((c) => c.id !== id) }));
  },

  /** Pay per second (issue #14): funds a stream in one transaction; the label is the on-chain memo. */
  async startStream({ contractor, amount, days, token }) {
    const slug = contractor.name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10) || 'pay';
    const label = `S-${new Date().toISOString().slice(0, 7)}-${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const { id, hash } = await T.createStream({
      company: state.company,
      employee: contractor.address,
      token,
      amount,
      durationSeconds: Math.round(Number(days) * 86_400),
      label,
    });
    const stream = { id, label, name: contractor.name, employee: contractor.address, token, amount: Number(amount), days: Number(days), hash, createdAt: Date.now(), status: 'active' };
    set((s) => ({ streams: [stream, ...s.streams] }));
    log({ kind: 'payroll', label: `Started paying ${contractor.name} per second (${T.usd(amount)} over ${days} days)`, amount: Number(amount), token, hash, memo: label });
    return hash;
  },

  async stopStream(id) {
    const stream = state.streams.find((x) => x.id === id);
    const hash = await T.cancelStream({ company: state.company, id });
    set((s) => ({ streams: s.streams.map((x) => (x.id === id ? { ...x, status: 'stopped' } : x)) }));
    log({ kind: 'payroll', label: `Stopped the stream to ${stream?.name ?? 'contractor'} (earned part paid, rest returned)`, hash, memo: stream?.label });
    return hash;
  },

  async runPayroll({ token, period }) {
    const lines = state.contractors.map((c, i) => ({
      address: c.address,
      amount: c.amount,
      memo: `INV-${period}-${String(i + 1).padStart(3, '0')}`,
      name: c.name,
    }));
    if (!lines.length) throw new Error('Add at least one contractor');
    const hash = await T.payRun({ company: state.company, lines, token, sponsored: sponsoring() });
    const total = lines.reduce((s, l) => s + Number(l.amount), 0);
    lines.forEach((l) => log({ kind: 'payroll', label: `Paid ${l.name}`, amount: Number(l.amount), token, hash, memo: l.memo }));
    log({ kind: 'payroll', label: `Pay run ${period}: ${lines.length} people in 1 transaction (${T.usd(total)})`, hash });
    return hash;
  },

  async convert({ tokenIn, tokenOut, amount }) {
    const { hash, quoted } = await T.fxConvert({ company: state.company, tokenIn, tokenOut, amount });
    log({
      kind: 'fx',
      label: `Converted ${amount} ${T.tokenSymbol(tokenIn)} → ~${quoted.toFixed(2)} ${T.tokenSymbol(tokenOut)} on the Stablecoin DEX`,
      amount: Number(amount),
      token: tokenIn,
      hash,
    });
    return hash;
  },

  reset() {
    set({ ...EMPTY });
  },
};
