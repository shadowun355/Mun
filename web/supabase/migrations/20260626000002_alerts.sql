-- Phase 6 (PortPro parity) — price alerts per symbol, per user. In-app delivery.
-- Run this in the Supabase SQL editor. Idempotent (safe to re-run).
-- price is USD-canonical (same convention as transactions.price_usd).

create table if not exists alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  sym          text not null,
  op           text not null check (op in ('above', 'below')),
  price        numeric not null,            -- USD-canonical threshold
  active       boolean not null default true,
  triggered_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table alerts enable row level security;

drop policy if exists "alerts own rows" on alerts;
create policy "alerts own rows" on alerts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists alerts_user_idx on alerts (user_id, created_at desc);
