# Handoff: Mun (มั่น) — Stock Portfolio Tracking App

## Overview
A mobile (iOS-first) portfolio-tracking app for **Thai users**, tracking a mixed/global portfolio:
Thai stocks (SET), US stocks (NASDAQ), and crypto — in one place. All UI copy is in **Thai**.
Aesthetic: "luxury matte" — warm cream/charcoal palette with a single muted-gold accent.
Supports **light and dark mode** and **dual currency** (Thai Baht ฿ / US Dollar $).

The product name shown is **Mun / มั่น** (meaning "secure/stable").

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes
showing the intended look and behavior. They are **not production code to ship directly**.
The task is to **recreate these designs in the target codebase's environment** (React Native,
Flutter, SwiftUI, etc.) using its established patterns, navigation, and component libraries.
If no codebase exists yet, choose the most appropriate mobile framework and implement there.

The prototypes are built as "Design Components" (`.dc.html`) — a streaming-HTML format. You do
**not** need to understand that runtime. Open the files in a browser to interact, and read the
inline `class Component extends DCLogic { ... }` block at the bottom: its `renderVals()` method
contains all the **data model, formatting helpers, and interaction handlers** — this is the
clearest spec of the app's logic.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are all specified
below and in the source. Recreate pixel-accurately using the codebase's libraries. The numbers
(prices, holdings) are mock data — replace with a real market-data API.

## Files
- `Stock Portfolio App — Interactive.dc.html` — **the primary reference.** A fully interactive,
  data-driven single-phone prototype: tab navigation, stock detail, currency toggle, filters,
  buy/sell order ticket, dark mode. Read its `<script>` logic class for the full data model.
- `Stock Portfolio App (static showcase).dc.html` — a static side-by-side board showing all
  screens in **both light and dark** mode at once. Best for seeing exact visuals of each screen
  in each theme without interacting.

Open either file directly in a browser.

---

## Design Tokens

Two themes. Tokens are CSS custom properties in the prototype; values below are exact.

### Light theme
| Token | Value | Use |
|---|---|---|
| `--page` | `#f4f1ea` | App background (warm cream) |
| `--card` | `#fffdf8` | Cards, sheets, bars |
| `--card2` | `#f6f2e9` | Inset / secondary surfaces |
| `--ink` | `#2a2723` | Primary text (warm near-black) |
| `--sub` | `#8f897e` | Secondary text |
| `--faint` | `#b8b2a6` | Tertiary / inactive icons |
| `--line` | `#e8e2d5` | Borders, dividers |
| `--gold` | `#a8854a` | **Accent** (matte gold) |
| `--goldsoft` | `#efe6d2` | Gold tint (logo chips, active pills) |
| `--up` | `#4f8a6b` | Gain / positive (muted sage green) |
| `--down` | `#c0664f` | Loss / negative (muted terracotta) |
| `--ongold` | `#fffdf8` | Text/icon on gold fills |

### Dark theme
| Token | Value |
|---|---|
| `--page` | `#161410` |
| `--card` | `#211d17` |
| `--card2` | `#1b1813` |
| `--ink` | `#f1ece0` |
| `--sub` | `#a39c8d` |
| `--faint` | `#6f6a5e` |
| `--line` | `#322d24` |
| `--gold` | `#cba35f` |
| `--goldsoft` | `#2b2519` |
| `--up` | `#74b08c` |
| `--down` | `#d98a70` |
| `--ongold` | `#161410` |

### Allocation chart colors (semantic, theme-shifted)
Foreign stocks = `--gold`; Thai stocks = sage (`#7d9b6f` / dark `#8aab7c`);
Crypto = dusty blue (`#6f8aa8` / `#7d99b8`); Cash = clay (`#bfa07f` / `#c9ab88`).

### Color convention
**Western convention: green = gain/up, red = loss/down.** (Note: Thai markets sometimes use the
reverse; this design deliberately uses green-up. Confirm with product before changing.)

### Typography
- **Primary (UI + Thai):** `Anuphan` (Google Fonts), weights 300/400/500/600/700.
- **Display (monetary figures only):** `Newsreader` (Google Fonts), weight 500 — used for the big
  portfolio total, stock price, and order-ticket total. Gives a refined "luxury" serif accent.
