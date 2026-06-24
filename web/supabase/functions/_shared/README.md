# SymbolUniverse service layer (Phase 2)

Deno/TypeScript shared modules imported by the Edge Functions (Phase 3). All
business logic lives here — Edge Functions stay thin (parse → call a service →
format the response).

## Folder structure

```
web/supabase/functions/
  _shared/
    types.ts                 domain contracts (Market, AssetType, SymbolMeta, Quote, Ok<T>)
    errors.ts                AppError + ErrorCode + consistent failure body
    env.ts                   fail-fast env access (service key, provider keys)
    http.ts                  fetchJSON with hard timeout (retry/breaker = Phase 4)
    supabase.ts              serviceClient / userClient / requireUser
    providers/
      provider.ts            Provider interface + symbol-mapping helpers
      yahoo.ts               primary (keyless; US/ETF search + .BK Thai probe + quote)
      finnhub.ts             secondary (US, key-gated)
      alphavantage.ts        last resort (US, ~25 req/day)
    services/
      provider.service.ts    provider priority + merge/fallback (no cache/quota)
      cache.service.ts       two-table read/write-through cache (TTL by kind/market)
      ratelimit.service.ts   wraps the Phase 1 quota RPCs (atomicity is in Postgres)
      search.service.ts      cache-first search orchestrator
      quote.service.ts       single-symbol resolve + stale-while-revalidate
  search/  quote/            Edge Functions (Phase 3) — not yet created
```

## Layers & responsibilities

| Layer | Owns | Must NOT |
|-------|------|----------|
| **Edge Function** (Ph3) | auth, parse/validate, call a service, format `Ok`/`AppError` | business logic |
| **SearchService / QuoteService** | the orchestration flow (cache→quota→provider→write) | provider details, SQL |
| **RateLimitService** | calling `consume_external_quota` / `finalize_request` | counting/limits (that's the RPC) |
| **CacheService** | the only code touching `symbol_metadata` / `symbol_quote` | provider calls, quota |
| **ProviderService** | provider order + merge/fallback | cache, quota |
| **Provider** (yahoo/finnhub/av) | one upstream's search+quote, normalized | knowing about other providers |

Dependencies point downward only; each layer is swappable behind its interface
and testable in isolation (inject a fake CacheService / ProviderService).

**Provider priority:** cache (CacheService, free) → Yahoo → Finnhub → Alpha
Vantage. Add a provider = new file implementing `Provider`, then one line in
`ProviderService.providers`.

## Error handling

Every layer throws `AppError(code, message, details?)`. The Edge Function boundary
is the single place that catches and serializes:

- success → `{ "success": true, "data": ... , "meta": {cached, stale, provider} }`
- failure → `{ "success": false, "error_code": "QUOTA_EXCEEDED", "message": "..." }`
  with the HTTP status mapped in `errors.ts` (402 quota, 404 not-found, 409
  in-progress, 503/504 provider, 401 auth, 400 invalid, 500 internal).

A failing provider never propagates raw — `ProviderService` swallows per-provider
errors and only surfaces one if *every* provider failed.

## Quota & idempotency strategy

**Quota** is charged on **external fetches only**. Cache hits never call
`RateLimitService`. The atomic check-and-increment lives entirely in the Phase 1
RPC; this layer is a wrapper, so concurrency correctness can't drift into app code.

**Idempotency** (safe retries / duplicate requests / timeouts):

1. The client sends an `Idempotency-Key` (a UUID per logical user action) on any
   request that may trigger an external fetch.
2. `consume_external_quota(key)` is the ownership gate: the first caller to insert
   the key "owns" it and charges quota exactly once; concurrent duplicates get
   `REQUEST_IN_PROGRESS`; a completed key replays its stored response.
3. After building the response, the Edge Function calls `finalize_request(key,
   response)`. A later retry with the same key then returns `replayed: true` with
   the stored response — no recompute, no recharge.
4. **Cache writes are idempotent by construction:** PK upserts on
   `(symbol, market)` / `(symbol, market, provider)`, so duplicate provider
   results converge to one row instead of creating duplicates.

Net effect: a client may safely retry on any network failure with the same key —
at most one quota charge and one logical cache effect.

## Deferred to later phases

- **Phase 3:** the `search` / `quote` Edge Functions (request flow, auth, async
  stale-while-revalidate after responding) + the client refactor to read symbols
  from this service instead of the hardcoded `data`/`usSyms`/`thaiSyms`.
- **Phase 4:** retry + exponential backoff, per-provider circuit breaker, richer
  graceful degradation, structured logs + tracing + metrics (cache-hit ratio,
  provider latency, quota usage), OpenTelemetry.
