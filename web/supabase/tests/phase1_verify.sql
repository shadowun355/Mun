-- ============================================================================
-- Phase 1 verification — run AFTER applying 20260624000001_*.sql
-- Paste into the Supabase SQL editor (runs as a privileged role). Each test
-- simulates a logged-in user by setting the JWT `sub` claim that auth.uid() reads.
-- Wrap in a transaction and roll back so the test leaves no data behind.
-- ============================================================================
begin;

-- A throwaway auth user to attribute usage/subscriptions to.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'phase1-test@mun.local')
  on conflict (id) do nothing;

-- Impersonate that user for the rest of the transaction.
select set_config('request.jwt.claims',
  json_build_object('sub','00000000-0000-0000-0000-000000000001')::text, true);

-- Free plan (limit 5) by default: no subscription row → RPC falls back to 'free'.

-- ---- Test 1: quota exhaustion — expect 5 allowed:true, then QUOTA_EXCEEDED ----
select 'fetch '||g as step, consume_external_quota(null) as result
from generate_series(1,6) g;
-- Expect rows 1-5 -> {"allowed":true,"count":N,"limit":5}; row 6 -> QUOTA_EXCEEDED.

select 'usage row' as check, external_fetch_count
from user_api_usage
where user_id = '00000000-0000-0000-0000-000000000001' and usage_date = current_date;
-- Expect external_fetch_count = 5 (never 6).

-- ---- Test 2: idempotency replay — same key must not double-charge ----------
-- Reset the day so we have headroom.
update user_api_usage set external_fetch_count = 0
  where user_id = '00000000-0000-0000-0000-000000000001';

select 'idem first'  as step, consume_external_quota('key-abc') as result;  -- charges (count 1)
select 'idem retry'  as step, consume_external_quota('key-abc') as result;  -- owner already; not double
select finalize_request('key-abc', '{"data":"ok"}'::jsonb);
select 'idem replay' as step, consume_external_quota('key-abc') as result;  -- replayed:true, response echoed

select 'after idem' as check, external_fetch_count
from user_api_usage
where user_id = '00000000-0000-0000-0000-000000000001' and usage_date = current_date;
-- Expect external_fetch_count = 1 (the single charge), not 2/3.

-- ---- Test 3: unlimited plan — enterprise never blocks ----------------------
insert into subscriptions (user_id, plan_id, status)
  values ('00000000-0000-0000-0000-000000000001', 'enterprise', 'active');
update user_api_usage set external_fetch_count = 0
  where user_id = '00000000-0000-0000-0000-000000000001';
select 'unlimited '||g as step, consume_external_quota(null) as result
from generate_series(1,8) g;
-- Expect all 8 -> {"allowed":true,"unlimited":true}.

-- ---- Test 4: trigram search uses the index --------------------------------
insert into symbol_metadata(symbol, market, provider, name, asset_type, currency, expires_at)
  values ('AAPL','US','yahoo','Apple Inc.','stock','USD', now() + interval '30 days')
  on conflict (symbol, market) do nothing;
explain (costs off)
  select symbol, name from symbol_metadata
  where name ilike '%appl%' or symbol ilike '%aapl%';
-- Expect a Bitmap Index Scan on idx_meta_name_trgm / idx_meta_symbol_trgm
-- (not a Seq Scan) once the table has enough rows for the planner to prefer it.

rollback;  -- leave the database untouched

-- ============================================================================
-- Test 5 (concurrency) — needs PARALLEL sessions; cannot run in one editor tab.
-- From a machine with psql + the project's connection string, with a seeded
-- free user already at external_fetch_count = 4 for today:
--
--   echo "select consume_external_quota(null);" > /tmp/q.sql
--   pgbench -n -c 10 -j 10 -t 1 -f /tmp/q.sql "$SUPABASE_DB_URL"
--
-- Then assert exactly one call returned allowed:true and the row never exceeds 5:
--   select external_fetch_count from user_api_usage
--     where user_id = '<free-user>' and usage_date = current_date;  -- must equal 5
--
-- (pgbench must authenticate as that user, or wrap the call in a SECURITY DEFINER
--  test shim that sets the jwt sub. The single-statement INSERT ... ON CONFLICT
--  DO UPDATE ... WHERE ... RETURNING guarantees at most `limit` successes.)
-- ============================================================================
