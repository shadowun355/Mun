# Handoff

## Current status
Mun (มั่น) — native iOS SwiftUI app. **Evolved scope is pinned in `SCOPE.md`**
(portfolio tracker, no real execution, freemium subscription planned). UI complete;
crypto+FX+US data live; orders simulated via `MockBroker`. Read `SCOPE.md` first.

## Completed features
- 5 tabs: ภาพรวม (Overview), เฝ้าดู (Watchlist), ปันผล (Dividends), รายการ (Transactions), บัญชี (Account).
- Detail screen (`DetailView`) with OHLC stats + canned chart.
- Buy/sell order ticket sheet (`OrderTicketView`) → appends txn, switches to Transactions tab, shows toast.
- Dual currency ฿/$ toggle, fixed FX `RATE = 36.4`.
- Light/dark theme tokens (`Theme.swift`).
- Watchlist + transaction filters; star/unstar watchlist items.
- Portfolio math: total value, day P/L, allocation slices (all in-memory).

## Work in progress
**iOS app PAUSED 2026-06-22** (Apple $99/yr fee deferred). Pivoted to a **web port**
to ship for free — Swift left untouched, not deleted. See `web/` + `SCOPE.md`.

### Web port (merged to `main` 2026-06-23, LIVE)
Parity-first static site rebuilding the iOS app for the browser. Plan:
`~/.claude/plans/since-i-know-that-glowing-wigderson.md`.
**LIVE:** site https://mun-3skf.onrender.com (Render static `mun-web`), proxy
https://mun-re6q.onrender.com. `FINNHUB_KEY` set in Render → `/us` live. Favicon added.

#### Feature work (plan `~/.claude/plans/starry-kindling-key.md`)
- ✅ **Part A — Candlestick chart (detail view), 2026-06-23.** Proxy `GET /candles?sym=&range=`
  exposes the Yahoo OHLC bar series (one source: Thai `.BK` / US plain / crypto `-USD`);
  `range`→Yahoo (range,interval) map in `proxy/app.py`. Client `MarketAPI.yahooSym()` +
  `fetchCandles()` (THB bars ÷ FX rate). `app.js` builds `d.candles` geometry (wick line +
  body rect, close≥open→`--up` green else `--down` red) over the 358×148 viewBox;
  `loadCandles()` caches per `sym|range`, triggered by `open()` + range chips. Markup in
  `index.html` detail chart = `<sc-for>` of `<line>`+`<rect>`. Old canned line path removed.
  Verified live: AAPL 12 candles @1d, 252 @1y (131 green/121 red), range switch rescales,
  0 console errors.
- ⏳ **Part B — Supabase login + per-user portfolio (CODE SHIPPED, awaiting SQL).**
  Commit `2647a43`. Real accounts via Supabase (email/pw + Google) gate the app: static
  `#gate` login UI in `index.html` wired by plain DOM in `app.js` (engine has no input
  binding), shown until a session exists. `web/supabase.js` = client + `Auth` helpers
  (anon key public by design; RLS protects rows). Per-user `transactions`/`watchlist`/
  `prefs` in Supabase. **Portfolio rewritten**: `deriveHoldings(txns)` → net qty +
  buy-weighted avg per sym; overview total / day P/L / alloc + detail position all from
  derived holdings; **cash removed**. Buy/sell inserts a real `transactions` row (after
  ~400ms MockBroker sim) → holdings re-derive. Txn screen + empty state from structured
  rows. Settings/currency/star sync to Supabase. Account shows signed-in email; logout
  wired. New accounts start empty.
  - Supabase project: URL `https://livhijcgkielwrkdqtbm.supabase.co`, anon key in
    `web/supabase.js`. Auth health 200.
  - ✅ **VERIFIED LIVE 2026-06-24.** SQL run (tables 200, RLS on), Email "Confirm email"
    off. Browser flow all pass: signup→session, empty account ฿0, buy 5 AAPL→Supabase txn
    row + holdings derive (qty5 @$299.25), sell 2→qty3, reload reloads session+holdings
    from cloud, currency+star sync survive reload, logout clears session, 0 console errors.
  - Email gotcha: Supabase rejects `@example.com` as invalid — use a real domain.
  - Skipped (YAGNI): localStorage→cloud migration, magic-link/Apple, portfolio snapshots.
  - ✅ **Google OAuth configured + verified 2026-06-24.** Google Cloud OAuth web client +
    Supabase Google provider set. Browser test: Google button redirects to Google sign-in
    with correct client_id (`936159950771-...`) + redirect_uri
    (`https://livhijcgkielwrkdqtbm.supabase.co/auth/v1/callback`), no redirect_uri_mismatch.
    Consent→callback→session is standard Supabase (couldn't complete actual Google login in
    automation — needs real credentials). NOTE: Google consent screen may be in **Testing**
    mode → only added test users can complete login until **Published**.
  - Finnhub key rotated + Google OAuth tested working (user, 2026-06-24).
  - Optional: wrap gate/sheet inputs in a `<form>` to clear a verbose Chrome DOM hint (not
    an error); turn Email "Confirm email" back ON for real users (off for testing).

