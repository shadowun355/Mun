# Handoff

## Latest (2026-06-30 #13) — DEPLOY: merged feat/pricing-page → main (SCB fix LIVE + VERIFIED)
**SCB price VERIFIED correct by user 2026-06-30.**
Root cause SCB still stale after #12: **Render deploys `main`, but #10/#11/#12 all lived only on
`feat/pricing-page`** — never reached main → live site ran old `marketapi.js` (`thaiSyms:
['PTT','CPALL','KBANK']`, SCB absent → never refreshed). Proxy was always correct
(`/quote?sym=SCB` → 148.0 THB).
- **Action:** merged `feat/pricing-page` → `main` (`--no-ff`), pushed `cac17d6`. Clean merge,
  no conflicts. Render redeployed static. Confirmed deployed `marketapi.js` = new `thai()`
  (iterates every `cat:'thai'`/`native:'thb'` catalog key, FREE proxy, patch by `.BK` key);
  `app.js` boot `await fx()` before hydrate also live.
- **Went live this merge (user chose "merge whole branch"):** #10 pricing page, #11 Lemon Squeezy
  billing (client falls back to MOCK until LS secrets set — safe), #12 SCB price fix.
- **User verify:** hard-refresh → open SCB → ≈฿148 (not ฿131); PTT/CPALL/KBANK still tick. Eyeball
  pricing screen. **#11 still needs:** LS store/2 variants → fill `LS` URLs in app.js + 3 secrets →
  `supabase db push` (migration 20260627000002) + `supabase functions deploy lemonsqueezy-webhook
  --no-verify-jwt`.

## Latest (2026-06-29 #12) — fix: Thai stock prices wrong/stale (PUSHED, redeploying)
User: SCB + other Thai stocks showing wrong price. Proxy CONFIRMED correct
(`/quote?sym=SCB` → 146.5 THB, matches Yahoo). Bug client-side, two compounding defects
(traced via Explore agent):
- **Stale:** `marketapi.js thai()` only refreshed hardcoded `['PTT','CPALL','KBANK']`.
  SCB is discovery-only (keyed `SCB.BK`, not seeded) → never patched by 60s tick;
  `patch()` no-ops on absent keys anyway. **Fix:** `thai()` now iterates every
  `cat:'thai'`/`native:'thb'` instrument in the live catalog (held+watched+discovered)
  via the FREE keyless proxy (bare ticker), patches by the `.BK` catalog key. Dropped
  `thaiSyms` const. Seeded PTT/CPALL/KBANK still covered (cat thai).
- **Wrong value:** `boot()` ran `hydrateHeldSymbols()` BEFORE first `fx()` → `quoteInst`
  divided 146.5 THB by fallback `RATE=36.4`, display later ×live rate (~32.5) → ~10% low,
  permanent (never re-quoted). **Fix:** `await MarketAPI.fx(app)` before hydrate.
  (Fixing the stale defect also self-heals this on the first tick.)
- Files: `web/marketapi.js` (rewrote `thai()`, dropped `thaiSyms`), `web/app.js` (1 line
  in boot). No migration/proxy/deps. `node --check` both clean. Commit pushed on
  `feat/pricing-page`. **NOT browser-verified** (extension disconnected). User: after
  redeploy, log SCB → reload → ≈฿146.5 not ฿131; PTT/CPALL/KBANK still refresh.

## Latest (2026-06-27 #11) — feat: Lemon Squeezy real billing (CODE DONE, needs LS dashboard + secrets)
Real subscriptions via Lemon Squeezy (merchant-of-record — no Thai company; remits VAT).
Drops into existing `subscriptions` table (provider CHECK already allows 'lemonsqueezy'); quota
hot-path + client unchanged (per `functions/BILLING.md`). Prices ฿300/mo · ฿2,700/yr.
- **New Edge Function** `web/supabase/functions/lemonsqueezy-webhook/index.ts`: verifies
  `X-Signature` HMAC-SHA256 (timing-safe) of raw body vs `LEMONSQUEEZY_WEBHOOK_SECRET` →
  service-role upsert into `subscriptions` onConflict `(provider,provider_subscription_id)`.
  Allowlists 7 `subscription_*` lifecycle events (NOT payment_* — those carry an Invoice obj,
  would write garbage). Status map: active/on_trial→Pro; cancelled/past_due→Pro until ends_at
  (grace); paused/unpaid/expired→revoked. Cancels all active rows before granting (one-active
  -per-user index). user_id from checkout `custom_data`, fallback lookup by sub id.
- **Migration** `20260627000002_lemonsqueezy_webhook.sql`: PLAIN unique index on
  `(provider,provider_subscription_id)` — partial predicate breaks PostgREST onConflict (42P10);
  NULLs distinct so 'mock' rows coexist.
- **env.ts**: +3 opt() vars (WEBHOOK_SECRET, VARIANT_MONTHLY, VARIANT_YEARLY). opt() so other
  functions still cold-start.
- **Client `web/app.js`**: `LS` config const (buy URLs + portal, placeholders `PUT_*`) +
  `LS_LIVE` flag. `goCheckout(cycle)` redirects to LS hosted checkout w/ `checkout[custom]
  [user_id]`; `goPortal()` → LS billing portal. Both fall back to mock (`setMockTier`) until
  URLs set. Pricing CTA → goCheckout; account cancel → goPortal. CTA label drops "(จำลอง)"
  when LS_LIVE.
- **Setup doc** `functions/lemonsqueezy-webhook/README.md`: dashboard steps, secrets, deploy
  (`--no-verify-jwt`), client wiring, status map, test.
- **advisor-reviewed (3 blocks fixed):** partial-index onConflict 42P10 → plain index; pre-cancel
  `.neq` missed NULL mock rows → cancel-all; payment_* Invoice-shape corruption → lifecycle
  allowlist. **Not deployed/tested** — needs user LS account + secrets + `supabase db push` +
  function deploy. `node --check app.js` clean; webhook not deno-checked (deno not local).
- **User TODO:** create LS store/product/2 variants → fill `LS` URLs in app.js + 3 secrets →
  `supabase db push` + `supabase functions deploy lemonsqueezy-webhook --no-verify-jwt`.

