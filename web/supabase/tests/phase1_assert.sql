-- ============================================================================
-- Phase 1 HARD assertions — run AFTER applying 20260624000001_*.sql
-- Unlike phase1_verify.sql (eyeball the grids), this RAISES on any failure.
-- "Success. No rows returned" => all checks passed. Any error names the check.
-- Wrapped in a transaction + rollback: leaves the database untouched.
-- ============================================================================
begin;

do $$
declare
  uid uuid := '00000000-0000-0000-0000-000000000001';
  r jsonb;
  n int;
  i int;
  allowed_count int := 0;
begin
  insert into auth.users (id, email) values (uid, 'phase1-test@mun.local')
    on conflict (id) do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text)::text, true);

  -- Test 1: free plan allows 5, denies the 6th.
  for i in 1..6 loop
    r := consume_external_quota(null);
    if (r->>'allowed')::bool then allowed_count := allowed_count + 1; end if;
  end loop;
  if allowed_count <> 5 then
    raise exception 'T1 quota: expected 5 allowed, got %', allowed_count;
  end if;
  select external_fetch_count into n from user_api_usage
    where user_id = uid and usage_date = current_date;
  if n <> 5 then raise exception 'T1 usage row: expected 5, got %', n; end if;

  -- Test 2: idempotent key must not double-charge.
  update user_api_usage set external_fetch_count = 0 where user_id = uid;
  perform consume_external_quota('key-abc');  -- charge once
  perform consume_external_quota('key-abc');  -- same owner, no double
  perform finalize_request('key-abc', '{"data":"ok"}'::jsonb);
  r := consume_external_quota('key-abc');      -- replayed
  if not (r->>'replayed')::bool then
    raise exception 'T2 idempotency: 3rd call not flagged replayed: %', r;
  end if;
  select external_fetch_count into n from user_api_usage
    where user_id = uid and usage_date = current_date;
  if n <> 1 then raise exception 'T2 double-charge: expected count 1, got %', n; end if;

  -- Test 3: unlimited (enterprise) never blocks.
  insert into subscriptions (user_id, plan_id, status)
    values (uid, 'enterprise', 'active');
  update user_api_usage set external_fetch_count = 0 where user_id = uid;
  for i in 1..8 loop
    r := consume_external_quota(null);
    if not (r->>'allowed')::bool then
      raise exception 'T3 unlimited: call % blocked: %', i, r;
    end if;
  end loop;

  raise notice 'ALL PHASE 1 ASSERTIONS PASSED';
end $$;

rollback;