#### SymbolUniverse — production symbol service (NEW workstream, plan `~/.claude/plans/sorted-stirring-valiant.md`)
Replace hardcoded ticker lists with a provider-backed cache + freemium quota, built
phased (DB → services → edge functions → reliability). User-locked: lazy cache-first
(cache>API), **Supabase Edge Functions (Deno/TS)** runtime, **two-table cache**
(`symbol_metadata` long-TTL / `symbol_quote` short-TTL), Free=5 external fetches/day,
mocked subscriptions (Stripe-ready schema). Search verified: Yahoo `/v1/finance/search`
(US/ETF) + `<sym>.BK` probe (Thai) resolves all of AAPL/SCHD/JEPI/JEPQ/PTT/ADVANC/DELTA,
no SET list to maintain.
- ✅ **Phase 1 — DB foundation & concurrency, APPLIED + VERIFIED LIVE 2026-06-24.**
  Migration ran in Supabase SQL editor ("Success"). `phase1_assert.sql` (new hard-assert
  DO-block, raises on any failed check) → "Success" = quota 5-allow-then-deny,
  idempotent replay no double-charge, unlimited tier all hold. Trigram seq-scan on the
  2-row table is expected (planner picks the index once the table grows).
  `web/supabase/migrations/20260624000001_symbol_universe_foundation.sql` (one atomic
  migration): tables `plans`/`subscriptions`/`user_api_usage`/`symbol_metadata`/
  `symbol_quote`/`idempotency_keys` + indexes (trigram search, partial-unique active sub,
  expiry sweeps) + FKs + RLS (own-row reads; cache/plans public; all writes via service
  role / SECURITY DEFINER) + RPCs `consume_external_quota(key)` (atomic single-statement
  check-and-increment; idempotency ownership gate via `INSERT…ON CONFLICT DO NOTHING
  RETURNING`; frees key on deny) + `finalize_request(key,response)`. Seed = 4 plans.
  **No local Postgres** → not executed here. Verify: apply migration, then run
  `web/supabase/tests/phase1_verify.sql` in the Supabase SQL editor (5-allow-then-deny,
  idempotent replay no double-charge, unlimited tier, trigram index used) + the pgbench
  10-way concurrency check noted at the file's end. Phases 2–4 outlined in the plan.
