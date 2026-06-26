-- Phase 7 (PortPro parity) — daily portfolio-value snapshots for the growth trend.
-- Run this in the Supabase SQL editor. Idempotent (safe to re-run).
-- One row per (user, date); the app upserts today's total on load + each refresh.

create table if not exists portfolio_snapshots (
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  date      date not null default current_date,
  total_usd numeric not null,                 -- USD-canonical portfolio value
  primary key (user_id, date)
);

alter table portfolio_snapshots enable row level security;

drop policy if exists "snapshots own rows" on portfolio_snapshots;
create policy "snapshots own rows" on portfolio_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
