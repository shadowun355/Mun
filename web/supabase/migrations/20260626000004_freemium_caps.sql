-- Phase 8 (PortPro parity) — freemium caps, server-enforced. Run in the Supabase SQL
-- editor AFTER the buy_plans (Phase 4) and alerts (Phase 6) migrations. Idempotent.
--
-- Reuses the existing plans/subscriptions tables (SymbolUniverse foundation). A user with
-- no active subscription (or plan 'free') is Free; an active non-free sub is Pro.
-- Free caps: ≤5 distinct traded assets, ≤1 saved buy plan, ≤3 alerts. DB triggers are the
-- source of truth — the client only translates the raised error into an upgrade prompt.

-- Pro check: active, non-free, unexpired subscription for the current user.
create or replace function user_is_pro()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from subscriptions
    where user_id = auth.uid() and status in ('active','trialing')
      and plan_id <> 'free' and (expires_at is null or expires_at > now())
  );
$$;

-- ≤5 distinct traded symbols (only a buy can introduce a new asset).
create or replace function enforce_free_asset_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if user_is_pro() or new.side <> 'buy' then return new; end if;
  if not exists (select 1 from transactions where user_id = new.user_id and sym = new.sym)
     and (select count(distinct sym) from transactions where user_id = new.user_id) >= 5 then
    raise exception 'FREE_ASSET_CAP';
  end if;
  return new;
end $$;
drop trigger if exists trg_free_asset_cap on transactions;
create trigger trg_free_asset_cap before insert on transactions
  for each row execute function enforce_free_asset_cap();

-- ≤1 saved buy plan.
create or replace function enforce_free_plan_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if user_is_pro() then return new; end if;
  if (select count(*) from buy_plans where user_id = new.user_id) >= 1 then
    raise exception 'FREE_PLAN_CAP';
  end if;
  return new;
end $$;
drop trigger if exists trg_free_plan_cap on buy_plans;
create trigger trg_free_plan_cap before insert on buy_plans
  for each row execute function enforce_free_plan_cap();

-- ≤3 alerts.
create or replace function enforce_free_alert_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if user_is_pro() then return new; end if;
  if (select count(*) from alerts where user_id = new.user_id) >= 3 then
    raise exception 'FREE_ALERT_CAP';
  end if;
  return new;
end $$;
drop trigger if exists trg_free_alert_cap on alerts;
create trigger trg_free_alert_cap before insert on alerts
  for each row execute function enforce_free_alert_cap();

-- Mock upgrade path: a user may self-serve a MOCK-provider subscription (demo only).
-- Real billing (provider='stripe') stays service-role / webhook — never client-writable.
drop policy if exists subs_own_mock_write on subscriptions;
create policy subs_own_mock_write on subscriptions
  for all using (user_id = auth.uid() and provider = 'mock')
  with check (user_id = auth.uid() and provider = 'mock');