- ✅ **Phase 2 — core services & architecture, CODE WRITTEN 2026-06-24 (commit pending), unverified.**
  Deno/TS service layer under `web/supabase/functions/_shared/` (see its README for
  the full architecture). `types.ts`, `errors.ts` (AppError + consistent envelope),
  `env.ts` (fail-fast), `http.ts` (fetch + timeout), `supabase.ts` (service/user
  clients + requireUser). `providers/`: `Provider` interface + symbol-mapping helpers,
  `yahoo.ts` (primary — keyless search + `.BK` Thai probe + quote), `finnhub.ts`
  (US, key-gated), `alphavantage.ts` (last resort). `services/`: `ProviderService`
  (priority Yahoo→Finnhub→AV, merge/fallback), `CacheService` (two-table TTL
  read/write-through; only layer touching cache tables), `RateLimitService` (wraps
  the Phase 1 quota RPCs), `SearchService` (cache-first; miss→quota→provider→
  write-through), `QuoteService` (resolve + stale-while-revalidate + graceful
  degradation). Error model + idempotency strategy documented in the README.
  **No deno in dev env** → not typechecked here; verified when Phase 3 deploys the
  Edge Functions.
- ✅ **Phase 3 — Edge Functions & cache flow, CODE WRITTEN 2026-06-24 (commit pending), unverified.**
  Two thin entrypoints over the Phase 2 services: `functions/search/index.ts`
  (GET|POST `/search?q=`) + `functions/quote/index.ts` (`/quote?sym=&market=`).
  Shared `_shared/respond.ts` (CORS + envelope + single error catch + param parse)
  and `_shared/context.ts` (auth + service-graph wiring: cache on service-role
  client, ratelimit on user-JWT client). Flow: auth → cache-first → miss charges
  atomic quota → providers → write-through. **Stale-while-revalidate**: quote serves
  stale instantly + refreshes in background via `EdgeRuntime.waitUntil` (no charge —
  cached symbols unlimited). Idempotency-Key header → `finalize_request` stores the
  result for replay. Consistent `{success,error_code,message}` failures with HTTP
  status map. **Refinement to Phase 2:** dropped the coarse `premium` flag — gate on
  cache-miss only and let the atomic RPC enforce per-tier limits (correct for the
  4-tier model). Deploy/curl-verify recipe in `functions/README.md` (`--no-verify-jwt`;
  auth enforced in-code). **No deno** → not typechecked; verify by deploy + the curl
  suite (auth-required, US+Thai search, miss→cached flip, 5-then-deny quota, idempotent
  replay). STOPPED per phased instruction (awaiting "Phase 4" command).
- ✅ **Phase 4 — reliability & observability, CODE WRITTEN 2026-06-24 (commit pending), unverified.**
  Defense-in-depth on every provider call: timeout (http.ts) → retry+backoff+jitter
  (`reliability/retry.ts`, transient-only) → per-provider/per-instance circuit breaker
  (`reliability/circuit-breaker.ts`, 5 fails→OPEN 30s→half-open) → provider fallback →
  stale-cache degradation. Wired in `ProviderService.call()`. Observability:
  `observability/trace.ts` (AsyncLocalStorage trace_id/route/user set at the edge),
  `log.ts` (structured JSON, OTel seam), `metrics.ts` (counter/gauge/timing/timed).
  Metrics emitted: request.duration_ms, provider.latency_ms, provider.failure,
  cache.hit/miss, quota.consume. Docs: `functions/RELIABILITY.md` (Mermaid: quote-SWR
  sequence + breaker state machine, metric catalogue, failure-mode table) +
  `functions/BILLING.md` (mocked→Stripe path; schema already provider-agnostic, hot
  path unchanged; webhook sketch). **No deno** → not typechecked; verify on deploy via
  logs/metrics + a forced-provider-failure breaker test.

