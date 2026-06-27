-- Custom portfolio allocation buckets (Overview "การจัดสรร"). User-defined groups +
-- per-symbol assignment. Run this in the Supabase SQL editor. Idempotent (safe to re-run).
-- Until applied, loadUserData degrades both selects to [] and the Overview falls back to the
-- auto-category allocation — no crash, feature dormant.

create table if not exists alloc_groups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  color      text,                         -- CSS var or hex; null -> client picks a default
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

-- One bucket per (user, symbol). Deleting a bucket cascades these rows -> the holding
-- reverts to "unassigned" in the UI.
create table if not exists alloc_assign (
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  sym      text not null,
  group_id uuid not null references alloc_groups on delete cascade,
  primary key (user_id, sym)
);

alter table alloc_groups enable row level security;
alter table alloc_assign enable row level security;

drop policy if exists "alloc_groups own rows" on alloc_groups;
create policy "alloc_groups own rows" on alloc_groups
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "alloc_assign own rows" on alloc_assign;
create policy "alloc_assign own rows" on alloc_assign
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