- Type scale (px): hero total 42 · stock price 44 · screen title 26 · section value 15–19 ·
  body 13–15 · labels 11.5–13 · tab labels 10.5. Letter-spacing −0.3 to −0.5 on large numerals.

### Shape & elevation
- Phone frame: `390 × 844`, radius `46`.
- Cards: radius `20–24`, `1px solid --line`.
- Pills/chips: radius `8–10`. Logo chips: `40×40` radius `12`. Bottom sheet: radius `28 28 0 0`.
- Tab bar height `84`; detail action bar height `96`.
- Card shadow (light): `0 22px 60px -18px rgba(60,52,38,.4)`.

### Spacing
Screen horizontal padding `16–24`. Card inner padding `16–22`. List row vertical padding `13`.
Gaps `6–13`. Use an 8-ish base scale.

---

## Screens / Views

Bottom tab bar (5 tabs), active tab = gold, inactive = `--faint`:
**ภาพรวม** (Overview) · **เฝ้าดู** (Watchlist) · **ปันผล** (Dividends) · **รายการ** (Transactions) · **บัญชี** (Account).
The **Detail** screen is pushed on top (hides tab bar, shows a back button + buy/sell action bar).

### 1. ภาพรวม — Overview / Dashboard
- **Purpose:** At-a-glance portfolio health.
- **Layout (top→bottom):**
  - App bar: greeting "สวัสดีตอนเช้า" + user name "สมหญิง วัฒนกุล"; avatar circle (initials "สญ") at right → opens Account.
  - **Hero card:** label "มูลค่าพอร์ตรวม" + currency toggle pill (฿/$); big total (Newsreader); secondary line in opposite currency ("≈ $80,437.00"); day-change pill (▲/▼ + amount + %) colored up/down + "วันนี้"; sparkline (line only, up=green); time-range chips (1ว/1สั/1ด/3ด/1ป/ทั้งหมด).
  - **สัดส่วนการลงทุน (Allocation):** stacked horizontal bar + 2-col legend with %. Computed from holdings + cash.
  - **การถือครอง (Holdings):** card list; each row = logo chip, name + "TICKER · N หุ้น", value + day %. Tap → Detail. "ดูทั้งหมด" → Watchlist.

### 2. Stock Detail (pushed)
- **Purpose:** Inspect one instrument, see your position, buy/sell.
- **Layout:** back chevron, center title (TICKER + company), star toggle (fills gold when watched);
  price block (Newsreader price in selected currency, ▲/▼ % pill, "≈" alt currency);
  large area chart (line color = up/down, gold-tinted fill) + range chips;
  3×2 stats grid (เปิด/สูงสุด/ต่ำสุด/มูลค่าตลาด/ปริมาณ/P-E);
  **การถือครองของคุณ** card (จำนวน, ต้นทุนเฉลี่ย, กำไรที่ยังไม่รับรู้) — OR an empty-state
  ("คุณยังไม่ได้ถือครอง …") when shares = 0.
  Bottom **action bar:** ขาย (outline, down-color) / ซื้อ (gold filled) → open order ticket.

### 3. เฝ้าดู — Watchlist
- Title + add (+) button. **Filter tabs:** ทั้งหมด / หุ้นไทย / ต่างประเทศ / คริปโต (filters the list live).
- Three index summary cards (SET, S&P 500, BTC) with mini sparkline + %.
- List: each row = TICKER + company, mini sparkline (up/down color), price + %. Tap → Detail.

### 4. ปันผล — Dividends  *(currently static)*
- Summary card (รับแล้วในปีนี้ ฿18,420; คาดทั้งปี; อัตราผลตอบแทน 3.20%; รับ/เดือน).
- Monthly bar chart (gold bars, current month highlighted).
- "จ่ายเร็ว ๆ นี้" list: stock, XD date + per-share, expected amount + pay date.

### 5. รายการ — Transactions
- Title + filter icon. **Filter chips:** ทั้งหมด / ซื้อ / ขาย / ปันผล (filters live).
- Date-grouped list ("20 มิถุนายน 2568"). Each row: type icon in a tinted circle
  (buy = down-arrow/green, sell = up-arrow/red, dividend = coin/gold), title, sub (qty · price),
  amount (dividend in green, else ink), time. **Confirmed orders are prepended here.**

