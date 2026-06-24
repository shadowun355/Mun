-- ============================================================================
-- Phase 1 — Symbol Universe & Freemium Foundation
-- ----------------------------------------------------------------------------
-- One atomic migration: a foundation whose FKs and RPCs reference each other,
-- so it must apply all-or-nothing in this order (extensions → tables → indexes
-- → RLS → functions → seed). Splitting into per-table files would only add
-- ordering ceremony for no benefit when they always ship together.
--
-- Apply: `supabase db push` (CLI) or paste into the Supabase SQL editor.
-- Idempotent-ish: uses `if not exists` / `create or replace` where safe so a
-- re-run is non-destructive. Tables use plain `create table` (a re-run errors
-- loudly rather than masking drift — intentional for a foundation migration).
-- ============================================================================

-- 1a. Extensions ------------------------------------------------------------
create extension if not exists pg_trgm;    -- trigram indexes for symbol/name search
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- 1b. plans -----------------------------------------------------------------
-- Catalog of subscription tiers. Text slug PK: stable, human-readable, seedable,
-- and referenced directly from code without a uuid lookup.
create table plans (
  id                   text primary key,                  -- 'free','plus','pro','enterprise'
  name                 text not null,
  daily_external_limit integer,                            -- NULL = unlimited
  monthly_price_cents  integer not null default 0,
  features             jsonb   not null default '{}'::jsonb,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);

-- 1c. subscriptions ---------------------------------------------------------
-- History-capable (a user accumulates rows over time); the partial-unique index
-- enforces at most one active/trialing subscription per user.
create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users on delete cascade,
  plan_id                  text not null references plans(id),
  status                   text not null check (status in
                             ('active','trialing','past_due','canceled','expired')),
  provider                 text not null default 'mock' check (provider in
                             ('mock','stripe','lemonsqueezy','revenuecat')),
  provider_customer_id     text,
  provider_subscription_id text,
  starts_at                timestamptz not null default now(),
  expires_at               timestamptz,                    -- NULL = open-ended
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
-- One active sub per user; also the index the quota RPC uses to resolve a plan.
create unique index uniq_active_sub_per_user
  on subscriptions(user_id) where status in ('active','trialing');
-- Future webhook reconciliation (Stripe/LemonSqueezy map events by provider id).
create index idx_sub_provider
  on subscriptions(provider, provider_subscription_id);

-- 1d. user_api_usage --------------------------------------------------------
-- Daily external-fetch counter. No cron reset: each day is a fresh row keyed by
-- current_date, so "today's usage" is a single PK lookup and old days just age out.
create table user_api_usage (
  user_id              uuid    not null references auth.users on delete cascade,
  usage_date           date    not null default current_date,
  external_fetch_count integer not null default 0,
  updated_at           timestamptz not null default now(),
  primary key (user_id, usage_date)
);
create index idx_usage_date on user_api_usage(usage_date);  -- future retention sweep

-- 1e. symbol_metadata (static, long TTL) ------------------------------------
create table symbol_metadata (
  symbol     text not null,
  market     text not null,                 -- 'US','TH','CRYPTO','COMMODITY'
  provider   text not null,                 -- source of record
  name       text,
  exchange   text,
  country    text,
  asset_type text,                          -- 'stock','etf','crypto','commodity','index'
  currency   text,
  sector     text,
  industry   text,
  data       jsonb   not null default '{}'::jsonb,  -- raw provider extras
  is_active  boolean not null default true,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,          -- long TTL (~30d)
  primary key (symbol, market)
);
-- Trigram indexes serve partial match on BOTH symbol and company name (req 7) at scale.
create index idx_meta_symbol_trgm on symbol_metadata using gin (symbol gin_trgm_ops);
create index idx_meta_name_trgm   on symbol_metadata using gin (name   gin_trgm_ops);
-- Refresh sweeps find stale active rows without a full scan.
create index idx_meta_expires on symbol_metadata(expires_at) where is_active;

