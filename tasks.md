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
- None. Last state: clean UI building on mock data.

## Backlog
- Replace `Store.data` + `RATE` with live market-data / FX API.
- Persist `starred`, `extraTxns`, `notif`, `dark`, `cur` (e.g. `@AppStorage`).
- Wire order ticket to a real brokerage.
- Real chart series + smoothing (`Charts.Series` is canned).
- Time range chips (`RangeChips`) are visual only — make `Store.range` drive data.
- Add `Mun/Assets.xcassets` + `AppIcon`.
- Configure signing Team + unique bundle id (currently `com.mun.app`).
- Bundle Anuphan/Newsreader fonts, switch `mono()`/headers to `.custom()`.
