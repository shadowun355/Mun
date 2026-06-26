# Mun → PortPro feature-parity milestone

Goal: bring Mun (https://mun-3skf.onrender.com) to functional parity with PortPro
(portpro.app), **clean-room** — match the *capabilities* from PortPro's public feature
list, NOT its design, copy, code, or branding. Mun keeps its own gold visual identity.

Built phase by phase, small commits, verified live each phase (per CLAUDE.md). Each phase
that needs a Supabase schema change ships its migration SQL for the user to run.

## Already in Mun (no work)
Auth (email/pw + Google), per-user cloud portfolio, holdings derived from transactions,
stocks (US/Thai) + crypto + ETF, live prices (Finnhub/CoinGecko/Frankfurter/Yahoo),
candlestick detail charts, watchlist, allocation pie, dark mode, ฿/$ toggle, multi-device sync.

## Phases

### Phase 1 — Transactions ledger ✅ DONE + VERIFIED 2026-06-24 (commit 5083b6b)
Make Transactions a real editable ledger, not just buy-ticket output.
- Manual **add** transaction: asset picker, type (buy / sell / dividend), qty, price
  (prefilled live), **date** (native `<input type=date>`), fee.
- **Edit** + **delete** existing transactions.
- Holdings re-derive including fees (folded into buy cost); dividends recorded as income,
  not position change. Dividends screen populated from dividend rows (currently canned).
- **CSV export** of the ledger (client-side blob download).
- Supabase migration: `transactions` gains `fee numeric default 0`; `side`→ allow
  `dividend`; `ts` becomes user-chosen date.

### Phase 2 — FIFO cost basis & tax report ✅ DONE + VERIFIED 2026-06-24 (commit 7b36020)
- FIFO matching of sells against buys → realized gain/loss per lot.
- Per-position unrealized vs realized P/L.
- Tax report export (FIFO) → CSV.

### Phase 3 — Gold + market overview ✅ DONE + VERIFIED LIVE 2026-06-24 (commit f2fd2e0)
- Gold (ทองคำ) asset class via Yahoo `GC=F` (proxy `/yquote`), USD, tradeable.
- Market overview strip (XAU/BTC/SPY/PTT, reused from catalog) + news list (Finnhub `/news`).

### Phase 4 — Buy Planner (DCA) ✅ CODE DONE + UI/MATH VERIFIED 2026-06-26 (awaiting SQL)
- DCA / averaging-down calculator: target, levels (up to 7 support levels), per-level
  qty/price, resulting avg cost. Save plans per user.
- New **วางแผน** (Planner) screen + nav item (gold). Plain-DOM `#plansheet`: free-text
  symbol (+ live-price hint), 1–7 price/qty level rows (add/remove), live summary —
  total qty, total invest, **avg cost**, and % vs live price. Saved plans list on the
  screen; tap to reopen/edit/delete.
- Persistence: new `buy_plans` table (`user_id`, `sym`, `levels jsonb`, `created_at`),
  own-rows RLS. Migration: `web/supabase/migrations/20260626000001_buy_plans.sql`.
- **ponytail:** skipped the quota-charging symbol *search* in the planner (levels are
  user-typed; a calculator shouldn't burn the daily search quota) — free-text symbol +
  live-price prefill instead. Add search if wanted.
- Pure client math + one table; no proxy change.
- **Verify done (live, local server + live Supabase):** planner screen + 6-item nav
  render, calculator opens, 3 levels (200×10/180×10/150×5)→avg $182 (฿6,079), +51.2% vs
  live, live hint resolves "Apple", remove/add level works, 0 unexpected console errors.
  **Pending:** run the migration in the Supabase SQL editor, then verify save→reload→
  persist→delete (save currently returns "Could not find table public.buy_plans",
  handled gracefully — sheet stays open, no crash).

### Phase 5 — Dividend Calendar ✅ CODE DONE + VERIFIED (local proxy) 2026-06-26 (awaiting push→deploy)
- Upcoming dividends / XD dates per held symbol (data source TBD — Finnhub/Yahoo).
- Auto-suggest dividend transactions on XD; dividend yield calculator.
- **Data source:** proxy `GET /dividends?sym=<yahooSym>` — Yahoo chart `events=div` (keyless,
  same source family as `/quote`/`/candles`/`/yquote`). Returns native-ccy trailing history,
  TTM yield, last payment, and an INFERRED next XD (last date + median payment interval).
  Yahoo's forward calendar (quoteSummary) is crumb-gated/flaky from a server → cadence
  inference is the honest free signal.
- **Client:** Dividends screen now real — hero "รับแล้วในปีนี้" (already real), stats wired
  (คาดทั้งปี / portfolio yield / รับ/เดือน), and a per-held-payer list (XD date, amount/share,
  yield %, est. payout, est. next XD). One-tap a row → opens the Phase 1 ledger sheet
  prefilled as a dividend (qty=held, price=amount/share, date=next XD). Native amounts →
  USD-canonical (÷ FX rate for THB). `MarketAPI.dividends()`, `loadDividends()` (1 call/held
  symbol, session-cached), `suggestDiv()`. Removed the fake "ปันผลรายเดือน" bar chart
  (deletion over presenting fake data as real).
- **Verified (local uvicorn proxy + live Supabase + browser):** curl `/dividends?sym=PTT.BK`
  →6.57% yield, `SCHD`→3.28%, `AAPL`→0.38%; browser with PTT(6000)+SCHD(100) holdings →
  rows render with correct currency conversion (PTT ฿1.40/sh, SCHD ฿8.45/sh), annual ฿17,300,
  portfolio yield 5.46%; one-tap → ledger prefilled (PTT, dividend, qty 6000, ฿1.40, 11 ก.ย.).
  Only console errors = local proxy `/us` 404 (no FINNHUB_KEY locally — live proxy has it).
- **TO FINISH (user/push):** push → Render redeploys proxy (`mun-re6q`); then live curl
  `/dividends?sym=SCHD` + browser check. No env/migration needed (keyless, no DB).

### Phase 6 — Watchlist alerts
- Price alert thresholds per symbol. Delivery: in-app first; Telegram bot optional
  (needs a bot token + a server cron — separate infra, decide then).

### Phase 7 — Portfolio analytics
- Deeper analytics: allocation by class/asset, per-asset % cap + over-cap warning,
  growth trend over time (needs portfolio value snapshots — a daily job or on-load capture).

### Phase 8 — Freemium tiers
- Free (≤5 assets, limited planner/watchlist) vs Pro (unlimited + advanced).
- Gate features client-side + enforce in Supabase RLS. Payment (Stripe) is its own
  decision/infra step — wire last.

## Notes
- Copyright: clean-room. No PortPro assets/text/markup. Add a `© 2026 Mun` footer (Mun's own).
- Phases 6/8 need external infra (Telegram bot / Stripe) — flagged for a decision when reached.
- Order can change; Phase 1 first because it's the reported "not as expected" gap.
