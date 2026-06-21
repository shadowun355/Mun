# Mun — Product Scope & Architecture Decisions

Pinned scope for the evolved product. The original design handoff (`README.md`,
`Mun/BUILD.md`, `architecture.md`) describes the UI; this file records the product
direction layered on top. Read this before changing the data model or adding a
subsystem.

## Core purpose
**Mun (มั่น, "stable")** — iOS-first SwiftUI **portfolio management / tracking** app
for **Thai users**. Thai-only UI, luxury-matte aesthetic, light/dark, dual currency
฿/$. Single `Store` source of truth, prices canonical in USD.

**Not a trade-execution app.** The buy/sell order ticket is simulated — it routes
through a `MockBroker` behind a `Broker` protocol. No real money, no real orders.

## Asset classes
| Class | Tracked | Live source | Notes |
|---|---|---|---|
| Crypto | yes | CoinGecko (no key) | ✅ live |
| US stocks | yes | Finnhub (`/quote`, free key) | ✅ live when key set |
| Thai SET | yes | **ThaiStock proxy** (localhost FastAPI wrapping `UncleEngineer/ThaiStock`) | planned (rung 3) |
| ETFs | yes | Finnhub (same `/quote` path) | planned — add symbols to seed + UI |
| Forex | **display only** | Frankfurter (no key) | ✅ — the ฿/$ conversion rate, NOT a tradeable instrument. No `kind:forex`. |

## Freemium (subscription) — gating
StoreKit 2. Free tier stays usable; paid unlocks:
1. **Real-time data** — free = delayed / seed prices; paid = live refresh.
2. **Holdings limit** — free = **max 5** holdings/watchlist items; paid = unlimited.
3. **Advanced features** — free = basic; paid = Dividends screen, advanced charts /
   time ranges, multiple portfolios, export.

*Not gated:* ETF/Forex access is available to all tiers.

## Architecture decisions
- USD-canonical internal model; only numeric fields (`price`/`dayPct`/OHLC) are
  patched by the live feed. Static fields + holdings keep their seed.
- `Broker` protocol is the single deliberate abstraction — real broker plugs in
  later; order path is `async` now so the UI is correct ahead of time.
- Each data source fails independently back to the seed.
- Forex is display-only — no new instrument `kind`; the model stays
  `cat: foreign|thai|crypto` (+ ETF as a US/`foreign` variant, TBD at build time).

## Roadmap (sequenced)
1. ✅ Persistence (UserDefaults)
2. ✅ Live data rungs 1+2 (crypto + FX + US-with-key)
3. ▶ **Broker abstraction + MockBroker** (async order seam)
4. Market-data expansion — ThaiStock proxy (rung 3) + ETF symbols
5. Freemium / subscription — StoreKit 2 + feature gating (gates above)
6. Auth + DB — accounts, server-side persistence (replaces UserDefaults)

Each milestone gets its own brainstorm → design → build cycle. Auth/DB and
Subscription are large; do not half-build them early.