### 6. บัญชี — Account
- Profile card (avatar, name, "นักลงทุนระดับทอง · ตั้งแต่ 2563").
- **การแสดงผล:** โหมดมืด (toggle switch, works) · สกุลเงินหลัก (฿ THB / $ USD segmented, works).
- **ทั่วไป:** การแจ้งเตือนราคา (toggle) · ความปลอดภัย (chevron) · ออกจากระบบ (red).

---

## Interactions & Behavior
- **Tab navigation:** switches the content screen; active tab colored gold.
- **Open detail:** tapping any holding/watch row sets `selected` and pushes Detail (remembers
  `prevScreen`); back returns to it.
- **Currency toggle (฿/$):** global `cur` state ('thb'|'usd'); **all** prices/values recompute via
  formatters. Reachable from the hero pill and the Account segmented control.
- **Time-range chips:** set `range`; active chip highlighted (gold tint). (In prototype the chart
  path is static per direction; in production, fetch series per range.)
- **Watchlist / Transactions filters:** set `watchFilter` / `txnFilter`; list filtered live; empty
  groups hidden.
- **Star toggle:** toggles membership in `starred` for the selected symbol; star fills gold.
- **Order ticket (bottom sheet):** ซื้อ/ขาย opens a sheet with a quantity stepper (−/+, min 1),
  a live computed total (qty × price, in selected currency), and a confirm button (gold for buy,
  red for sell). **Confirm** prepends a transaction to today's group, closes the sheet, navigates
  to Transactions, and shows a success **toast** (~2.2s). Tapping the dim backdrop closes it.
- **Switches** (dark mode, notifications): animated knob translate (.2s).
- **Transitions:** keep light; switch knob slides, toast fades up. (No heavy page transitions in
  the prototype — add native push/slide in the app.)

## State Management
From the prototype's logic class (`renderVals`):
```
screen        'overview'|'detail'|'watch'|'dividends'|'transactions'|'account'
prevScreen    screen to return to from detail
dark          boolean (theme)
cur           'thb' | 'usd'  (display currency)
range         selected chart range key
watchFilter   'all'|'thai'|'foreign'|'crypto'
txnFilter     'all'|'buy'|'sell'|'dividend'
selected      symbol shown in Detail
starred       { [symbol]: boolean }
notif         boolean
ticket        null | { mode:'buy'|'sell', sym, qty }   (drives the order sheet)
extraTxns     [] confirmed orders prepended to the transaction list
toast         transient success message string
```

### Data model (mock → replace with API)
Each instrument: `{ sym, name, name2, logo, exch, native:'usd'|'thb', cat:'foreign'|'thai'|'crypto',
kind:'stock'|'crypto', price, dayPct, shares, avg, open, high, low, mcap, vol, pe }`.
- **Canonical price is stored in USD**; `RATE = 36.4` THB/USD converts for display. Replace with a
  live FX rate and a market-data feed (price, dayPct, OHLC, mcap, vol, P/E, historical series).
- Portfolio total = Σ(shares×price) + cash; day change = Σ(value × dayPct); allocation = Σ by `cat`.
- Formatting helpers `price()/val()/altVal()/qtyLabel()/pctStr()` show the rounding/format rules
  (THB 0 decimals for ≥1000, USD 2 decimals; crypto qty 2 decimals; etc.) — mirror these.

## What's needed to become a real app
- Real-time market data + FX API (replace all mock numbers).
- Auth / user accounts; persistent storage (DB) instead of in-memory state.
- Real brokerage integration for buy/sell orders (the ticket is UI-only).
- Historical price series per range for the charts.
- Localization scaffolding (currently Thai-only copy is inline).

## Screenshots
Reference captures in `screenshots/` (full device, intro chrome hidden):
`01` Overview (light) · `02` Stock Detail (light) · `03` Watchlist (light) ·
`04` Transactions (light) · `05` Account (light) · `06` Overview (dark) ·
`07` Stock Detail (dark) · `08` Order ticket sheet (dark).
These are static references — open the HTML prototypes for live interaction and the remaining
screens/states (Dividends, filters applied, empty-state detail, currency in USD).

## Assets
No image assets. All icons are simple inline SVG (stroke-based, currentColor-style). Logos are
text initials in gold chips — swap for real brand logos in production. Fonts: Anuphan + Newsreader
(Google Fonts) — load equivalents in the target platform.