-- 1f. symbol_quote (volatile, short TTL, multi-provider) --------------------
-- provider in the PK so several providers can hold a quote for the same symbol;
-- resolution picks the highest-priority fresh row. No hard FK to metadata: a
-- lazy fetch may write a quote first; the service writes metadata before quote.
create table symbol_quote (
  symbol     text not null,
  market     text not null,
  provider   text not null,
  price      numeric,
  day_pct    numeric,
  open numeric, high numeric, low numeric,
  volume     numeric,
  market_cap numeric,
  currency   text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,          -- short TTL (~60s–15m by market)
  primary key (symbol, market, provider)
);
create index idx_quote_expires on symbol_quote(expires_at);

-- 1g. idempotency_keys ------------------------------------------------------
-- A client-supplied key per logical request makes quota consumption and cache
-- writes safe under retries/timeouts/duplicates.
create table idempotency_keys (
  key                 text primary key,       -- client UUID per logical request
  user_id             uuid not null references auth.users on delete cascade,
  request_fingerprint text not null,          -- hash(method+route+params); guards key reuse
  response            jsonb,                   -- stored to replay on retry
  status              text not null default 'in_progress'
                        check (status in ('in_progress','completed')),
  consumed_quota      boolean not null default false,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default now() + interval '24 hours'
);
create index idx_idem_expires on idempotency_keys(expires_at);

-- ============================================================================
-- Row Level Security
-- The Edge Function uses the service-role key for all cache/subscription writes
-- (bypasses RLS); the quota RPCs are SECURITY DEFINER. Clients may only READ
-- their own rows + public cache/plans — never mutate quota, cache, or plan.
-- ============================================================================
alter table plans            enable row level security;
alter table subscriptions    enable row level security;
alter table user_api_usage   enable row level security;
alter table symbol_metadata  enable row level security;
alter table symbol_quote     enable row level security;
alter table idempotency_keys enable row level security;

create policy plans_read    on plans          for select using (true);
create policy subs_own_read on subscriptions  for select using (user_id = auth.uid());
create policy usage_own_read on user_api_usage for select using (user_id = auth.uid());
create policy meta_read     on symbol_metadata for select using (true);
create policy quote_read    on symbol_quote    for select using (true);
create policy idem_own_read on idempotency_keys for select using (user_id = auth.uid());

-- ============================================================================
-- 1i. Atomic quota + idempotency RPCs
-- ============================================================================