## Latest (2026-06-27 #10) — feat: dedicated Pricing page (NOT pushed — needs eyeball)
New `pricing` screen (`isPricing`, full-screen, hides bottom nav like detail). Free vs Mun Pro
comparison + monthly/yearly billing toggle. **Prices (user-set):** ฿300/mo, OR yearly billed
฿3,600 −25% = ฿2,700/yr (=฿225/mo effective, "ประหยัด 25%"). Toggle drives Pro card price +
CTA label via `S.billCycle` (default `'year'`).
- `web/app.js`: `billCycle:'year'` init state; template adds `isPricing`, `goPricing`
  (stamps prevScreen), billing toggle data (`billYearly`, seg bg/col, `setBillMonth/Year`,
  `proPriceMain/Sub`, `proCtaLabel`) via an IIFE-spread in the render-data object;
  `showTabs` now also excludes `pricing`. CTA reuses existing `upgradeMock`; back reuses `back`.
- `web/index.html`: pricing `<sc-if>` block (back header, billing seg toggle, highlighted Pro
  card w/ price+CTA, Free card, footer). isFree→Pro CTA active + Free "แผนปัจจุบัน" badge;
  isPro→Pro "แผนปัจจุบันของคุณ". All upgrade entry points rerouted to `goPricing`/"ดูแพ็กเกจ":
  account free card + 3 tool paywalls (ปันผล/จัดสรร/ภาษี).
- Payment still MOCK (`upgradeMock`→`setMockTier`). Real provider (Lemon Squeezy/Paddle) deferred.
- **Verify:** `node --check app.js` clean. NO browser verify (extension was disconnected last
  session). User should hard-refresh → บัญชี → ดูแพ็กเกจ, toggle รายเดือน/รายปี (฿300↔฿225),
  Free CTA→upgrade, flip Pro→both cards show current-plan state.

## Latest (2026-06-27 #9) — fix: Thai (.BK) symbols stubbed as foreign (PUSHED, redeploying)
Commit `36f6ce3`. User: TISCO showing ต่างประเทศ instead of หุ้นไทย. Root cause = `stubInst()`
hardcoded `cat:'foreign'/native:'usd'`. A `.BK`-qualified key is ALWAYS Thai SET, but a
not-yet-hydrated one fell to `getInst → stubInst` → foreign. **Why watchlist-only:**
`hydrateHeldSymbols` only rebuilds HELD (txn-derived) syms from `symbol_metadata`, NOT
watchlist-only starred syms — so a starred `TISCO.BK` after reload had no seed/hydrated row
→ stub → foreign. Fix: `stubInst` infers `thai/thb/SET` from a trailing `.BK`.
- **Diagnosed live (Puppeteer + throwaway signup `sutest_tisco_v1@mun-test.dev`, live edge):**
  search `tisco` → top hit TISCO (TH), TISCO-R (TH), then foreign cross-listings (47T.F FRA,
  47T.SG, TSCFY PNK = US); registerHit(top) → `TISCO.BK` cat thai (correct); `symbol_metadata`
  cache has TISCO market TH (correct). So search/register/cache/hydrate all fine — ONLY the
  stub was wrong. Verified post-fix: starred `TISCO.BK` (unhydrated) → getInst cat thai/thb/SET,
  dispSym "TISCO", demo() 0 fails.
- **ponytail follow-up (DONE, commit `05b5d28`):** `hydrateHeldSymbols` now unions held ∪
  starred, so watchlist-only discovered syms also recover live price on reload (was stub price
  0). Verified live: starred `TISCO.BK` → price 0 → 3.228 USD-canonical, cat thai. The free
  cached `/quote` per symbol applies to watched syms too. Throwaway user
  `sutest_tisco_v1@mun-test.dev` left in auth.users.
- File: `web/app.js` (stubInst + demo assert; hydrateHeldSymbols held∪starred).

