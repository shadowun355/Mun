# Tasks

## Completed
- 5-tab shell (`RootView`): Overview, Watchlist, Dividends, Transactions, Account.
- Detail screen with OHLC stats + area chart (`DetailView`, `Charts`).
- Buy/sell order ticket sheet → appends txn, jumps to Transactions, toast (`OrderTicketView`, `Store.confirmTicket`).
- Dual currency ฿/$ toggle + formatters (`Store.price/val/altVal`), fixed `RATE = 36.4`.
- Light/dark theme tokens (`Theme`), driven by `Store.dark`.
- Watchlist filters + star/unstar; transaction filters (`Store.watchRows`, `txnGroups`, `toggleStar`).
- Portfolio math: total value, day P/L, allocation slices (`Store.totalUsd/dayPct/alloc`).
- Shared UI kit: Card, ChangePill, LogoChip, CurrencySegment, RangeChips, FilterChip, headers.

## In Progress
- None. See `SCOPE.md` for pinned scope + roadmap.

## Done (this session)
- Persist `starred`, `extraTxns`, `notif`, `dark`, `cur` via `UserDefaults`.
- Live market data + FX (`MarketAPI`): crypto + FX (no key), US (Finnhub key).
- Broker abstraction + `MockBroker`; async `confirmTicket` (no real execution).

## Backlog
- Market-data expansion: ThaiStock localhost proxy (live SET) + ETF symbols.
- Freemium / StoreKit 2: real-time-data gate, 5-holding cap, advanced features.
- Auth + DB (replace `UserDefaults`).
- Real chart series + smoothing (`Charts.Series` is canned); make `Store.range` drive data.
- Add `Mun/Assets.xcassets` + `AppIcon`; signing Team + unique bundle id.
- Bundle Anuphan/Newsreader fonts, switch `mono()`/headers to `.custom()`.
