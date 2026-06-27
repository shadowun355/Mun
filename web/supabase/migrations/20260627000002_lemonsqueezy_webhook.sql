-- Lemon Squeezy billing: make the webhook upsert idempotent.
--
-- The webhook lands one row per LS subscription, keyed by (provider,
-- provider_subscription_id), and upserts on every lifecycle event (created /
-- updated / cancelled / expired). The existing idx_sub_provider is NON-unique, so
-- `upsert(onConflict: 'provider,provider_subscription_id')` has no constraint to
-- target. Add the matching unique index.
--
-- PLAIN (not partial): PostgREST emits `ON CONFLICT (provider,
-- provider_subscription_id)` with no WHERE predicate, and Postgres cannot use a
-- *partial* unique index for inference (error 42P10). A plain unique index works
-- and the legacy 'mock' rows still coexist — Postgres treats NULLs as distinct,
-- so multiple (mock, null) rows remain legal.

create unique index if not exists uniq_provider_subscription
  on subscriptions (provider, provider_subscription_id);