## Latest (2026-06-27 #8) — เครื่องมือ Tools hub + Pro-gating + DCA sim (PUSHED, redeploying)
Commit `77c8522`. PortPro-style Tools hub (screenshots: portpro.app/Tools/*). Plan:
`~/.claude/plans/inherited-meandering-pike.md`.
- **New `tools` screen** (`<sc-if isTools>`) = header + 5-tab pill bar (`toolTabs`, state
  `S.toolTab` default `avg`): ถัวเฉลี่ย · DCA · ปันผล · จัดสรร · ภาษี.
- **Nav folded:** removed standalone `วางแผน` + `ปันผล` nav items, replaced by ONE
  `เครื่องมือ` item (wrench icon). Nav now 5: ภาพรวม · เฝ้าดู · เครื่องมือ · รายการ · บัญชี.
  Deleted dead `goPlanner`/`goDividends` + the standalone dividends screen block.
- **Tabs:** ถัวเฉลี่ย (free) = the existing Buy Planner (planList/openPlanForm reused).
  DCA (free) = NEW `dcaSim()` compound projection → `#dcasheet` (plain DOM, presets
  VOO/SPY/QQQ/กำหนดเอง + initial/monthly/growth%/years → FV, invested, growth%, yearly
  growth-curve SVG). ปันผล/จัดสรร/ภาษี (**Pro**) reuse divRows/alloc/exportTax; free users
  get an upgrade paywall card (reuses Phase 8 `isPro`/`upgradeMock`).
- **Bypass closed:** Overview `จัดกลุ่ม` (`openAlloc`) + Transactions `ภาษี` (`exportTax`)
  route free users to the paywalled hub tab instead of running. Gating is client-side UX
  (note: alloc_groups writes could be server-gated later like Phase 8 caps).
- **Payment still MOCK** (`setMockTier`). Real provider deferred — recommend **Lemon
  Squeezy/Paddle** (merchant-of-record, no Thai company) over Omise/Stripe (PromptPay but
  need a business entity). Separate later phase.
- **Verified (Puppeteer, no login, `new Component()` + seeded txns):** demo() 0 fails;
  5-item nav + 5 tabs render; Free → paywall on ปันผล/จัดสรร/ภาษี; DCA VOO 10k/500/10%/10y →
  ฿4,713,542 (=$129,493×36.4) / invested ฿2,548,000 / +85.0% + curve drawn; Pro flip →
  all 3 tabs unlock real tools. `dcaSim` math node-checked. Screenshots confirmed
  (DCA sheet + dividend paywall match PortPro).
- Files: `web/app.js` (dcaSim, hub state/handlers, DCA sheet controller, gating), `web/index.html`
  (hub screen, nav swap, #dcasheet). No migration/proxy/deps.

## Latest (2026-06-27 #7) — Polish: full .BK label sweep (PUSHED, redeploying)
Commit `54b72d3`. `dispSym()` now applied to ALL user-facing ticker surfaces missed in #6:
watchlist rows, transaction-list titles (`ซื้อ SCB.BK`→`ซื้อ SCB`), alloc-assign sheet labels,
txn-form search-box prefill (pick/native-edit/dividend paths), alert-sheet title. Confirmed
`saveTxn` reads the hidden `tf-sym` (catalog key, stays `.BK`) not the visible search box, so
stripping the display is safe. Search-results dropdown intentionally keeps the raw provider
ticker (shown next to a `· TH` market tag — disambiguates). `node --check` clean.
- **No browser verify this round** — Claude-in-Chrome extension not connected ("Browser
  extension is not connected"). Pure code review + node syntax/logic checks. User should
  hard-refresh + eyeball holdings/watchlist/txn list for clean Thai tickers + logos.

## Latest (2026-06-27 #6) — Thai ticker labels + Thai logos (PUSHED, redeploying)
User report: `.BK` leaking into UI labels (e.g. `SCB.BK เกิน 25%`) + Thai stocks no logo.
Commit `7ec1bff`, pushed (static redeploy).
- `dispSym(sym)` = strip trailing `.BK` for **human-facing labels only** (holdings holdSub,
  concentration `concRows`/`overCapMsg`, detail header, alert toast). Catalog key stays
  `.BK`-qualified for quote/candle calls (the GLD-collision key scheme is untouched).
- `logoUrl(inst)` now **re-adds `.BK` for Thai** (`cat==='thai'||native==='thb'||sym .BK`).
  Parqet keys SET logos by the `.BK` ticker — verified: `PTT.BK/CPALL.BK/KBANK.BK/ADVANC.BK/
  DELTA.BK/SCB.BK` → 200, bare `PTT/CPALL` → 404. US stays bare (AAPL/JEPQ/SCHD 200). 404s
  still drop the img → gold initials fallback (no broken images).
- `demo()` asserts added (dispSym + TH/US logoUrl). Node sanity-check passed.
- **จัดกลุ่ม button "missing" was a stale browser cache** — live HTML was correct; after a
  hard refresh (Cmd+Shift+R) the user saw it. No code change needed for that.

## Latest (2026-06-27 #5) — Phase B: custom allocation groups (VERIFIED LIVE 2026-06-27)
**Migration applied + persistence verified live on mun-3skf.onrender.com** (commit `3f4f561`,
pushed). Fresh signup `sutest_alloc_v1@mun-test.dev`: add group (live `alloc_groups` insert,
RLS ok) → rename "Growth" → assign AAPL (`alloc_assign`) → alloc shows Growth 75% / ไม่จัดกลุ่ม
25% → **reload PERSISTS** (group + assignment reloaded) → delete group → AAPL assignment
cascade-removed → reverts to auto-category fallback. 0 console errors. Throwaway test holdings
deleted after; throwaway user `sutest_alloc_v1@mun-test.dev` left in auth.users.

(original entry) Overview `สัดส่วนการลงทุน` supports user-defined buckets ("Custom groups +
Overview `สัดส่วนการลงทุน` now supports user-defined buckets (the "Custom groups + rename"
option). The inert "ปรับสมดุล" link became **"จัดกลุ่ม"** → `#allocsheet` (plain DOM, rebuilt
on open): rename/delete groups, "+ เพิ่มกลุ่ม", and assign each holding via a `<select>`
(**tap-to-assign**, not drag — ponytail). When the user has groups, the alloc bar+legend show
custom buckets (value summed per group; unassigned holdings → an `ไม่จัดกลุ่ม` bucket); with no
groups it **falls back to the existing auto-category split** (existing users unchanged).
- **Persistence — isolated tables (not the prefs upsert):** new migration
  `web/supabase/migrations/20260627000001_alloc_groups.sql` = `alloc_groups`(id,user_id,name,
  color,sort) + `alloc_assign`(user_id,sym,group_id; delete-cascades from groups) + own-rows
  RLS. `loadUserData` adds both selects (→ `[]` when unmigrated → feature dormant, theme/currency
  saving unaffected). app.js: `loadAlloc`/`addGroup`/`renameGroup`/`deleteGroup`/`assignSym` +
  `openAllocForm`/`wireAllocForm` (bound at boot); renderVals branches `alloc`.
- **Verified (Puppeteer, no login — `new Component()`):** fallback labels = auto-category;
  custom Growth 78% (3500/4500) / Safe 0% / ไม่จัดกลุ่ม 22% (1000/4500); sheet builds group
  inputs + per-holding selects with correct current assignment; screenshot confirmed. Live DB
  round-trip (add/rename/delete/assign persist) needs the migration + login.
- **TO FINISH (user):** run the migration in the Supabase SQL editor, then verify add 2 groups →
  rename → assign holdings → % per bucket → reload persists → delete group → members revert to
  ไม่จัดกลุ่ม. Files: `web/app.js`, `web/index.html`, the new migration.

## Latest (2026-06-27 #4) — Phase A: Thai-native txn price + watchlist add/delete (DONE+VERIFIED)
Plan: `~/.claude/plans/generic-yawning-grove.md` (3 tasks; this is Phase A, client-only).
- **Txn price/fee in the asset's native currency.** `เพิ่มรายการ` price/fee now show `฿` for
  Thai assets, `$` else — keyed on `getInst(sym).native` (NOT the `S.cur` display toggle).
  `setPriceCcy(sym)` sets the `tf-cur`/`tf-cur2` glyphs; `openTxnForm`/`pickHit` prefill in
  native units (×RATE for Thai); `saveTxn` converts native→USD-canonical (`/RATE`) before
  storing `price_usd`+`fee`. Round-trip ฿ may drift if RATE moved (USD-canonical store) —
  consistent with how all THB holdings reprice.
- **Watchlist add/delete.** `เฝ้าดู` is now driven by the user's `starred` set (was a hardcoded
  class array). "+" → `#watchsheet` (plain DOM, reuses `Fn.call('/search')`) → pick stars the
  symbol; each row has a ✕ delete (`removeWatch` → `saveStar(sym,false)`); empty-state when
  none. `watchRows` uses `getInst` (discovered/uncataloged starred syms render a stub, no
  crash). `wireWatchAdd()` bound at boot.
- **Verified (Puppeteer, no login needed — `new Component()`):** demo() 0 fails; Thai PTT edit
  → ฿ glyph + 32.98 / 132.5 prefill (×36.4), screenshot confirmed; US AAPL → $ unchanged;
  ฿→USD conversion round-trips; watchlist renders from starred incl. uncataloged ZZZZ, empty
  state, add-sheet opens. Live Supabase save round-trip not tested here (same div formula).
- Files: `web/app.js`, `web/index.html`. **Phase B (custom allocation groups + migration) NEXT.**

## Latest (2026-06-27 #3) — news sentiment tags (CODE DONE + VERIFIED, awaiting commit/push)
Each translated news item now tags which of the user's assets it affects, colored by
direction: green (positive) / red (negative). Proxy `/news` adds `en` (English headline+
summary) + `sentiment` ('pos'/'neg'/'' from a keyword lexicon `_sentiment()` on the English
text). Client `renderVals` builds a ticker/name index over the catalog, scans each story's
`en` text, emits `tags` (≤4 symbol chips) colored `var(--up)`/`var(--down)`/`var(--sub)` by
sentiment; `index.html` renders a chip row (nested `sc-for`) between the Thai brief and the
source credit. Verified in-browser: "Apple surge"→green AAPL; "Tesla plunges, Nvidia slips"→
red NVDA+TSLA; "markets mixed/Fed"→no tags; "Bitcoin rallies"→green BTC. Screenshot matched.
- **ponytail:** lexicon sentiment + substring symbol match — keyless, good enough. Upgrade to
  Finnhub news-sentiment API or an LLM pass if accuracy matters. Article-level sentiment colors
  all its chips (one tone per story).
- Files: `proxy/app.py`, `web/app.js`, `web/index.html` (uncommitted; push redeploys proxy).

## Latest (2026-06-27 #2) — real brand logos (CODE DONE + VERIFIED, awaiting commit/push)
Holdings/dividends/ticket badges now show real issuer/brand logos (J.P.Morgan, Schwab,
SPDR, Tesla, …) instead of 2-letter initials, matching a target reference design. Source:
keyless Parqet logo CDN (`assets.parqet.com/logos/symbol/<TICKER>?format=png&size=96`).
`app.js` `logoUrl(inst)` (bare ticker, strips `.BK`/`-USD`) + `logoUrl` added to the holdings,
dividends, and ticket item builders. `index.html`: each badge overlays `<img>` absolutely over
the existing initials badge; static `onerror="this.remove()"` → on 404 the img drops and the
gold initials show through (no broken images). Verified in-browser: JEPQ→J.P.M, GLD→SPDR,
TSLA→Tesla, SCHD→Schwab render; Thai PTT + junk ticker fall back to initials. Only console
noise = the expected fallback 404s.
- **ponytail:** unofficial keyless CDN (same style as Yahoo/gtx). Thai SET tickers mostly absent
  on Parqet → graceful initials fallback. Swap CDN if coverage/quality matters.
- Files: `web/app.js`, `web/index.html` (uncommitted).

## Latest (2026-06-27) — Thai news brief + GLD collision fix (CODE DONE + VERIFIED, awaiting push→deploy)
Two changes, not yet committed/pushed (push redeploys Render proxy = needed for news live).
- **News = Thai brief, no click-through.** Proxy `/news` now translates each Finnhub
  headline + summary to Thai (keyless Google `gtx` endpoint, same unofficial-source style as
  Yahoo), caches by source string (module dict — client polls every 60s, never re-translate),
  parallel first-fill (`ThreadPoolExecutor`), **per-article fallback to English** so one bad
  translate never blanks the list. `summary` carried through (empty → headline only). Client:
  `index.html` news card = Thai headline + Thai brief body + demoted source credit link
  (`ที่มา: <source> ↗`, no forced redirect); `app.js` newsItems maps `summary`/`hasSummary`.
  Verified: proxy pipeline direct (Thai out, empty/junk fallback, shape) — local has no
  FINNHUB_KEY so end-to-end Thai news only shows after deploy (live proxy has the key).
- **GLD ticker collision FIXED (client-only, no edge redeploy).** Real collision: `GLD` =
  SPDR Gold Shares (US, USD $373) AND `GLD` = KTAM Gold ETF Tracker (Thai SET, Yahoo `GLD.BK`,
  THB ฿5.34) — both keyed bare `'GLD'` in the catalog → second pick silently returned the first.
  Fix: `registerHit` market-aware key (TH collisions → `'GLD.BK'`, reuses a same-market seed so
  PTT stays `'PTT'`); discovered insts carry `bare` (un-suffixed) for quote/candle calls;
  `quoteInst`/`pickHit` use it; `marketapi.yahooSym` guards double-`.BK` + maps only synthetic
  `XAU`→`GC=F` (real gold ETFs keep their own ticker); `hydrateHeldSymbols` maps qualified held
  keys back to bare for the metadata lookup. Verified in-browser: `demo()` 0 fails; US `GLD`→
  `GLD`(USD), TH `GLD`→`GLD.BK`(THB) distinct; `XAU`→`GC=F`; seed `PTT` not duplicated.
- **TO FINISH (user decision):** push → Render redeploys `mun-re6q` (proxy) + `mun-web` (static);
  then live-verify Thai news renders on mun-3skf.onrender.com + GLD search shows two distinct rows
  (SPDR/NYSEArca vs KTAM/Thailand). gtx is unofficial — if Render egress gets blocked, swap to
  MyMemory; news degrades to English, never blank.

## Current status
**Web logo shipped + verified live 2026-06-26 (commit `296cd41`, pushed).** Gold "M"
PNG (`web/logo.png`, 128px/17KB, downscaled from `~/Downloads/Untitled40` 1024px) is now
the favicon (replaced inline ม SVG) + sidebar brand icon (22px before "Mun · มั่น" in
`index.html` `.brand`). Verified in-browser via DOM: favicon href=logo.png, brand img
naturalWidth=128 (loaded), brand visible. Puppeteer screenshot tool was hitting a 5s
font-load timeout — DOM check used instead. Root `*-verify.png`/`mun-desktop.jpg`
gitignored (commit before).

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
  - Finnhub key rotated + Google OAuth tested working (user, 2026-06-24).
  - Optional: wrap gate/sheet inputs in a `<form>` to clear a verbose Chrome DOM hint (not
    an error); turn Email "Confirm email" back ON for real users (off for testing).

#### SymbolUniverse — production symbol service (NEW workstream, plan `~/.claude/plans/sorted-stirring-valiant.md`)
Replace hardcoded ticker lists with a provider-backed cache + freemium quota, built
phased (DB → services → edge functions → reliability). User-locked: lazy cache-first
(cache>API), **Supabase Edge Functions (Deno/TS)** runtime, **two-table cache**
(`symbol_metadata` long-TTL / `symbol_quote` short-TTL), Free=5 external fetches/day,
mocked subscriptions (Stripe-ready schema). Search verified: Yahoo `/v1/finance/search`
(US/ETF) + `<sym>.BK` probe (Thai) resolves all of AAPL/SCHD/JEPI/JEPQ/PTT/ADVANC/DELTA,
no SET list to maintain.
- ✅ **Phase 1 — DB foundation & concurrency, APPLIED + VERIFIED LIVE 2026-06-24.**
  Migration ran in Supabase SQL editor ("Success"). `phase1_assert.sql` (new hard-assert
  DO-block, raises on any failed check) → "Success" = quota 5-allow-then-deny,
  idempotent replay no double-charge, unlimited tier all hold. Trigram seq-scan on the
  2-row table is expected (planner picks the index once the table grows).
  `web/supabase/migrations/20260624000001_symbol_universe_foundation.sql` (one atomic
  migration): tables `plans`/`subscriptions`/`user_api_usage`/`symbol_metadata`/
  `symbol_quote`/`idempotency_keys` + indexes (trigram search, partial-unique active sub,
  expiry sweeps) + FKs + RLS (own-row reads; cache/plans public; all writes via service
  role / SECURITY DEFINER) + RPCs `consume_external_quota(key)` (atomic single-statement
  check-and-increment; idempotency ownership gate via `INSERT…ON CONFLICT DO NOTHING
  RETURNING`; frees key on deny) + `finalize_request(key,response)`. Seed = 4 plans.
  **No local Postgres** → not executed here. Verify: apply migration, then run
  `web/supabase/tests/phase1_verify.sql` in the Supabase SQL editor (5-allow-then-deny,
  idempotent replay no double-charge, unlimited tier, trigram index used) + the pgbench
  10-way concurrency check noted at the file's end. Phases 2–4 outlined in the plan.
- ✅ **Phase 2 — core services & architecture, CODE WRITTEN 2026-06-24 (commit pending), unverified.**
  Deno/TS service layer under `web/supabase/functions/_shared/` (see its README for
  the full architecture). `types.ts`, `errors.ts` (AppError + consistent envelope),
  `env.ts` (fail-fast), `http.ts` (fetch + timeout), `supabase.ts` (service/user
  clients + requireUser). `providers/`: `Provider` interface + symbol-mapping helpers,
  `yahoo.ts` (primary — keyless search + `.BK` Thai probe + quote), `finnhub.ts`
  (US, key-gated), `alphavantage.ts` (last resort). `services/`: `ProviderService`
  (priority Yahoo→Finnhub→AV, merge/fallback), `CacheService` (two-table TTL
  read/write-through; only layer touching cache tables), `RateLimitService` (wraps
  the Phase 1 quota RPCs), `SearchService` (cache-first; miss→quota→provider→
  write-through), `QuoteService` (resolve + stale-while-revalidate + graceful
  degradation). Error model + idempotency strategy documented in the README.
  **No deno in dev env** → not typechecked here; verified when Phase 3 deploys the
  Edge Functions.
- ✅ **Phase 3 — Edge Functions & cache flow, CODE WRITTEN 2026-06-24 (commit pending), unverified.**
  Two thin entrypoints over the Phase 2 services: `functions/search/index.ts`
  (GET|POST `/search?q=`) + `functions/quote/index.ts` (`/quote?sym=&market=`).
  Shared `_shared/respond.ts` (CORS + envelope + single error catch + param parse)
  and `_shared/context.ts` (auth + service-graph wiring: cache on service-role
  client, ratelimit on user-JWT client). Flow: auth → cache-first → miss charges
  atomic quota → providers → write-through. **Stale-while-revalidate**: quote serves
  stale instantly + refreshes in background via `EdgeRuntime.waitUntil` (no charge —
  cached symbols unlimited). Idempotency-Key header → `finalize_request` stores the
  result for replay. Consistent `{success,error_code,message}` failures with HTTP
  status map. **Refinement to Phase 2:** dropped the coarse `premium` flag — gate on
  cache-miss only and let the atomic RPC enforce per-tier limits (correct for the
  4-tier model). Deploy/curl-verify recipe in `functions/README.md` (`--no-verify-jwt`;
  auth enforced in-code). **No deno** → not typechecked; verify by deploy + the curl
  suite (auth-required, US+Thai search, miss→cached flip, 5-then-deny quota, idempotent
  replay). STOPPED per phased instruction (awaiting "Phase 4" command).
- ✅ **Phase 4 — reliability & observability, CODE WRITTEN 2026-06-24 (commit pending), unverified.**
  Defense-in-depth on every provider call: timeout (http.ts) → retry+backoff+jitter
  (`reliability/retry.ts`, transient-only) → per-provider/per-instance circuit breaker
  (`reliability/circuit-breaker.ts`, 5 fails→OPEN 30s→half-open) → provider fallback →
  stale-cache degradation. Wired in `ProviderService.call()`. Observability:
  `observability/trace.ts` (AsyncLocalStorage trace_id/route/user set at the edge),
  `log.ts` (structured JSON, OTel seam), `metrics.ts` (counter/gauge/timing/timed).
  Metrics emitted: request.duration_ms, provider.latency_ms, provider.failure,
  cache.hit/miss, quota.consume. Docs: `functions/RELIABILITY.md` (Mermaid: quote-SWR
  sequence + breaker state machine, metric catalogue, failure-mode table) +
  `functions/BILLING.md` (mocked→Stripe path; schema already provider-agnostic, hot
  path unchanged; webhook sketch). **No deno** → not typechecked; verify on deploy via
  logs/metrics + a forced-provider-failure breaker test.

**SymbolUniverse milestone — go-live progress:**
  1. ✅ **Phase 1 migration APPLIED + hard-asserted 2026-06-24** (see Phase 1 entry above).
  2. ✅ **Edge Functions DEPLOYED + VERIFIED LIVE 2026-06-24.** `supabase functions deploy
     search|quote --no-verify-jwt` via `npx supabase` (no brew/Docker; bundled remotely).
     NO secrets set — Yahoo keyless primary covers US/Thai/etf/quote; Finnhub/AV fallback
     unset (add later if Yahoo insufficient). Base `https://livhijcgkielwrkdqtbm.functions.supabase.co`.
     Live curl suite all pass: auth gate 401 (clean envelope); search AAPL→US, ADVANC→TH/THB
     (`.BK` probe), JEPQ→etf; quote NVDA miss→cached flip (`meta.cached` false→true);
     PTT quote→35 THB; free quota 5-allow-then-QUOTA_EXCEEDED; Idempotency-Key replay does
     not double-charge (proven by count: keyed sym charged once, 4 more new → 6th denied).
     Cosmetic: cached quote responses carry extra null fields + empty `data":{}` vs the miss
     shape — works, low priority. Throwaway test users `sutest1/2@mun-test.dev` left in
     auth.users (harmless).
  3. ✅ **Client refactor (req 10) — DISCOVERY-ONLY slice, VERIFIED IN-BROWSER 2026-06-24.**
     Scope chosen = lazy/discovery (not full cutover): the 60s refresh stays on the FREE
     proxy; only symbol discovery goes through the quota-gated functions. Changes:
     `web/supabase.js` `Fn.call()` (fresh-token Edge Function caller over the envelope);
     `web/app.js` `getInst(sym)`/`stubInst()` (zero-price stub for held symbols absent from
     the seed catalog — swapped the unguarded `this.data[sym]` reads in
     renderVals/open/loadCandles/ticket so a held-but-unknown symbol renders instead of
     crashing); txn form `<select>` → debounced live search box hitting `/search`, pick
     `registerHit()` maps market→cat/kind/native + one `/quote` charge fills the price;
     `demo()` self-check. Verified live (Puppeteer, fresh signup): demo() OK; search
     JEPQ/PTT→7 hits; pick→registered + live price 29.39; held unknown `ZZZZ` renders
     detail+overview, no throw; only console noise a benign candles 404 for the fake symbol.
     **Reload bug found in review + FIXED:** a discovered holding zeroed the portfolio
     total after reload (`this.data` resets to seed → `getInst` stub price 0). `boot()` now
     calls `hydrateHeldSymbols()` after `loadUserData`: held syms absent from the seed are
     rebuilt from the public `symbol_metadata` cache + one FREE cached `quote`. Verified:
     log TSM → reload → total ฿0 → ฿147,560, TSM @ live 441.40, 0 errors. Also: search box
     now needs ≥2 chars + 350ms debounce (a search miss charges quota; don't burn it
     per-keystroke).
     **Deferred (ponytail):** the full "60s refresh iterates held/watched via quote fn"
     cutover (discovered holdings refresh on reload + on pick, not every 60s — fine for v1);
     global search outside the txn form. **Search relevance — FIXED + verified live 2026-06-24.**
     `SearchService.rank()` (NOT the provider — must cover the cache-hit path, which had no
     ORDER BY) scores hits: exact ticker +100, Thai `.BK` market +50, primary/bare symbol
     +20 (stable sort keeps Yahoo order for ties). Redeployed `search`. Curl (both cached,
     free): PTT → PTT(TH) #1 (was behind PTTRX); JEPQ → JEPQ #1, JEPQ.TO #2 (was reversed).

  **SymbolUniverse = LIVE.** All 4 phases + the discovery client slice shipped & verified.
  Throwaway test users left in auth.users: `sutest1/2@mun-test.dev`, `sutest_ui_*@mun-test.dev`.
  ⚠️ Revoke the Supabase personal access token used for the CLI deploy (was pasted in a
  terminal session): https://supabase.com/dashboard/account/tokens.

#### PortPro feature-parity milestone (plan `web/ROADMAP_PORTPRO.md`)
8-phase clean-room push to match portpro.app capabilities (NOT its look — Mun keeps its
gold design). Phases: 1 Transactions ledger · 2 FIFO/tax · 3 gold+market · 4 Buy Planner ·
5 Dividend Calendar · 6 alerts · 7 analytics · 8 freemium+payment.
- ✅ **Phase 1 — Transactions ledger, VERIFIED LIVE 2026-06-24 (commit `5083b6b`).**
  Transactions screen is now an editable ledger. `#txnsheet` (plain DOM, outside the
  reactive template so the 60s tick can't wipe inputs) = add/edit form: asset picker,
  buy/sell/dividend, qty, price (prefilled live), fee, native date. Tap a row to edit;
  delete from the sheet. `deriveHoldings` folds fee into cost basis; dividends are income
  (excluded from qty). Dividends "received" sums real dividend rows. CSV export (blob).
  Theme vars mirrored to `:root` so the sheet themes in dark. `© 2026 Mun` footer.
  Migration applied: `transactions += fee`, `side` widened to allow `dividend`. Verified:
  add w/ fee→avg incl fee, custom date, dividend→income+qty unchanged, edit, delete, CSV.
- ✅ **Phase 2 — FIFO cost basis & tax report, VERIFIED LIVE 2026-06-24 (commit `7b36020`).**
  `fifo()` = one chronological pass per symbol: sells consume oldest buy lots → realized
  gain/loss per sale; leftover lots are the holdings, so their cost = correct post-sale
  average (replaced lifetime-buy-avg). Buy fee raises lot cost/share, sell fee lowers
  proceeds/share. `deriveHoldings` delegates to `fifo().holdings`. UI: detail card realized
  P/L row, Transactions realized summary + "ภาษี" button → FIFO tax CSV
  (date,sym,qty,proceeds,cost,gain). Pure client, no migration. Verified live: buy10@100 +
  buy10@200 + sell15@300 → realized $2500, remaining 5@$200, tax CSV correct.
- ✅ **Phase 3 — gold + market overview/news, VERIFIED LIVE 2026-06-24 (commit `f2fd2e0`).**
  Pushed → Render redeployed proxy + static. Verified: `curl /yquote?sym=GC=F` → $4089 USD,
  `curl /news` → real CNBC/Reuters headlines. Browser (logged in): market strip shows 4 live
  tickers (ทองคำ ฿134,921 −1.20% / BTC / S&P / PTT), alloc has ทองคำ slice, news list = 12
  headlines w/ working links, 60s tick refreshes prices + persists news. Gold detail = COMEX
  USD header + 20 candle bodies/wicks drawn from `GC=F` (encodeURIComponent round-trip works) +
  not-held state. 0 console errors whole session.
  - Proxy: `fetch()` refactored into `yfetch(literal Yahoo sym)`; `/quote` = `yfetch(sym+".BK")`.
    `ccy` now THB only for `.BK`, else USD (was hardcoded THB). New `GET /yquote?sym=`
    (gold `GC=F`, indices) + `GET /news` (Finnhub general headlines, key server-side,
    fail-silent `[]`). yfetch logic verified live: GC=F $4085 USD, PTT.BK/^SET.BK THB.
  - Gold (XAU): seeded tradeable instrument (`cat:'gold'`, `kind:'gold'`, Yahoo `GC=F`,
    USD, **not** FX-divided). `MarketAPI.gold()` patches live; `yahooSym` maps gold→`GC=F`
    so detail candles work. Watchlist + `ทองคำ` filter chip + alloc slice (`--c-clay`) +
    `catUsd.gold`.
  - Market overview strip on Overview = live tickers XAU/BTC/SPY/PTT reused from catalog
    (no new fetch), tap-to-open. News list under holdings (Finnhub `/news`), hidden until
    headlines load, links open new tab.
  - **NEXT to finish phase:** push → Render redeploys proxy (`mun-re6q`) + static (`mun-web`);
    then verify live: `curl /yquote?sym=GC=F` → USD gold, `curl /news` → headlines (needs
    `FINNHUB_KEY` env, already set), browser: gold in watchlist/strip, gold detail candles,
    news list renders, 0 console errors. SET-index strip ticker skipped (THB index breaks
    USD-canonical reuse) — add later if wanted (`^SET.BK` resolves).
- ✅ **Phase 4 — Buy Planner (DCA), CODE DONE + UI/MATH VERIFIED LIVE 2026-06-26 (awaiting SQL).**
  New **วางแผน** (Planner) screen + 6th nav item (gold ladder icon). Plain-DOM `#plansheet`
  (outside the reactive template, like `#txnsheet`): free-text symbol + live-price hint,
  1–7 price/qty level rows (add/remove, ✕), live summary card — total qty, total invest,
  **avg cost** (=Σ price·qty / Σqty), and % vs live price. Saved-plans list on the screen;
  tap to reopen/edit/delete. Persistence: new `buy_plans` table (`user_id`,`sym`,
  `levels jsonb`,`created_at`, own-rows RLS) — migration
  `web/supabase/migrations/20260626000001_buy_plans.sql`. app.js: `planMath`/`openPlanForm`/
  `renderLevelRows`/`planRecompute`/`savePlan`/`deletePlan`/`loadPlans`; `buy_plans` added to
  `loadUserData` Promise.all; `wirePlanForm()` bound at boot; `isPlanner`/`goPlanner`/
  `c.planner`/`planList` in renderVals.
  - **ponytail:** skipped the quota-charging symbol search in the planner — levels are
    user-typed, a calculator shouldn't burn the daily search quota. Free-text symbol +
    live-price prefill. Add search if wanted.
  - **Verified (Puppeteer, fresh signup `sutest_p4_*@mun-test.dev`, local static server +
    live Supabase):** planner + 6-item nav render, sheet opens, 3 levels (200×10/180×10/
    150×5) → avg $182 / ฿6,079, +51.2% vs live ฿9,190, live hint "Apple", add/remove level
    works. Only console errors = `buy_plans` 404 (table not yet created — expected).
  - **TO FINISH (user):** run the migration in the Supabase SQL editor, then verify
    save→reload→persist→delete. Until then `savePlan` shows "Could not find table
    public.buy_plans" and keeps the sheet open (graceful, no crash). Throwaway test user
    `sutest_p4_*@mun-test.dev` left in auth.users.
- ✅ **Phase 5 — Dividend Calendar, CODE DONE + VERIFIED (local proxy) 2026-06-26 (awaiting push→deploy).**
  Proxy `GET /dividends?sym=<yahooSym>` (Yahoo chart `events=div`, keyless): native-ccy
  trailing dividends, TTM yield, last payment, **inferred** next XD (last date + median
  payment interval — Yahoo's forward calendar is crumb-gated/flaky). `proxy/app.py`:
  `dividends()` + `/dividends` route + SCHD smoke-test assert. Client: `MarketAPI.dividends(s)`;
  `app.loadDividends()` (1 call/held symbol on first Dividends-screen visit, session-cached
  via `_divLoaded`); `suggestDiv()` opens the Phase 1 ledger prefilled as a dividend. Dividends
  screen wired real — stats (คาดทั้งปี/portfolio yield/รับ-เดือน) + per-held-payer list (XD,
  amount/share, yield, est payout, est next XD), one-tap → prefilled dividend txn. Native
  amounts → USD-canonical (÷FX for THB). Removed the fake monthly bar chart.
  - **Verified:** local uvicorn proxy + live Supabase + browser. curl PTT.BK 6.57% / SCHD
    3.28% / AAPL 0.38%; browser PTT(6000)+SCHD(100) → correct ccy conversion (PTT ฿1.40/sh,
    SCHD ฿8.45/sh), annual ฿17,300, port yield 5.46%; one-tap → ledger prefilled
    (PTT/dividend/6000/฿1.40/11 ก.ย.). Test txns deleted after. Only console errs = local
    `/us` 404 (no local FINNHUB_KEY).
  - ⚠️ **Browser caches `marketapi.js`/`app.js` hard** — when verifying locally, the new
    `MarketAPI.dividends` method needed a forced reload (was served stale); had to inject it
    inline for the test. On the live site a fresh deploy is fine.
  - **TO FINISH:** push → Render auto-redeploys `mun-re6q`; live curl `/dividends?sym=SCHD` +
    browser check. No env/migration (keyless, no DB).
- ✅ **Phase 6 — Watchlist alerts (in-app slice), DONE + VERIFIED 2026-06-26 (awaiting SQL; Telegram deferred).**
  New `alerts` table (`user_id`,`sym`,`op` above/below,`price` USD-canonical,`active`,
  `triggered_at`, own-rows RLS) — migration `web/supabase/migrations/20260626000002_alerts.sql`.
  Detail-header **bell** (gold badge = active-alert count) → `#alertsheet` (plain DOM): op
  select + price (entered in DISPLAY currency, stored USD-canonical) + add; list w/ delete.
  60s `tick()` now calls `checkAlerts()` → fires active alerts whose threshold is crossed:
  toast + `triggered_at` + deactivate (one-shot, compared USD-canonical). app.js:
  `loadAlerts`/`openAlertForm`/`renderAlertList`/`wireAlertForm`/`saveAlert`/`deleteAlert`/
  `checkAlerts`; `alerts` in `loadUserData` Promise.all; `wireAlertForm` at boot;
  `d.alertCount`/`hasAlert`/`bellFill` + `openAlert` in renderVals.
  - **STOP boundary (Telegram):** deferred — needs a bot token + server cron (the browser
    tick only fires with the tab open). In-app only for v1. Decide Telegram when wanted.
  - **Verified (fresh build on :8779, browser, throwaway `sutest_p6_*@mun-test.dev`):** bell
    renders, sheet opens (title/฿-currency/prefill ฿9,190 ok), injected below-threshold alert
    → checkAlerts fires toast "⏰ AAPL ลงถึง …" one-shot; missing-table DB write handled
    gracefully. Console errs only expected `alerts`/`buy_plans` 404.
  - **TO FINISH (user):** run the `alerts` migration, then verify set→persist→trigger→
    deactivate→reload.
- ✅ **Phase 7 — Portfolio analytics, CODE DONE + VERIFIED 2026-06-26 (awaiting SQL).**
  Overview gains: (a) per-asset **concentration** card (each held sym's % of portfolio, sorted,
  with a bar; >25% CAP → red bar + a warning banner listing over-cap syms), (b) **growth trend**
  — the hero sparkline now draws from real daily `portfolio_snapshots` (green up/red down, flat
  fallback <2 days). `portfolio_snapshots` table (PK user_id+date, total_usd, own-rows RLS) —
  migration `web/supabase/migrations/20260626000003_portfolio_snapshots.sql`. `snapshotToday()`
  upserts today's total on load + each 60s tick (onConflict user_id,date); `snapshots` in
  `loadUserData`; renderVals builds `concRows`/`hasOverCap`/`overCapMsg` + `trend*` path.
  **ponytail:** on-load/tick capture, no cron (daily granularity is enough for a trend line).
  - **Verified (fresh build :8780, browser, injected holdings+snapshots, no DB):** AAPL 89.2%
    over-cap (warning "AAPL เกิน 25% ของพอร์ต"), BTC 9.6%/NVDA 1.3% sorted; 3 snapshots → rising
    green trend path (M0,56→L320,6) drawn; card+warning+line render in DOM. Errs only expected
    `buy_plans`/`alerts`/`snapshots` 404.
  - **TO FINISH (user):** run the `portfolio_snapshots` migration; trend fills as daily rows
    accrue (seed a couple rows to see it immediately).
- ✅ **Phase 8 — Freemium tiers, CODE DONE + VERIFIED (client) 2026-06-26 (awaiting SQL; Stripe deferred).**
  Reuses SymbolUniverse `plans`/`subscriptions` (no sub/`free` → Free; active non-free → Pro).
  **DB is source of truth:** `BEFORE INSERT` triggers enforce Free caps — ≤5 distinct traded
  assets, ≤1 buy plan, ≤3 alerts — raising `FREE_*_CAP`; client `capMsg()` translates to a Thai
  upgrade prompt (saveTxn/savePlan/saveAlert route errors through it). Migration
  `web/supabase/migrations/20260626000004_freemium_caps.sql` = `user_is_pro()` + 3 trigger fns +
  a `subs_own_mock_write` RLS policy (lets a user self-serve a `provider='mock'` sub). app.js:
  `subscriptions` in loadUserData → `isPro`; `setMockTier(pro)` upgrade/downgrade; renderVals
  `tierLabel`/`isPro`/`isFree` + handlers. Account screen: tier badge + upgrade card (Free) /
  cancel card (Pro).
  - **STOP boundary (Stripe):** real payment deferred — schema provider-agnostic
    (`functions/BILLING.md`); mock path RLS-gated to `provider='mock'`, real billing stays
    service-role + webhook. Wire Stripe when wanted.
  - **Verified (fresh build :8781, browser, throwaway `sutest_p8_*`):** Free badge + upgrade
    card + free-caps text render; mock upgrade pre-migration fails gracefully (RLS policy not
    applied → toast "violates RLS", no flip); injected Pro → Pro card + cancel; capMsg unit-ok.
  - **TO FINISH (user):** run the migration (AFTER buy_plans + alerts), then verify 6th asset /
    2nd plan / 4th alert blocked + mock upgrade→Pro→caps lift→cancel→Free.

- **PortPro milestone: ALL 8 PHASES DONE + VERIFIED LIVE 2026-06-26.** All 4 migrations
  applied (buy_plans, alerts, portfolio_snapshots, freemium_caps); all phases pushed + live on
  mun-3skf.onrender.com. **Phase 8 verified live** (fresh signup): Free caps enforced (6th
  asset/2nd plan/4th alert blocked with `FREE_*_CAP`; existing-asset buy at cap ok), mock
  upgrade→Pro lifts all caps, cancel→Free re-enforces. External boundaries left for a decision:
  **Telegram** (Phase 6 alert delivery — bot token + cron) + **Stripe** (Phase 8 payment —
  schema ready, `functions/BILLING.md`). Throwaway test users in auth.users:
  `sutest_p4/p6/p7/p8*@mun-test.dev`.

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
