# Edge Functions (Phase 3)

Two thin HTTP entrypoints over the Phase 2 service layer.

```
functions/
  _shared/          imported by both (NOT deployed as a function — leading underscore)
  search/index.ts   GET|POST /search?q=<query>
  quote/index.ts    GET|POST /quote?sym=<symbol>&market=<US|TH|CRYPTO|COMMODITY>
```

## Request / response

Both require `Authorization: Bearer <supabase-jwt>` and accept an optional
`Idempotency-Key: <uuid>` (makes retries safe — at most one quota charge, replays
the stored result).

Success:
```json
{ "success": true, "data": <hits|quote>, "meta": { "cached": true, "stale": false, "provider": "yahoo" } }
```
Failure (consistent envelope, HTTP status from errors.ts):
```json
{ "success": false, "error_code": "QUOTA_EXCEEDED", "message": "Upgrade to Premium to continue." }
```

## Flow

- **search:** cache-first (`symbol_metadata` trigram). Hit → free. Miss → atomic
  quota → providers (Yahoo→Finnhub→AlphaVantage, merged) → write-through.
- **quote:** fresh cache → instant. Stale cache → instant + background refresh via
  `EdgeRuntime.waitUntil` (no charge — cached symbols are unlimited). Miss → atomic
  quota → provider → write-through. Provider failure on a miss surfaces
  `SYMBOL_NOT_FOUND`/`PROVIDER_*`.

## Deploy

```bash
supabase link --project-ref <ref>
supabase secrets set FINNHUB_KEY=... ALPHAVANTAGE_KEY=...   # SUPABASE_* are auto-injected
# Auth is enforced in-code (requireUser); deploy without gateway JWT so OPTIONS/CORS
# preflight and our own 401 handling work:
supabase functions deploy search --no-verify-jwt
supabase functions deploy quote  --no-verify-jwt
```

## Verify (after the Phase 1 migration is applied + functions deployed)

```bash
BASE=https://<ref>.functions.supabase.co
JWT=<a signed-in user's access token>

# 1. Auth required
curl -s "$BASE/search?q=AAPL"                            # 401 UNAUTHENTICATED

# 2. Search resolves US + Thai (note Thai comes via the .BK probe)
curl -s -H "Authorization: Bearer $JWT" "$BASE/search?q=AAPL"
curl -s -H "Authorization: Bearer $JWT" "$BASE/search?q=ADVANC"   # -> ADVANC / TH
curl -s -H "Authorization: Bearer $JWT" "$BASE/search?q=JEPQ"     # -> JEPQ / etf

# 3. Quote: first call MISS (charges), second call CACHED (free), meta.cached flips
curl -s -H "Authorization: Bearer $JWT" "$BASE/quote?sym=NVDA&market=US"
curl -s -H "Authorization: Bearer $JWT" "$BASE/quote?sym=NVDA&market=US"

# 4. Free-tier quota: 5 NEW (uncached) symbols, then QUOTA_EXCEEDED on the 6th
for s in AMD INTC MU AVGO ORCL CRM; do
  curl -s -H "Authorization: Bearer $JWT" "$BASE/quote?sym=$s&market=US" | head -c 120; echo
done

# 5. Idempotency: same key twice → second is replayed, quota unchanged
K=$(uuidgen)
curl -s -H "Authorization: Bearer $JWT" -H "Idempotency-Key: $K" "$BASE/quote?sym=COST&market=US"
curl -s -H "Authorization: Bearer $JWT" -H "Idempotency-Key: $K" "$BASE/quote?sym=COST&market=US"
```

Local typecheck (when deno is available): `deno check functions/**/*.ts`.

## NOT in this phase

The **client refactor** (wire `web/app.js` / `web/marketapi.js` to call these
functions instead of the hardcoded `data`/`usSyms`/`thaiSyms`, add a live search
box, add a `getInst()` stub so unknown held symbols never crash `renderVals`) is a
separate integration step — it changes the live app and warrants its own
verify-in-browser pass. Tracked as a follow-on, not bundled into Phase 3.
