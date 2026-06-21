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

## Next steps (not started — see `Mun/BUILD.md` "What's mock vs real")
- Replace `Store.data` + `RATE` with a market-data / FX API.
- Persist `starred`, `extraTxns`, `notif`, `dark`, `cur` (e.g. `@AppStorage` / file).
- Wire order ticket to a real brokerage.
- Add `Mun/Assets.xcassets` + `AppIcon` before shipping.
- Set signing Team + unique `PRODUCT_BUNDLE_IDENTIFIER` (currently `com.mun.app`).

## Commands to run
- Open: `open Mun.xcodeproj`
- Build/run: in Xcode pick an iPhone simulator → ⌘R (needs full Xcode 16+).
- Archive to ship: select **Any iOS Device** → Product → Archive.
- File-system synchronized group: new `.swift` under `Mun/` compiles automatically.

## Known issues
- All data is mock (`Store.swift`, `Charts.swift`); `RATE` is hardcoded.
- No persistence — state resets on relaunch.
- No app icon / asset catalog yet (`Assets.xcassets` missing).
- Signing not configured for distribution.

## Resume instructions
1. Read this file and `Mun/BUILD.md`.
2. `git log --oneline` for last commits.
3. Open `Mun.xcodeproj`, ⌘R to confirm it still builds.
4. Pick a "Next steps" item; keep commits small; update this file at each milestone.
