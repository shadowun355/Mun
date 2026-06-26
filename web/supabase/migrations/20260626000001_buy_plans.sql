-- Phase 4 (PortPro parity) — saved DCA / averaging-down plans, per user.
-- Run this in the Supabase SQL editor. Idempotent (safe to re-run).
-- NOTE: table is buy_plans, NOT plans — `plans` is taken by the subscription-tier catalog.

create table if not exists buy_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  sym        text not null,
  levels     jsonb not null default '[]'::jsonb,   -- [{ price, qty }] in USD (canonical)
  created_at timestamptz not null default now()
);

alter table buy_plans enable row level security;

-- Own-rows full CRUD (same pattern as transactions/watchlist/prefs).
drop policy if exists "buy_plans own rows" on buy_plans;
create policy "buy_plans own rows" on buy_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists buy_plans_user_idx on buy_plans (user_id, created_at desc);