-- consume_external_quota(idempotency_key)
-- Atomically charges one external fetch against the caller's daily quota.
-- Concurrency: the INSERT ... ON CONFLICT DO UPDATE ... WHERE ... RETURNING is a
-- single statement; concurrent callers serialize on the one usage row, and only
-- increments strictly below the limit succeed. Idempotency: a given key consumes
-- at most once (consumed_quota flag), and a completed key replays its response.
create or replace function consume_external_quota(p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_limit    integer;
  v_count    integer;
  v_owned    text;
  v_status   text;
  v_response jsonb;
begin
  if v_user is null then
    return jsonb_build_object('allowed', false, 'error_code', 'UNAUTHENTICATED');
  end if;

  -- Idempotency ownership gate. The INSERT ... ON CONFLICT DO NOTHING RETURNING is
  -- the serialization point: exactly one concurrent caller "owns" a given key (gets
  -- a row back) and proceeds to charge quota; everyone else (v_owned null) is a
  -- duplicate and never charges. Closes the select-then-insert TOCTOU race.
  if p_idempotency_key is not null then
    insert into idempotency_keys(key, user_id, request_fingerprint, status, consumed_quota)
      values (p_idempotency_key, v_user, '', 'in_progress', false)
      on conflict (key) do nothing
      returning key into v_owned;

    if v_owned is null then
      -- Not the owner: another request holds this key. Replay if it has finished,
      -- else signal in-progress — never double-charge.
      select status, response into v_status, v_response
        from idempotency_keys where key = p_idempotency_key and user_id = v_user;
      if v_status = 'completed' then
        return jsonb_build_object('allowed', true, 'replayed', true, 'response', v_response);
      end if;
      return jsonb_build_object('allowed', false, 'error_code', 'REQUEST_IN_PROGRESS',
        'message', 'A matching request is already being processed.');
    end if;
  end if;

  -- Effective daily limit: active subscription's plan, else the free plan.
  select p.daily_external_limit into v_limit
    from subscriptions s join plans p on p.id = s.plan_id
    where s.user_id = v_user and s.status in ('active','trialing')
      and (s.expires_at is null or s.expires_at > now())
    order by s.starts_at desc
    limit 1;
  if not found then
    select daily_external_limit into v_limit from plans where id = 'free';
  end if;

  -- Unlimited tier: record usage for observability, never block.
  if v_limit is null then
    insert into user_api_usage(user_id, usage_date, external_fetch_count)
      values (v_user, current_date, 1)
      on conflict (user_id, usage_date)
      do update set external_fetch_count = user_api_usage.external_fetch_count + 1,
                    updated_at = now();
    if p_idempotency_key is not null then
      update idempotency_keys set consumed_quota = true where key = p_idempotency_key;
    end if;
    return jsonb_build_object('allowed', true, 'unlimited', true);
  end if;

  if v_limit <= 0 then
    -- Denied: the owner did no durable work, so free its key for a later retry.
    if v_owned is not null then
      delete from idempotency_keys where key = p_idempotency_key and user_id = v_user;
    end if;
    return jsonb_build_object('allowed', false, 'error_code', 'QUOTA_EXCEEDED',
      'message', 'Upgrade to continue.', 'limit', v_limit);
  end if;

  -- Atomic check-and-increment. Over-limit rows fail the WHERE → 0 rows → NULL → deny.
  insert into user_api_usage(user_id, usage_date, external_fetch_count)
    values (v_user, current_date, 1)
    on conflict (user_id, usage_date)
    do update set external_fetch_count = user_api_usage.external_fetch_count + 1,
                  updated_at = now()
    where user_api_usage.external_fetch_count < v_limit
    returning external_fetch_count into v_count;

  if v_count is null then
    -- Over the daily limit: free the owner's key so a post-upgrade retry can re-run.
    if v_owned is not null then
      delete from idempotency_keys where key = p_idempotency_key and user_id = v_user;
    end if;
    return jsonb_build_object('allowed', false, 'error_code', 'QUOTA_EXCEEDED',
      'message', 'Upgrade to Premium to continue.', 'limit', v_limit);
  end if;

  if p_idempotency_key is not null then
    update idempotency_keys set consumed_quota = true where key = p_idempotency_key;
  end if;

  return jsonb_build_object('allowed', true, 'count', v_count, 'limit', v_limit);
end;
$$;

-- finalize_request(key, response): mark a request completed and store its
-- response so a later retry of the same key replays instead of re-running.
create or replace function finalize_request(p_key text, p_response jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  update idempotency_keys
    set status = 'completed', response = p_response
    where key = p_key and user_id = v_user;
end;
$$;

-- Lock down execution: anon cannot call; authenticated users can.
revoke all on function consume_external_quota(text) from public, anon;
revoke all on function finalize_request(text, jsonb) from public, anon;
grant execute on function consume_external_quota(text) to authenticated;
grant execute on function finalize_request(text, jsonb) to authenticated;

-- ============================================================================
-- Seed: plan catalog. Limits/prices are tunable; NULL daily_external_limit =
-- unlimited. Re-runnable via upsert.
-- ============================================================================
insert into plans (id, name, daily_external_limit, monthly_price_cents, features) values
  ('free',       'Free',       5,    0,    '{"watchlist_max":10}'),
  ('plus',       'Plus',       500,  499,  '{"watchlist_max":100}'),
  ('pro',        'Pro',        5000, 1499, '{"watchlist_max":1000,"alerts":true}'),
  ('enterprise', 'Enterprise', null, 0,    '{"unlimited":true}')
on conflict (id) do update set
  name = excluded.name,
  daily_external_limit = excluded.daily_external_limit,
  monthly_price_cents = excluded.monthly_price_cents,
  features = excluded.features;
