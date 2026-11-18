-- TempoFlow database schema (Supabase Postgres). Safe to run more than once.
-- Only TempoFlow's server functions use these tables. Row Level Security is ON with no policies, so Supabase's
-- public Data API (anon key) can't read or write them. The server connects as the table owner, which bypasses RLS.

-- Agents known to a company (labels for the ledger; the rules themselves live on Tempo).
create table if not exists agents (
  company       text        not null,
  key_address   text        not null,
  name          text        not null,
  team          text,
  token         text        not null,
  daily_limit   numeric     not null,
  status        text        not null default 'active',
  auth_block    bigint,
  updated_at    timestamptz not null default now(),
  primary key (company, key_address)
);

-- People a company pays (labels for payroll rows; filled by onboarding or the People page).
create table if not exists contractors (
  company       text        not null,
  wallet        text        not null,
  name          text        not null,
  role          text,
  amount        numeric,
  updated_at    timestamptz not null default now(),
  primary key (company, wallet)
);

-- Ledger rows indexed from Tempo (issue #9).
create table if not exists ledger_rows (
  company       text        not null,
  tx_hash       text        not null,
  log_index     integer     not null,
  block_number  bigint      not null,
  at            timestamptz,
  kind          text        not null,          -- 'agent' | 'payroll' | 'agent_fee'
  key_address   text,                          -- agent access key that spent it (null for company payouts)
  payee         text,
  token         text        not null,
  amount        numeric     not null,
  memo          text,
  remaining     numeric,                       -- agent limit left after this spend
  primary key (company, tx_hash, log_index)
);
create index if not exists ledger_rows_company_block on ledger_rows (company, block_number desc);
create index if not exists ledger_rows_company_key on ledger_rows (company, key_address);

create table if not exists sync_state (
  company       text        primary key,
  last_block    bigint      not null,
  updated_at    timestamptz not null default now()
);

-- Alerts (issue #6).
create table if not exists alert_rules (
  id            uuid        primary key default gen_random_uuid(),
  company       text        not null,
  kind          text        not null,          -- 'low_budget' | 'limit_hit' | 'expiry'
  threshold     numeric,                       -- percent left for low_budget, days for expiry
  webhook_url   text        not null,
  enabled       boolean     not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists alert_rules_company on alert_rules (company);

create table if not exists alert_events (
  id            uuid        primary key default gen_random_uuid(),
  company       text        not null,
  rule_id       uuid        references alert_rules(id) on delete cascade,
  key_address   text,
  message       text        not null,
  dedupe_key    text        not null unique,   -- one alert per rule, agent and budget period
  status        text        not null,          -- 'sent' | 'failed'
  created_at    timestamptz not null default now()
);

-- Limit-raise requests from agents (issue #7).
create table if not exists limit_requests (
  id              uuid        primary key default gen_random_uuid(),
  company         text        not null,
  key_address     text        not null,
  requested_limit numeric     not null,
  reason          text,
  status          text        not null default 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at      timestamptz not null default now(),
  decided_at      timestamptz,
  decided_tx      text
);
create index if not exists limit_requests_company on limit_requests (company, status);

-- Contractor invites (issue #12). Only a hash of the invite secret is stored.
create table if not exists contractor_invites (
  id            uuid        primary key default gen_random_uuid(),
  company       text        not null,
  secret_hash   text        not null unique,
  name          text        not null,
  amount        numeric,
  status        text        not null default 'sent',      -- 'sent' | 'submitted' | 'approved' | 'cancelled'
  wallet        text,
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  expires_at    timestamptz not null
);
create index if not exists contractor_invites_company on contractor_invites (company, status);

-- Scheduled pay runs (issue #13).
create table if not exists pay_schedules (
  id            uuid        primary key default gen_random_uuid(),
  company       text        not null,
  cadence       text        not null,          -- 'weekly' | 'monthly'
  next_run      date        not null,
  token         text        not null,
  enabled       boolean     not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists pay_runs (
  id            uuid        primary key default gen_random_uuid(),
  company       text        not null,
  schedule_id   uuid        references pay_schedules(id) on delete set null,
  period        text        not null,
  status        text        not null,          -- 'due' | 'paid' | 'failed'
  tx_hash       text,
  total         numeric,
  created_at    timestamptz not null default now(),
  unique (schedule_id, period)
);

-- Lock everything down from the public Data API.
alter table agents             enable row level security;
alter table contractors        enable row level security;
alter table ledger_rows        enable row level security;
alter table sync_state         enable row level security;
alter table alert_rules        enable row level security;
alter table alert_events       enable row level security;
alter table limit_requests     enable row level security;
alter table contractor_invites enable row level security;
alter table pay_schedules      enable row level security;
alter table pay_runs           enable row level security;
