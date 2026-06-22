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
None. Last state is a clean, building UI on mock data.

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
- Add `Mun/Assets.xcassets` + `AppIcon`; set signing Team + unique bundle id.
- Move `MarketAPI.finnhubKey` out of source (xcconfig/env) before any public repo.

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

## Commands to run
- Open: `open Mun.xcodeproj`
- Build/run: in Xcode pick an iPhone simulator → ⌘R (needs full Xcode 16+).
- Archive to ship: select **Any iOS Device** → Product → Archive.
- File-system synchronized group: new `.swift` under `Mun/` compiles automatically.

## Known issues
- Thai SET stocks (PTT/CPALL/KBANK) still mock; US stocks mock until a Finnhub
  key is set. Crypto + FX are live. `Charts.swift` still canned.
- No app icon / asset catalog yet (`Assets.xcassets` missing).
- Signing not configured for distribution.

## Resume instructions
1. Read this file and `Mun/BUILD.md`.
2. `git log --oneline` for last commits.
3. Open `Mun.xcodeproj`, ⌘R to confirm it still builds.
4. Pick a "Next steps" item; keep commits small; update this file at each milestone.