**SymbolUniverse milestone — go-live progress:**
  1. ✅ **Phase 1 migration APPLIED + hard-asserted 2026-06-24** (see Phase 1 entry above).
  2. ✅ **Edge Functions DEPLOYED + VERIFIED LIVE 2026-06-24.** `supabase functions deploy
     search|quote --no-verify-jwt` via `npx supabase` (no brew/Docker; bundled remotely).
     NO secrets set — Yahoo keyless primary covers US/Thai/etf/quote; Finnhub/AV fallback
     unset (add later if Yahoo insufficient). Base `https://livhijcgkielwrkdqtbm.functions.supabase.co`.
     Live curl suite all pass: auth gate 401 (clean envelope); search AAPL→US, ADVANC→TH/THB
     (`.BK` probe), JEPQ→etf; quote NVDA miss→cached flip (`meta.cached` false→true);
     PTT quote→35 THB; free quota 5-allow-then-QUOTA_EXCEEDED; Idempotency-Key replay does
     not double-charge (proven by count: keyed sym charged once, 4 more new → 6th denied).
     Cosmetic: cached quote responses carry extra null fields + empty `data":{}` vs the miss
     shape — works, low priority. Throwaway test users `sutest1/2@mun-test.dev` left in
     auth.users (harmless).
  3. ⏳ **Client refactor (req 10, NOT a numbered phase):** wire `web/app.js`/`marketapi.js`
     to the `search`/`quote` functions, add a live search box, add a `getInst()` stub so
     unknown held symbols don't crash `renderVals`. Touches the live app → own
     browser-verify pass. NEXT.

