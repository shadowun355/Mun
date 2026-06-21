# Architecture

SwiftUI iOS app (Mun / มั่น), port of a design handoff. Single in-memory store,
mock data, no backend. ~1,160 lines across `Mun/`.

## Project Structure
- `Mun/` — all Swift source (flat, file-system synchronized Xcode group; new `.swift` compiles automatically).
- `Mun.xcodeproj/` — Xcode project (`com.mun.app`, automatic signing).
- `Mun/BUILD.md` — run/ship steps + mock-vs-real notes.
- `*.dc.html`, `screenshots/`, `README.md` — original design handoff reference.

## Models (`Models.swift`)
- `Instrument` — a stock/crypto: symbol, names, OHLC, price (USD canonical), `dayPct`, shares, avg, mcap/vol/pe, `cat` (foreign|thai|crypto), `kind` (stock|crypto).
- `Txn` / `TxnGroup` — transaction rows grouped by date; type buy|sell|dividend.
- `AllocSlice` — one allocation pie slice (label, color, pct).
- `Ticket` — buy/sell order in flight (mode, sym, qty).

## Views
- `RootView` — TabView (5 tabs) + toast overlay + order-ticket sheet + per-tab NavigationStack.
- Screens: `OverviewView`, `WatchlistView`, `DividendsView`, `TransactionsView`, `AccountView`.
- `DetailView` — instrument detail (OHLC, chart), pushed via `navigationDestination(for: String)`.
- `OrderTicketView` — buy/sell bottom sheet.
- `Charts.swift` — `LineChart` shape, `Sparkline`, `AreaChart`, canned `Series.up/down`.
- `UIComponents.swift` — Card, ChangePill, LogoChip, CurrencySegment, RangeChips, FilterChip, SectionHeader, ScreenTitle.
- `Theme.swift` — `Theme` light/dark token sets, `Color(hex:)`, `mono()` serif font.

## Services
- `MarketAPI` (`MarketAPI.swift`) — dependency-free live data: crypto (CoinGecko),
  FX USD→THB (Frankfurter), US stocks (Finnhub, optional key). Patches `Store` on
  launch; fails silently back to the seed. See `SCOPE.md` for asset-class coverage.
- `Broker` (`Broker.swift`) — order-execution seam; `MockBroker` simulates fills
  (no real execution). Swap point at `Store.broker`.
- Persistence: `UserDefaults` (no DB yet) for `dark`/`cur`/`notif`/`starred`/`extraTxns`.
- `Store` (`Store.swift`) is the only stateful object: an `ObservableObject` holding all state, seeded `data`/`baseTxns`, formatters, derived portfolio math, and actions (`toggleStar`, async `confirmTicket`). FX `rate` and `data` are now `@Published`, refreshed by `MarketAPI`.

## Data Flow
- `MunApp` creates one `Store` as `@StateObject`, injects via `.environmentObject`.
- Views read it with `@EnvironmentObject` and mutate `@Published` state directly (tab, cur, filters, starred, ticket…).
- Derived values are computed properties on `Store` (`totalUsd`, `dayPct`, `alloc`, `watchRows`, `txnGroups`); SwiftUI re-renders on publish.
- Order flow: view sets `store.ticket` → sheet → `confirmTicket()` inserts into `extraTxns`, switches tab, shows timed `toast`.
- All data resets on relaunch (in-memory only).

## Dependencies
- SwiftUI + Foundation only. No third-party packages, no SPM/CocoaPods.
- Requires Xcode 16+, iOS target.

## Notes
- Single source of truth: one `Store`, no MVVM per-screen view models — derived state lives as computed properties.
- Prices canonical in USD; ฿ derived via `RATE`. Currency/theme are global toggles.
- Mock boundary is deliberate and centralized in `Store.data` + `Charts.Series` — see `ponytail:` comments marking swap points for live API, smoothing, custom fonts.
- File-system synchronized group means no manual file registration in the pbxproj.
