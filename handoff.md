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
  - **Not yet done:** Rotate old Finnhub key in git history (`72dba5c`). Optional: wrap gate
    inputs in a `<form>` to clear a verbose Chrome DOM hint (not an error). Turn Email
    "Confirm email" back ON for real users (off for testing).
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
