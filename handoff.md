# Handoff

## Current status
Mun (มั่น) — native iOS SwiftUI app, port of the design handoff. UI complete,
runs on mock data. No backend, no persistence. ~1,160 lines Swift across `Mun/`.

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

## Design decisions (live data)
- Internal model stays USD-canonical; only numeric fields are patched, static
  fields + holdings (`shares`/`avg`) keep their seed.
- Rung 3 (Thai SET stocks) deliberately deferred — no free API covers SET. Plan:
  a localhost FastAPI proxy wrapping the `UncleEngineer/ThaiStock` scraper, hit
  behind a `GET /quote?sym=` contract. Thai stays mock until then.

## Next steps (not started — see `Mun/BUILD.md` "What's mock vs real")
- Paste a free Finnhub key into `MarketAPI.finnhubKey` to enable US stocks.
- Rung 3: ThaiStock localhost proxy for real SET prices (PTT/CPALL/KBANK).
- Add periodic / foreground refresh (currently launch-only).
- Wire order ticket to a real brokerage.
- Add `Mun/Assets.xcassets` + `AppIcon` before shipping.
- Set signing Team + unique `PRODUCT_BUNDLE_IDENTIFIER` (currently `com.mun.app`).

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