#### PortPro feature-parity milestone (plan `web/ROADMAP_PORTPRO.md`)
8-phase clean-room push to match portpro.app capabilities (NOT its look — Mun keeps its
gold design). Phases: 1 Transactions ledger · 2 FIFO/tax · 3 gold+market · 4 Buy Planner ·
5 Dividend Calendar · 6 alerts · 7 analytics · 8 freemium+payment.
- ✅ **Phase 1 — Transactions ledger, VERIFIED LIVE 2026-06-24 (commit `5083b6b`).**
  Transactions screen is now an editable ledger. `#txnsheet` (plain DOM, outside the
  reactive template so the 60s tick can't wipe inputs) = add/edit form: asset picker,
  buy/sell/dividend, qty, price (prefilled live), fee, native date. Tap a row to edit;
  delete from the sheet. `deriveHoldings` folds fee into cost basis; dividends are income
  (excluded from qty). Dividends "received" sums real dividend rows. CSV export (blob).
  Theme vars mirrored to `:root` so the sheet themes in dark. `© 2026 Mun` footer.
  Migration applied: `transactions += fee`, `side` widened to allow `dividend`. Verified:
  add w/ fee→avg incl fee, custom date, dividend→income+qty unchanged, edit, delete, CSV.
- ✅ **Phase 2 — FIFO cost basis & tax report, VERIFIED LIVE 2026-06-24 (commit `7b36020`).**
  `fifo()` = one chronological pass per symbol: sells consume oldest buy lots → realized
  gain/loss per sale; leftover lots are the holdings, so their cost = correct post-sale
  average (replaced lifetime-buy-avg). Buy fee raises lot cost/share, sell fee lowers
  proceeds/share. `deriveHoldings` delegates to `fifo().holdings`. UI: detail card realized
  P/L row, Transactions realized summary + "ภาษี" button → FIFO tax CSV
  (date,sym,qty,proceeds,cost,gain). Pure client, no migration. Verified live: buy10@100 +
  buy10@200 + sell15@300 → realized $2500, remaining 5@$200, tax CSV correct.
- ✅ **Phase 3 — gold + market overview/news, VERIFIED LIVE 2026-06-24 (commit `f2fd2e0`).**
  Pushed → Render redeployed proxy + static. Verified: `curl /yquote?sym=GC=F` → $4089 USD,
  `curl /news` → real CNBC/Reuters headlines. Browser (logged in): market strip shows 4 live
  tickers (ทองคำ ฿134,921 −1.20% / BTC / S&P / PTT), alloc has ทองคำ slice, news list = 12
  headlines w/ working links, 60s tick refreshes prices + persists news. Gold detail = COMEX
  USD header + 20 candle bodies/wicks drawn from `GC=F` (encodeURIComponent round-trip works) +
  not-held state. 0 console errors whole session.
  - Proxy: `fetch()` refactored into `yfetch(literal Yahoo sym)`; `/quote` = `yfetch(sym+".BK")`.
    `ccy` now THB only for `.BK`, else USD (was hardcoded THB). New `GET /yquote?sym=`
    (gold `GC=F`, indices) + `GET /news` (Finnhub general headlines, key server-side,
    fail-silent `[]`). yfetch logic verified live: GC=F $4085 USD, PTT.BK/^SET.BK THB.
  - Gold (XAU): seeded tradeable instrument (`cat:'gold'`, `kind:'gold'`, Yahoo `GC=F`,
    USD, **not** FX-divided). `MarketAPI.gold()` patches live; `yahooSym` maps gold→`GC=F`
    so detail candles work. Watchlist + `ทองคำ` filter chip + alloc slice (`--c-clay`) +
    `catUsd.gold`.
  - Market overview strip on Overview = live tickers XAU/BTC/SPY/PTT reused from catalog
    (no new fetch), tap-to-open. News list under holdings (Finnhub `/news`), hidden until
    headlines load, links open new tab.
  - **NEXT to finish phase:** push → Render redeploys proxy (`mun-re6q`) + static (`mun-web`);
    then verify live: `curl /yquote?sym=GC=F` → USD gold, `curl /news` → headlines (needs
    `FINNHUB_KEY` env, already set), browser: gold in watchlist/strip, gold detail candles,
    news list renders, 0 console errors. SET-index strip ticker skipped (THB index breaks
    USD-canonical reuse) — add later if wanted (`^SET.BK` resolves).
- **Reuse:** the interactive `.dc.html` prototype already held the whole app as a
  vanilla JS class (data model, portfolio math, both themes, full markup). Lifted it
  into `web/`; only the proprietary `DCLogic` runtime was rebuilt as an ~120-line
  shim (`{{ }}` / `<sc-if>` / `<sc-for>` / `onClick`) in `web/app.js`.
- **Files:** `web/index.html` (markup template + outer shell), `web/app.js`
  (engine + Component + iOS deltas: SPY/QQQ ETFs, `etf` chip, localStorage persist
  mirroring UserDefaults keys, 60s + visibilitychange refresh, submitting state),
  `web/marketapi.js` (FX+crypto direct; US+Thai via proxy; THB÷rate USD-canonical).
- **UI:** removed the iPhone device frame. **Responsive layout (one codebase, CSS
  media query at 760px):** desktop (≥760px) = left sidebar nav (`.nav`, 232px, brand
  + vertical items) + main panel (`.main`) filling the rest, content centered at
  max-width 1040 so it's not stretched edge-to-edge; phones (<760px) = the original
  bottom tab bar. Layout lives in `index.html` `<style>` classes (`.shell/.nav/
  .navitem/.main`); the inline `rootStyle` carries only the dynamic theme vars + bg.
  `document.body.style.background` is set per-theme so the page fills the whole
  window. No separate mobile folder — iOS design stays in the `.dc.html` prototype +
  Swift app. Verified in a real browser (Puppeteer): at 1200px sidebar is left/full-
  height and main fills to the right edge; at 390px nav is a full-width bottom bar;
  all tabs/toggle/filters/txn list work; CoinGecko/Frankfurter live; proxy → seed.
- **Proxy:** `proxy/app.py` gained `CORSMiddleware` (REQUIRED — browsers were blocked;
  native iOS had no CORS) + `GET /us?sym=` (Finnhub, key from `FINNHUB_KEY` env, not
  in client JS). `render.yaml` adds a `mun-web` static site (`rootDir: web`).
- **Proxy redeployed 2026-06-23:** merged `web-port` → `main` (fast-forward) +
  pushed; Render `mun-re6q` auto-redeployed in ~30s. Verified live:
  CORS `access-control-allow-origin: *` on `/quote`, Thai `/quote?sym=PTT` → 35.0 THB,
  `/us` route present.
- **NEXT (blocking before web is live), both Render-dashboard actions:**
  1. Set env `FINNHUB_KEY=d8sflopr01qq7apvcre0d8sflopr01qq7apvcreg` on the `mun-re6q`
     proxy service (Environment tab). Until set, `/us?sym=AAPL` → `{"detail":"no
     FINNHUB_KEY set"}` and the web client keeps seed prices for US stocks (no crash).
  2. Create the `mun-web` static site (New → Static Site, rootDir `web`, publish `.`,
     no build — or New → Blueprint to pick up `render.yaml`'s `mun-web`). That serves
     `web/` publicly = the web port is live.
- **Security:** Finnhub key now server-side only. Still in git history at `72dba5c` —
  rotate before/with going public.

GitHub: https://github.com/shadowun355/Mun.
**Proxy is LIVE on Render:** https://mun-re6q.onrender.com (`render.yaml` blueprint
pins `rootDir: proxy`). Verified: `/` → `{"ok":true}`, `/quote?sym=PTT` → live THB.
`MarketAPI.proxyBase` already set to it, so Thai/SET prices now work for any build
(incl. TestFlight). Note: Render free tier sleeps after 15min idle → first request
after idle takes ~50s (proxy returns seed-fallback meanwhile, no crash).
**Resume:** ready for TestFlight — Archive in Xcode → upload → add testers.

## Completed since
- Persistence: `dark`, `cur`, `notif`, `starred`, `extraTxns` survive relaunch via
  `UserDefaults` (`didSet` write + default-expr load in `Store.swift`). `Txn` made
  `Codable`. Ephemeral state (`tab`, `range`, filters, `toast`, `ticket`) not
  persisted by design.
- Live data (rungs 1+2), new `Mun/MarketAPI.swift`: real **crypto** (CoinGecko)
  and **FX USD→THB** (Frankfurter) with no API key; real **US stocks** (Finnhub)
  when a free key is pasted into `MarketAPI.finnhubKey` (empty = US stays seed).
  `Store.rate` + `Store.data` are now `@Published`, seeded with the old mock as an
  offline fallback; `MarketAPI.refresh` patches only live numeric fields
  (`price`/`dayPct`/OHLC) and runs on launch via `.task` in `RootView`. FX fetched
  first (USD view + future Thai normalization depend on it). Each source fails
  silently back to seed. `Instrument` price/dayPct/OHLC are now `var`.
  API JSON shapes verified live with curl; full app run unverified — no Xcode here.
- Broker abstraction, new `Mun/Broker.swift`: `Broker` protocol + `Order`/`Fill`/
  `Side`/`OrderError` + `MockBroker` (simulated ~400ms fill, no real execution).
  `Store.confirmTicket()` is now `async @MainActor`, routes through `store.broker`,
  shows a "ส่งคำสั่ง…" submitting state (`Store.submitting`), and on the `Fill`
  does what it did before (prepend `Txn`, tab→3, success toast); broker error →
  "คำสั่งไม่สำเร็จ" toast. Toast logic extracted to `Store.showToast`.
  `OrderTicketView` confirm button wraps the call in a `Task` and disables while
  submitting. Swap point for a real broker is `Store.broker`.

## Design decisions
- Single source of truth = `SCOPE.md`. Internal model stays USD-canonical; only
  numeric fields are patched, static fields + holdings keep their seed.
- Rung 3 (Thai SET) now **in scope** via a localhost FastAPI proxy wrapping
  `UncleEngineer/ThaiStock`, behind a `GET /quote?sym=` contract. Still to build.
- Forex is **display-only** (the ฿/$ rate, already live) — no tradeable instrument.

## Roadmap (see `SCOPE.md`)
✅ persistence · ✅ live data 1+2 · ✅ broker abstraction (MockBroker) ·
▶ market-data expansion (ThaiStock proxy + ETF symbols) ·
freemium/StoreKit 2 (real-time gate, 5-holding cap, advanced features) · Auth + DB.

## Next steps
- Deploy `proxy/` (Dockerfile ready) to Render/Fly, then set `MarketAPI.proxyBase`
  to the HTTPS URL so TestFlight users get live SET data.
- Set signing `DEVELOPMENT_TEAM` (your Apple Team ID) + unique reverse-domain
  bundle id (currently `com.mun.app`) in Xcode → target → Signing & Capabilities.
- Replace the placeholder solid-gold app icon with real 1024 art
  (`Mun/Assets.xcassets/AppIcon.appiconset/icon-1024.png`).
- Rotate the Finnhub key (it remains in git history at commit `72dba5c`) or scrub
  history before making the repo public.

### Done this session
- ✅ Periodic + foreground refresh (`RootView.swift`): `.task` now loops
  `refresh()` every 60s (was launch-only); `scenePhase == .active` triggers an
  immediate refresh on return to foreground.
- ✅ ThaiStock proxy + iOS client. New `proxy/` FastAPI (`app.py`,
  `requirements.txt`, `README.md`): `GET /quote?sym=PTT` → THB OHLC.
  **Source deviation from SCOPE:** uses Yahoo Finance `<sym>.BK` (keyless,
  reliable, returns OHLC) instead of scraping UncleEngineer/ThaiStock — verified
  live (PTT 35.5 THB). Swap `fetch()` body if SET-direct ever needed.
  iOS: `MarketAPI.fetchThai(rate:)` hits `http://127.0.0.1:8000`, divides THB by
  the live FX rate (USD-canonical), patches PTT/CPALL/KBANK; proxy down → seed.
  ATS: new `Mun/Info.plist` (`NSAllowsLocalNetworking`) wired via `INFOPLIST_FILE`
  in both build configs so localhost http is allowed. **Start the proxy before
  running the app** to see live SET data (see `proxy/README.md`).
- ✅ ETF symbols. Seeded SPY + QQQ (`cat: "etf"`, `kind: "stock"`, USD) in
  `Store.swift`, added to `watchList` and to `MarketAPI.usSyms` so they patch live
  via the same Finnhub `/quote` path (need the key). New `กองทุน` (ETF) filter chip
  in `WatchlistView`. ETFs are watchlist-only (not in `holdingList`), so `alloc`/pie
  untouched — add an `etf` slice when an ETF first enters holdings.
- ✅ Finnhub key set in `MarketAPI.finnhubKey` (verified live: AAPL/SPY quotes).
  US stocks (AAPL/NVDA/TSLA) + ETFs (SPY/QQQ) now patch live. **Key is hardcoded
  in committed source** — free read-only tier, low risk, but move to xcconfig/env
  and gitignore before publishing the repo or rotating the key.
  **Done:** key now lives in gitignored `Mun/Secrets/Secrets.swift`
  (`MarketAPI.finnhubKey = Secrets.finnhubKey`); template at root
  `Secrets.example.swift`. Still in git history at `72dba5c` — rotate before public.
- ✅ Asset catalog + AppIcon. New `Mun/Assets.xcassets` (auto-included by the
  file-system synchronized group) with a single-size 1024 `AppIcon` — currently a
  placeholder solid brand-gold PNG (generated via stdlib, no real art yet).
  `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon` wired in both build configs;
  `plutil -lint` passes. Signing still **not** done — needs your Apple Team ID
  (`DEVELOPMENT_TEAM`); `CODE_SIGN_STYLE` stays Automatic, bundle id `com.mun.app`.

## Commands to run
- Open: `open Mun.xcodeproj`
- Build/run: in Xcode pick an iPhone simulator → ⌘R (needs full Xcode 16+).
- Archive to ship: select **Any iOS Device** → Product → Archive.
- File-system synchronized group: new `.swift` under `Mun/` compiles automatically.

## Known issues
- Thai SET stocks (PTT/CPALL/KBANK) still mock; US stocks mock until a Finnhub
  key is set. Crypto + FX are live. `Charts.swift` still canned.
- App icon is a placeholder solid-gold square; needs real 1024 art.
- Signing not configured for distribution (no `DEVELOPMENT_TEAM` set).

## Resume instructions
1. Read this file and `Mun/BUILD.md`.
2. `git log --oneline` for last commits.
3. Open `Mun.xcodeproj`, ⌘R to confirm it still builds.
4. Pick a "Next steps" item; keep commits small; update this file at each milestone.
