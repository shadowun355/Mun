'use strict';
// Mun web — vanilla port of the SwiftUI app. The Component class below is lifted
// from the design prototype (same data model + portfolio math + markup). The only
// thing rebuilt is the reactive runtime that the prototype's missing `support.js`
// (DCLogic) used to provide: setState + the {{ }} / <sc-if> / <sc-for> / onClick
// template engine. Live data + persistence are re-applied from the iOS app.

// ---- template engine ----------------------------------------------------
const TPL = document.getElementById('tpl').content.firstElementChild;
const APP = document.getElementById('app');

function camelToKebab(k) { return k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()); }
function cssify(obj) {
  return Object.keys(obj).map(k => (k.startsWith('--') ? k : camelToKebab(k)) + ':' + obj[k]).join(';');
}
function resolve(expr, bag, locals) {
  expr = expr.trim();
  if (expr === 'false') return false;
  if (expr === 'true') return true;
  const parts = expr.split('.');
  let v = (locals && parts[0] in locals) ? locals[parts[0]] : bag[parts[0]];
  for (let i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
  return v;
}
function interpolate(str, bag, locals, isStyle) {
  return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
    const v = resolve(expr, bag, locals);
    if (v == null) return '';
    if (isStyle && typeof v === 'object') return cssify(v);
    return String(v);
  });
}
// build(node) -> Node[]  (arrays so sc-if/sc-for can drop or repeat)
function build(node, bag, locals) {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.nodeValue;
    return [document.createTextNode(t.includes('{{') ? interpolate(t, bag, locals, false) : t)];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === 'sc-if') {
    return resolve(node.getAttribute('value').replace(/[{}]/g, ''), bag, locals)
      ? childrenBuilt(node, bag, locals) : [];
  }
  if (tag === 'sc-for') {
    const list = resolve(node.getAttribute('list').replace(/[{}]/g, ''), bag, locals) || [];
    const as = node.getAttribute('as');
    const out = [];
    for (const item of list) {
      const scope = Object.assign({}, locals, { [as]: item });
      out.push(...childrenBuilt(node, bag, scope));
    }
    return out;
  }
  const clone = node.cloneNode(false); // keeps namespace (SVG) + all static attrs
  for (const attr of Array.from(node.attributes)) {
    if (!attr.value.includes('{{')) continue;
    if (attr.name.startsWith('on')) { // onClick -> onclick: bind, don't render
      const fn = resolve(attr.value.replace(/[{}]/g, ''), bag, locals);
      clone.removeAttribute(attr.name);
      if (typeof fn === 'function') clone.addEventListener(attr.name.slice(2), fn);
    } else {
      clone.setAttribute(attr.name, interpolate(attr.value, bag, locals, attr.name === 'style'));
    }
  }
  for (const child of Array.from(node.childNodes)) {
    for (const built of build(child, bag, locals)) clone.appendChild(built);
  }
  return [clone];
}
function childrenBuilt(node, bag, locals) {
  const out = [];
  for (const child of Array.from(node.childNodes)) out.push(...build(child, bag, locals));
  return out;
}

// ---- Component (lifted from the prototype + iOS deltas) ------------------
class Component {
  constructor() {
    this.state = {
      screen: 'overview', prevScreen: 'overview', dark: false, cur: 'thb',
      range: '1d', watchFilter: 'all', txnFilter: 'all',
      selected: 'AAPL', starred: {}, notif: true,
      ticket: null, txns: [], toast: '', submitting: false, candles: [], buyPlans: []
    };
  }

  user = null;       // Supabase auth user, set at boot
  candleCache = {};  // 'sym|range' -> bars[], avoids refetch on chip re-toggle

  RATE = 36.4; // USD->THB fallback; replaced live by MarketAPI

  USPARK = "M0,18 C12,16 18,9 28,11 C40,13 46,5 56,4";
  DSPARK = "M0,6 C12,8 18,5 28,10 C40,15 46,13 56,18";

  data = {
    AAPL: { sym:'AAPL', name:'Apple', name2:'Apple Inc.', logo:'AA', exch:'NASDAQ', native:'usd', cat:'foreign', kind:'stock', price:213.40, dayPct:1.35, shares:125, avg:176.20, open:211.20, high:214.85, low:210.90, mcap:'3.27T', vol:'48.2M', pe:'32.6' },
    PTT:  { sym:'PTT', name:'ปตท.', name2:'บมจ. ปตท.', logo:'PT', exch:'SET', native:'thb', cat:'thai', kind:'stock', price:0.906, dayPct:0.46, shares:6000, avg:0.85, open:0.90, high:0.92, low:0.89, mcap:'1.03T฿', vol:'22.1M', pe:'9.8' },
    BTC:  { sym:'BTC', name:'Bitcoin', name2:'Bitcoin', logo:'₿', exch:'Crypto', native:'usd', cat:'crypto', kind:'crypto', price:68131, dayPct:-2.10, shares:0.4, avg:55000, open:69500, high:69900, low:67200, mcap:'1.34T', vol:'฿42B', pe:'—' },
    NVDA: { sym:'NVDA', name:'Nvidia', name2:'Nvidia Corp.', logo:'NV', exch:'NASDAQ', native:'usd', cat:'foreign', kind:'stock', price:123.04, dayPct:3.22, shares:90, avg:98.00, open:119.40, high:124.10, low:118.90, mcap:'3.02T', vol:'310M', pe:'58.1' },
    TSLA: { sym:'TSLA', name:'Tesla', name2:'Tesla Inc.', logo:'TS', exch:'NASDAQ', native:'usd', cat:'foreign', kind:'stock', price:248.50, dayPct:2.10, shares:0, avg:0, open:244.0, high:250.2, low:243.1, mcap:'792B', vol:'98M', pe:'71.4' },
    CPALL:{ sym:'CPALL', name:'ซีพี ออลล์', name2:'ซีพี ออลล์', logo:'CP', exch:'SET', native:'thb', cat:'thai', kind:'stock', price:1.60, dayPct:-0.43, shares:0, avg:0, open:1.61, high:1.62, low:1.59, mcap:'524B฿', vol:'31M', pe:'18.2' },
    KBANK:{ sym:'KBANK', name:'กสิกรไทย', name2:'กสิกรไทย', logo:'KB', exch:'SET', native:'thb', cat:'thai', kind:'stock', price:3.64, dayPct:0.76, shares:0, avg:0, open:3.61, high:3.66, low:3.60, mcap:'344B฿', vol:'14M', pe:'7.1' },
    ETH:  { sym:'ETH', name:'Ethereum', name2:'Ethereum', logo:'Ξ', exch:'Crypto', native:'usd', cat:'crypto', kind:'crypto', price:2261, dayPct:-1.40, shares:0, avg:0, open:2295, high:2310, low:2240, mcap:'272B', vol:'฿18B', pe:'—' },
    // iOS delta: ETF symbols (watchlist-only, patched live via Finnhub /us)
    SPY:  { sym:'SPY', name:'S&P 500 ETF', name2:'SPDR S&P 500 ETF Trust', logo:'SP', exch:'NYSE', native:'usd', cat:'etf', kind:'stock', price:545.0, dayPct:0.62, shares:0, avg:0, open:543.1, high:546.4, low:542.2, mcap:'560B', vol:'62M', pe:'—' },
    QQQ:  { sym:'QQQ', name:'Nasdaq 100 ETF', name2:'Invesco QQQ Trust', logo:'QQ', exch:'NASDAQ', native:'usd', cat:'etf', kind:'stock', price:478.0, dayPct:0.88, shares:0, avg:0, open:475.0, high:479.5, low:474.3, mcap:'300B', vol:'40M', pe:'—' },
    // Phase 3: gold asset class — 1 troy oz XAU (Yahoo GC=F), USD, patched live via proxy /yquote
    XAU:  { sym:'XAU', name:'ทองคำ', name2:'Gold (XAU · 1 oz)', logo:'Au', exch:'COMEX', native:'usd', cat:'gold', kind:'gold', price:4085.0, dayPct:0.0, shares:0, avg:0, open:4085.0, high:4085.0, low:4085.0, mcap:'—', vol:'—', pe:'—' }
  };

  // Universe of watchable symbols (the catalog). Which are *held* is derived from txns.
  watchList = ['XAU', 'TSLA', 'CPALL', 'NVDA', 'KBANK', 'ETH', 'SPY', 'QQQ'];

  // ---- reactive runtime (replaces DCLogic) ----
  setState(p) {
    const patch = typeof p === 'function' ? p(this.state) : p;
    this.state = Object.assign({}, this.state, patch);
    this.render();
  }
  render() {
    const bag = this.renderVals();
    APP.replaceChildren(...build(TPL, bag, null));
  }

  // ---- Supabase data layer (per-user; RLS scopes every row to this.user) ----
  async loadUserData() {
    const [tx, wl, pf, bp] = await Promise.all([
      SB.from('transactions').select('*').order('ts', { ascending: false }),
      SB.from('watchlist').select('sym'),
      SB.from('prefs').select('*').maybeSingle(),
      SB.from('buy_plans').select('*').order('created_at', { ascending: false })  // [] if migration not yet run
    ]);
    const starred = {}; (wl.data || []).forEach(r => { starred[r.sym] = true; });
    const p = pf.data;
    this.setState(Object.assign({ txns: tx.data || [], starred, buyPlans: bp.data || [] },
      p ? { dark: p.dark, cur: p.cur, notif: p.notif } : {}));
  }
  async loadTxns() {
    const { data } = await SB.from('transactions').select('*').order('ts', { ascending: false });
    this.setState({ txns: data || [] });
  }
  async loadPlans() {
    const { data } = await SB.from('buy_plans').select('*').order('created_at', { ascending: false });
    this.setState({ buyPlans: data || [] });
  }
  savePrefs() {
    const { dark, cur, notif } = this.state;
    SB.from('prefs').upsert({ user_id: this.user.id, dark, cur, notif }).then(() => {});
  }
  saveStar(sym, on) {
    if (on) SB.from('watchlist').insert({ user_id: this.user.id, sym }).then(() => {});
    else SB.from('watchlist').delete().eq('sym', sym).then(() => {});
  }

  // Holdings are derived from the transaction log: net qty per symbol, and a
  // buy-weighted average cost. Only positive net positions count as holdings.
  // FIFO pass over the ledger (Phase 2). Matches each sell against the oldest open buy
  // lots → realized gain/loss per sale; the lots left over ARE the current holdings, so
  // their remaining cost is the correct (post-sale) average. Fees: a buy fee raises the
  // lot's per-share cost, a sell fee lowers the per-share proceeds. Dividends ignored here.
  // Returns { holdings: {sym:{qty,avg}}, realizedUsd, sales:[{date,sym,qty,proceeds,cost,gain}] }.
  fifo(txns) {
    const bySym = {};
    for (const tx of txns) {
      if (tx.side === 'dividend') continue;
      (bySym[tx.sym] || (bySym[tx.sym] = [])).push(tx);
    }
    const holdings = {}, sales = [];
    let realizedUsd = 0;
    for (const sym in bySym) {
      const rows = bySym[sym].slice().sort((a, b) => new Date(a.ts) - new Date(b.ts)); // oldest first
      const lots = [];  // FIFO queue: {qty, cost} cost = per-share incl. fee
      for (const tx of rows) {
        const q = Number(tx.qty), pr = Number(tx.price_usd), fee = Number(tx.fee) || 0;
        if (q <= 0) continue;
        if (tx.side === 'buy') { lots.push({ qty: q, cost: pr + fee / q }); continue; }
        // sell: consume oldest lots first
        let remaining = q, qtyConsumed = 0, costConsumed = 0;
        const perShareProceeds = pr - fee / q;
        while (remaining > 1e-9 && lots.length) {
          const lot = lots[0], take = Math.min(remaining, lot.qty);
          costConsumed += take * lot.cost; qtyConsumed += take;
          lot.qty -= take; remaining -= take;
          if (lot.qty <= 1e-9) lots.shift();
        }
        if (qtyConsumed > 0) {
          const proceeds = qtyConsumed * perShareProceeds, gain = proceeds - costConsumed;
          realizedUsd += gain;
          sales.push({ date: tx.ts, sym, qty: qtyConsumed, proceeds, cost: costConsumed, gain });
        }
      }
      const qty = lots.reduce((a, l) => a + l.qty, 0);
      if (qty > 1e-9) holdings[sym] = { qty, avg: lots.reduce((a, l) => a + l.qty * l.cost, 0) / qty };
    }
    return { holdings, realizedUsd, sales };
  }
  deriveHoldings(txns) { return this.fifo(txns).holdings; }   // back-compat shim

  // Safe instrument accessor. A symbol can be held (a txn row) without being in the
  // seed catalog — e.g. discovered via search on another device. Return a zero-price
  // stub so renderVals never dereferences undefined. Real prices arrive when the
  // symbol is registered (search pick) or, for seeded symbols, via the proxy refresh.
  getInst(sym) { return this.data[sym] || this.stubInst(sym); }
  stubInst(sym) {
    return { sym, name: sym, name2: sym, logo: sym.slice(0, 2).toUpperCase(),
      exch: '', native: 'usd', cat: 'foreign', kind: 'stock', price: 0, dayPct: 0,
      shares: 0, avg: 0, open: 0, high: 0, low: 0, mcap: '—', vol: '—', pe: '—' };
  }

  // Map a SymbolUniverse search hit to a catalog instrument and register it so the
  // rest of the app (holdings, detail, ticket) treats it like a seeded symbol.
  // market: US|TH|CRYPTO|COMMODITY -> internal cat/kind/native.
  registerHit(hit) {
    if (this.data[hit.symbol]) return this.data[hit.symbol];
    const m = hit.market;
    const cat = m === 'TH' ? 'thai' : m === 'CRYPTO' ? 'crypto'
      : m === 'COMMODITY' ? 'gold' : (hit.assetType === 'etf' ? 'etf' : 'foreign');
    const kind = cat === 'crypto' ? 'crypto' : cat === 'gold' ? 'gold' : 'stock';
    const inst = Object.assign(this.stubInst(hit.symbol), {
      name: hit.name || hit.symbol, name2: hit.name || hit.symbol,
      exch: hit.exchange || '', native: m === 'TH' ? 'thb' : 'usd', cat, kind, market: m });
    this.data[hit.symbol] = inst;
    return inst;
  }

  // Fetch one live quote for a registered symbol via the quote Edge Function (the one
  // deliberate quota charge — discovering a new symbol). THB markets -> USD-canonical.
  async quoteInst(inst) {
    try {
      const { data: q } = await Fn.call('/quote', { sym: inst.sym, market: inst.market || 'US' });
      const div = q.currency === 'THB' ? this.RATE : 1;
      Object.assign(inst, { price: q.price / div, dayPct: q.dayPct,
        open: (q.open || q.price) / div, high: (q.high || q.price) / div, low: (q.low || q.price) / div });
    } catch (e) { /* leave stub price; user can type it in the form */ }
  }

  // On load, held symbols absent from the seed catalog (discovered in a past session)
  // would render at $0 and zero out the portfolio total. Recover them: pull their
  // market/name from the public symbol_metadata cache, register, and fetch one quote.
  // The quote is FREE — these symbols are already cached, so it's a cache hit (no charge).
  async hydrateHeldSymbols() {
    const held = Object.keys(this.fifo(this.state.txns).holdings);
    const missing = held.filter(s => !this.data[s]);
    if (!missing.length) return;
    const { data: meta } = await SB.from('symbol_metadata')
      .select('symbol,market,name,exchange,asset_type').in('symbol', missing);
    const bySym = {}; (meta || []).forEach(m => { bySym[m.symbol] = m; });
    for (const sym of missing) {
      const m = bySym[sym];
      const inst = this.registerHit(m
        ? { symbol: m.symbol, market: m.market, name: m.name, exchange: m.exchange, assetType: m.asset_type }
        : { symbol: sym, market: 'US' });          // fallback: assume US if metadata missing
      await this.quoteInst(inst);
    }
    this.setState({});                             // re-render with recovered prices
  }

  // ---- transaction ledger (Phase 1): manual add / edit / delete -----------
  // The sheet is plain DOM (#txnsheet) so the 60s live-data re-render can't wipe
  // half-typed inputs. editingId null = add, else edit that row.
  openTxnForm(row) {
    const $ = id => document.getElementById(id);
    this.editingId = row ? row.id : null;
    const sym = row ? row.sym : 'AAPL';
    const inst = this.getInst(sym);
    $('txnsheet-title').textContent = row ? 'แก้ไขรายการ' : 'เพิ่มรายการ';
    $('tf-sym').value = sym;                                  // hidden chosen symbol
    $('tf-search').value = sym + (inst.name && inst.name !== sym ? ' · ' + inst.name : '');
    $('tf-results').style.display = 'none';
    $('tf-type').value = row ? row.side : 'buy';
    $('tf-qty').value = row ? row.qty : '';
    $('tf-price').value = row ? row.price_usd : (this.data[sym] ? this.data[sym].price.toFixed(2) : '');
    $('tf-fee').value = row ? (row.fee || 0) : 0;
    $('tf-date').value = (row ? row.ts : new Date().toISOString()).slice(0, 10);
    $('tf-delete').style.display = row ? 'block' : 'none';
    $('tf-err').style.display = 'none';
    $('txnsheet').style.display = 'flex';
  }
  closeTxnForm() { document.getElementById('txnsheet').style.display = 'none'; }
  wireTxnForm() {
    const $ = id => document.getElementById(id);
    if ($('tf-save')._wired) return; $('tf-save')._wired = true;
    $('tf-save').addEventListener('click', () => this.saveTxn());
    $('tf-delete').addEventListener('click', () => this.deleteTxn());
    $('txnsheet-close').addEventListener('click', () => this.closeTxnForm());
    $('txnsheet-bg').addEventListener('click', () => this.closeTxnForm());
    // Live symbol search (SymbolUniverse `search` fn), debounced.
    const search = $('tf-search');
    search.addEventListener('input', () => {
      clearTimeout(this._searchT);
      const q = search.value.trim();
      // >=2 chars + 350ms: a search MISS charges quota, so don't fire on every keystroke.
      if (q.length < 2) { $('tf-results').style.display = 'none'; return; }
      this._searchT = setTimeout(() => this.runSearch(q), 350);
    });
    document.addEventListener('click', e => {  // dismiss results on outside click
      if (!e.target.closest('#tf-results') && e.target !== search) $('tf-results').style.display = 'none';
    });
  }

  // Query the search Edge Function and render the hit list. A search miss charges
  // quota (search IS the external fetch) → show a friendly quota message on 429.
  async runSearch(q) {
    const box = document.getElementById('tf-results');
    let hits;
    try { hits = (await Fn.call('/search', { q })).data || []; }
    catch (e) {
      const msg = e.message === 'QUOTA_EXCEEDED' ? 'เกินโควต้าค้นหาวันนี้' : 'ค้นหาไม่สำเร็จ';
      box.innerHTML = `<div style="padding:12px 14px;font-size:13px;color:var(--down)">${msg}</div>`;
      box.style.display = 'block'; return;
    }
    if (!hits.length) {
      box.innerHTML = '<div style="padding:12px 14px;font-size:13px;color:var(--sub)">ไม่พบสินทรัพย์</div>';
      box.style.display = 'block'; return;
    }
    box.replaceChildren(...hits.slice(0, 8).map(h => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:11px 14px;cursor:pointer;border-bottom:1px solid var(--line);font-size:14px;color:var(--ink)';
      row.innerHTML = `<b>${h.symbol}</b> <span style="color:var(--sub)">· ${h.market}${h.assetType ? ' · ' + h.assetType : ''}</span>` +
        `<div style="font-size:12px;color:var(--sub);margin-top:1px">${h.name || ''}</div>`;
      row.addEventListener('click', () => this.pickHit(h));
      return row;
    }));
    box.style.display = 'block';
  }

  // Register the picked hit into the catalog + fetch one live quote (the deliberate
  // quota charge). Leaves the form ready to log a transaction for any symbol.
  async pickHit(h) {
    const $ = id => document.getElementById(id);
    const inst = this.registerHit(h);
    $('tf-sym').value = h.symbol;
    $('tf-search').value = h.symbol + (h.name ? ' · ' + h.name : '');
    $('tf-results').style.display = 'none';
    await this.quoteInst(inst);
    if (!this.editingId && inst.price) $('tf-price').value = inst.price.toFixed(2);
  }

  // ponytail: one runnable check for the crash-safety + market-mapping logic.
  // Run in the browser console: `app.demo()` -> throws on regression, else logs OK.
  demo() {
    const stub = this.getInst('___NOPE___');
    console.assert(stub.price === 0 && stub.sym === '___NOPE___', 'getInst stub broken');
    console.assert(this.getInst('AAPL').name === 'Apple', 'getInst real-row broken');
    const reg = this.registerHit({ symbol: 'ADVANC', market: 'TH', name: 'Advanced Info', assetType: 'stock' });
    console.assert(reg.cat === 'thai' && reg.native === 'thb' && reg.market === 'TH', 'TH mapping broken');
    const etf = this.registerHit({ symbol: 'JEPQ', market: 'US', name: 'JPM', assetType: 'etf' });
    console.assert(etf.cat === 'etf' && etf.kind === 'stock', 'ETF mapping broken');
    delete this.data.ADVANC; delete this.data.JEPQ;  // leave catalog as found
    console.log('demo() OK');
  }

  async saveTxn() {
    const $ = id => document.getElementById(id);
    const err = $('tf-err'); const showErr = m => { err.textContent = m; err.style.display = 'block'; };
    const sym = $('tf-sym').value, type = $('tf-type').value;
    const qty = parseFloat($('tf-qty').value), price = parseFloat($('tf-price').value);
    const fee = parseFloat($('tf-fee').value) || 0, date = $('tf-date').value;
    if (!(qty > 0) || !(price >= 0) || !date) return showErr('กรอกจำนวน ราคา และวันที่ให้ถูกต้อง');
    const rowData = { user_id: this.user.id, sym, side: type, qty, price_usd: price, fee, ts: new Date(date).toISOString() };
    const res = this.editingId
      ? await SB.from('transactions').update(rowData).eq('id', this.editingId)
      : await SB.from('transactions').insert(rowData);
    if (res.error) return showErr(res.error.message);
    this.closeTxnForm();
    await this.loadTxns();
    this.showToast(this.editingId ? 'แก้ไขรายการแล้ว' : 'เพิ่มรายการแล้ว');
  }

  async deleteTxn() {
    if (!this.editingId) return;
    await SB.from('transactions').delete().eq('id', this.editingId);
    this.closeTxnForm();
    await this.loadTxns();
    this.showToast('ลบรายการแล้ว');
  }

  // Export the ledger as CSV (client-side blob download).
  exportCSV() {
    const head = ['date', 'sym', 'side', 'qty', 'price_usd', 'fee'];
    const lines = [head.join(',')];
    this.state.txns.forEach(t => lines.push([t.ts, t.sym, t.side, t.qty, t.price_usd, t.fee || 0].join(',')));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'mun-transactions.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // FIFO realized-gains tax report → CSV (one row per matched sale).
  exportTax() {
    const { sales } = this.fifo(this.state.txns);
    const r2 = n => (Math.round(n * 100) / 100);
    const lines = ['date,sym,qty,proceeds_usd,cost_usd,gain_usd'];
    sales.forEach(s => lines.push([s.date, s.sym, r2(s.qty), r2(s.proceeds), r2(s.cost), r2(s.gain)].join(',')));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'mun-tax-fifo.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Buy Planner (Phase 4): DCA / averaging-down calculator ------------
  // Plain-DOM sheet (#plansheet) like #txnsheet. Levels are user-typed price/qty
  // pairs (USD-canonical); avg cost = Σ(price·qty) / Σqty. Saved per user in buy_plans.
  // ponytail: free-text symbol + a live-price hint, NOT the quota-charging search —
  // a planning calculator shouldn't burn the daily search quota. Add search if asked.
  planMath(levels) {
    let qty = 0, cost = 0;
    (levels || []).forEach(l => { const p = Number(l.price) || 0, n = Number(l.qty) || 0; qty += n; cost += p * n; });
    return { totalQty: qty, totalCost: cost, avg: qty ? cost / qty : 0 };
  }

  openPlanForm(plan) {
    const $ = id => document.getElementById(id);
    this.editingPlanId = plan ? plan.id : null;
    $('plansheet-title').textContent = plan ? 'แก้ไขแผน' : 'แผนซื้อเฉลี่ย';
    $('pf-sym').value = plan ? plan.sym : '';
    this.renderLevelRows(plan && plan.levels && plan.levels.length ? plan.levels : [{ price: '', qty: '' }]);
    $('pf-delete').style.display = plan ? 'block' : 'none';
    $('pf-err').style.display = 'none';
    this.planLiveHint();
    this.planRecompute();
    $('plansheet').style.display = 'flex';
  }
  closePlanForm() { document.getElementById('plansheet').style.display = 'none'; }

  // Build the level input rows (price + qty + remove). Max 7.
  renderLevelRows(levels) {
    const box = document.getElementById('pf-levels');
    box.replaceChildren(...levels.slice(0, 7).map(l => this.levelRow(l.price, l.qty)));
    this.planSyncAddBtn();
  }
  levelRow(price, qty) {
    const row = document.createElement('div');
    row.className = 'pf-row';
    row.style.cssText = 'display:flex;gap:10px;align-items:center';
    const inp = 'box-sizing:border-box;width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:11px;background:var(--card2);color:var(--ink);font-size:15px;font-family:inherit';
    row.innerHTML =
      `<input class="pf-price" type="number" step="any" min="0" placeholder="ราคา" value="${price ?? ''}" style="flex:1;${inp}">` +
      `<input class="pf-qty" type="number" step="any" min="0" placeholder="จำนวน" value="${qty ?? ''}" style="flex:1;${inp}">` +
      `<span class="pf-rm" style="cursor:pointer;color:var(--sub);font-size:18px;padding:0 4px;line-height:1">✕</span>`;
    return row;
  }
  planSyncAddBtn() {
    const n = document.querySelectorAll('#pf-levels .pf-row').length;
    document.getElementById('pf-add').style.display = n >= 7 ? 'none' : 'inline';
  }
  readLevels() {
    return Array.from(document.querySelectorAll('#pf-levels .pf-row')).map(r => ({
      price: r.querySelector('.pf-price').value, qty: r.querySelector('.pf-qty').value }));
  }
  planRecompute() {
    const m = this.planMath(this.readLevels());
    const inst = this.getInst((document.getElementById('pf-sym').value || '').trim().toUpperCase());
    const delta = inst.price && m.avg ? (inst.price / m.avg - 1) * 100 : null;
    document.getElementById('pf-summary').innerHTML =
      `<div style="display:flex;justify-content:space-between;margin-bottom:7px"><span style="color:var(--sub)">จำนวนรวม</span><span style="font-weight:600;color:var(--ink)">${this.nf(m.totalQty, m.totalQty % 1 ? 2 : 0)}</span></div>` +
      `<div style="display:flex;justify-content:space-between;margin-bottom:7px"><span style="color:var(--sub)">เงินลงทุนรวม</span><span style="font-weight:600;color:var(--ink)">${this.val(m.totalCost)}</span></div>` +
      `<div style="display:flex;justify-content:space-between"><span style="color:var(--sub)">ต้นทุนเฉลี่ย</span><span style="font-weight:700;color:var(--gold)">${this.price(m.avg)}</span></div>` +
      (delta == null ? '' : `<div style="display:flex;justify-content:space-between;margin-top:7px;padding-top:7px;border-top:1px solid var(--line)"><span style="color:var(--sub)">เทียบราคาล่าสุด ${this.price(inst.price)}</span><span style="font-weight:600;color:${delta <= 0 ? 'var(--up)' : 'var(--down)'}">${(delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1)}%</span></div>`);
  }
  planLiveHint() {
    const sym = (document.getElementById('pf-sym').value || '').trim().toUpperCase();
    const inst = sym ? this.getInst(sym) : null;
    document.getElementById('pf-live').textContent =
      inst && inst.price ? `${inst.name !== sym ? inst.name + ' · ' : ''}ราคาล่าสุด ${this.price(inst.price)}` : '';
  }

  wirePlanForm() {
    const $ = id => document.getElementById(id);
    if ($('pf-save')._wired) return; $('pf-save')._wired = true;
    $('pf-save').addEventListener('click', () => this.savePlan());
    $('pf-delete').addEventListener('click', () => this.deletePlan());
    $('plansheet-close').addEventListener('click', () => this.closePlanForm());
    $('plansheet-bg').addEventListener('click', () => this.closePlanForm());
    $('pf-add').addEventListener('click', () => {
      if (document.querySelectorAll('#pf-levels .pf-row').length >= 7) return;
      $('pf-levels').appendChild(this.levelRow('', '')); this.planSyncAddBtn();
    });
    // Delegated: recompute on any level edit; remove a row on ✕.
    $('pf-levels').addEventListener('input', () => this.planRecompute());
    $('pf-levels').addEventListener('click', e => {
      if (!e.target.classList.contains('pf-rm')) return;
      if (document.querySelectorAll('#pf-levels .pf-row').length <= 1) return;  // keep at least one
      e.target.closest('.pf-row').remove(); this.planSyncAddBtn(); this.planRecompute();
    });
    $('pf-sym').addEventListener('input', () => { this.planLiveHint(); this.planRecompute(); });
  }

  async savePlan() {
    const $ = id => document.getElementById(id);
    const err = $('pf-err'); const showErr = m => { err.textContent = m; err.style.display = 'block'; };
    const sym = ($('pf-sym').value || '').trim().toUpperCase();
    const levels = this.readLevels()
      .map(l => ({ price: Number(l.price) || 0, qty: Number(l.qty) || 0 }))
      .filter(l => l.qty > 0 && l.price >= 0);
    if (!sym) return showErr('กรอกสัญลักษณ์สินทรัพย์');
    if (!levels.length) return showErr('กรอกอย่างน้อยหนึ่งระดับ (ราคาและจำนวน)');
    const rowData = { user_id: this.user.id, sym, levels };
    const res = this.editingPlanId
      ? await SB.from('buy_plans').update(rowData).eq('id', this.editingPlanId)
      : await SB.from('buy_plans').insert(rowData);
    if (res.error) return showErr(res.error.message);
    this.closePlanForm();
    await this.loadPlans();
    this.showToast(this.editingPlanId ? 'แก้ไขแผนแล้ว' : 'บันทึกแผนแล้ว');
  }
  async deletePlan() {
    if (!this.editingPlanId) return;
    await SB.from('buy_plans').delete().eq('id', this.editingPlanId);
    this.closePlanForm();
    await this.loadPlans();
    this.showToast('ลบแผนแล้ว');
  }

  // ---- formatters / math (verbatim from prototype; RATE now live) ----
  nf(n, d) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  price(usd) {
    if (this.state.cur === 'thb') { const v = usd * this.RATE; return '฿' + this.nf(v, v >= 1000 ? 0 : 2); }
    return '$' + this.nf(usd, 2);
  }
  val(usd) {
    if (this.state.cur === 'thb') return '฿' + this.nf(Math.round(usd * this.RATE), 0);
    return '$' + this.nf(usd, usd >= 10000 ? 0 : 2);
  }
  altVal(usd) {
    if (this.state.cur === 'thb') return '≈ $' + this.nf(usd, 2);
    return '≈ ฿' + this.nf(Math.round(usd * this.RATE), 0);
  }
  qtyLabel(s, qty) {
    return s.kind === 'crypto' ? this.nf(qty, 2) + ' ' + s.sym : this.nf(qty, 0) + ' หุ้น';
  }
  pctStr(p) { return (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(2) + '%'; }

  open(sym) {
    this.setState(st => ({ prevScreen: st.screen === 'detail' ? st.prevScreen : st.screen, screen: 'detail', selected: sym }));
    this.loadCandles(sym, this.state.range);
  }

  // Fetch (or reuse cached) OHLC bars for the detail chart; re-render when they land,
  // but only if the user is still on the same symbol+range.
  async loadCandles(sym, range) {
    const key = sym + '|' + range;
    if (this.candleCache[key]) { this.setState({ candles: this.candleCache[key] }); return; }
    this.setState({ candles: [] }); // clear stale candles while loading
    const bars = await MarketAPI.fetchCandles(this, this.getInst(sym), range);
    this.candleCache[key] = bars;
    if (this.state.selected === sym && this.state.range === range) this.setState({ candles: bars });
  }

  renderVals() {
    const S = this.state;
    const themes = {
      light: { page:'#f4f1ea', card:'#fffdf8', card2:'#f6f2e9', ink:'#2a2723', sub:'#8f897e', faint:'#b8b2a6', line:'#e8e2d5', gold:'#a8854a', goldsoft:'#efe6d2', up:'#4f8a6b', down:'#c0664f', ongold:'#fffdf8', csage:'#7d9b6f', cblue:'#6f8aa8', cclay:'#bfa07f' },
      dark:  { page:'#161410', card:'#211d17', card2:'#1b1813', ink:'#f1ece0', sub:'#a39c8d', faint:'#6f6a5e', line:'#322d24', gold:'#cba35f', goldsoft:'#2b2519', up:'#74b08c', down:'#d98a70', ongold:'#161410', csage:'#8aab7c', cblue:'#7d99b8', cclay:'#c9ab88' }
    };
    const t = S.dark ? themes.dark : themes.light;
    const scr = S.screen;

    const rootStyle = {
      '--page': t.page, '--card': t.card, '--card2': t.card2, '--ink': t.ink,
      '--sub': t.sub, '--faint': t.faint, '--line': t.line, '--gold': t.gold,
      '--goldsoft': t.goldsoft, '--up': t.up, '--down': t.down, '--ongold': t.ongold,
      '--c-sage': t.csage, '--c-blue': t.cblue, '--c-clay': t.cclay,
      // Layout lives in CSS (.shell, responsive). Inline = dynamic theme only.
      background: t.page
    };
    document.body.style.background = t.page; // fill the whole window incl. overscroll
    // Mirror theme vars onto :root so DOM outside .shell (#txnsheet) can theme too.
    const rootEl = document.documentElement;
    for (const k in rootStyle) if (k.startsWith('--')) rootEl.style.setProperty(k, rootStyle[k]);

    const ac = (n) => (scr === n ? t.gold : t.faint);
    const c = { overview: ac('overview'), watch: ac('watch'), planner: ac('planner'), dividends: ac('dividends'), transactions: ac('transactions'), account: ac('account') };

    const onSeg = S.cur === 'thb';
    const thbBg = onSeg ? t.gold : 'transparent', thbCol = onSeg ? t.ongold : t.sub;
    const usdBg = !onSeg ? t.gold : 'transparent', usdCol = !onSeg ? t.ongold : t.sub;

    const mkTrack = (on) => ({ width:'46px', height:'28px', borderRadius:'16px', cursor:'pointer', background: on ? t.gold : t.faint, position:'relative', flex:'none', transition:'background .2s ease' });
    const mkKnob = (on) => ({ position:'absolute', top:'3px', left:'3px', width:'22px', height:'22px', borderRadius:'50%', background:'#fff', transform: on ? 'translateX(18px)' : 'translateX(0)', transition:'transform .2s ease', boxShadow:'0 1px 3px rgba(0,0,0,.25)' });

    const rangeDefs = [['1d','1ว'],['1w','1สั'],['1m','1ด'],['3m','3ด'],['1y','1ป'],['all','ทั้งหมด']];
    const ranges = rangeDefs.map(([k, label]) => {
      const on = S.range === k;
      return { label, weight: on ? '600' : '400', bg: on ? t.goldsoft : 'transparent', col: on ? t.gold : t.sub, onClick: () => { this.setState({ range: k }); this.loadCandles(this.state.selected, k); } };
    });

    const F = this.fifo(S.txns);             // FIFO: holdings + realized P/L + sales
    const H = F.holdings;                     // sym -> {qty, avg} (remaining-lot cost)
    const heldSyms = Object.keys(H);

    const holdings = heldSyms.map(sym => {
      const s = this.getInst(sym); const qty = H[sym].qty; const v = qty * s.price;
      return { logo: s.logo, name: s.name, holdSub: s.sym + ' · ' + this.qtyLabel(s, qty), valStr: this.val(v), pct: this.pctStr(s.dayPct), pctColor: s.dayPct >= 0 ? 'var(--up)' : 'var(--down)', onOpen: () => this.open(sym) };
    });

    let totalUsd = 0, dayAbsUsd = 0;   // no cash — total is the sum of holdings
    heldSyms.forEach(sym => { const s = this.getInst(sym); const v = H[sym].qty * s.price; totalUsd += v; dayAbsUsd += v * s.dayPct / 100; });
    const dayPct = totalUsd ? dayAbsUsd / totalUsd * 100 : 0;
    const dayUp = dayAbsUsd >= 0;
    const dayStr = (dayUp ? '▲ ' : '▼ ') + this.val(Math.abs(dayAbsUsd)) + ' · ' + this.pctStr(dayPct);

    const catUsd = { foreign:0, thai:0, crypto:0, etf:0, gold:0 };
    heldSyms.forEach(sym => { const s = this.getInst(sym); catUsd[s.cat] += H[sym].qty * s.price; });
    const allocRaw = [
      { label:'หุ้นต่างประเทศ', color:'var(--gold)', usd: catUsd.foreign + catUsd.etf },
      { label:'หุ้นไทย', color:'var(--c-sage)', usd: catUsd.thai },
      { label:'คริปโต', color:'var(--c-blue)', usd: catUsd.crypto },
      { label:'ทองคำ', color:'var(--c-clay)', usd: catUsd.gold }
    ];
    const alloc = allocRaw.map(a => { const p = totalUsd ? Math.round(a.usd / totalUsd * 100) : 0; return { label: a.label, color: a.color, pct: p, pctLabel: p + '%' }; });

    const sel = this.getInst(S.selected);
    const selQty = H[sel.sym] ? H[sel.sym].qty : 0, selAvg = H[sel.sym] ? H[sel.sym].avg : 0;
    const selVal = selQty * sel.price;
    const gainUsd = (sel.price - selAvg) * selQty; const gainPct = selAvg ? (sel.price / selAvg - 1) * 100 : 0;
    const selRealized = F.sales.filter(s => s.sym === sel.sym).reduce((a, s) => a + s.gain, 0);
    const dDayUp = sel.dayPct >= 0;

    // Candlestick geometry over the 358x148 viewBox. Empty until bars load → svg blank.
    const bars = S.candles || [];
    let candles = [];
    if (bars.length) {
      const W = 358, H = 148, pad = 8;
      const lo = Math.min(...bars.map(b => b.l)), hi = Math.max(...bars.map(b => b.h));
      const span = (hi - lo) || 1;
      const y = v => pad + (H - 2 * pad) * (1 - (v - lo) / span);
      const step = W / bars.length;
      const bw = Math.max(1.5, step * 0.62);
      candles = bars.map((b, i) => {
        const cx = i * step + step / 2;
        const yo = y(b.o), yc = y(b.c);
        return { wx: cx, wy1: y(b.h), wy2: y(b.l), bx: cx - bw / 2, by: Math.min(yo, yc), bw, bh: Math.max(1, Math.abs(yc - yo)), color: b.c >= b.o ? 'var(--up)' : 'var(--down)' };
      });
    }
    const d = {
      sym: sel.sym, name2: sel.name2,
      subline: sel.exch + ' · ' + (sel.native === 'usd' ? 'ดอลลาร์สหรัฐ' : 'บาท'),
      priceStr: this.price(sel.price), priceAlt: this.altVal(sel.price),
      dayStr: (dDayUp ? '▲ ' : '▼ ') + this.pctStr(sel.dayPct), dayBg: dDayUp ? 'color-mix(in oklab,var(--up) 16%,transparent)' : 'color-mix(in oklab,var(--down) 16%,transparent)', dayCol: dDayUp ? 'var(--up)' : 'var(--down)',
      candles,
      open: this.price(sel.open), high: this.price(sel.high), low: this.price(sel.low), mcap: sel.mcap, vol: sel.vol, pe: sel.pe,
      held: selQty > 0, notHeld: selQty <= 0,
      posQty: this.qtyLabel(sel, selQty) + ' · ' + this.val(selVal), posAvg: this.price(selAvg),
      posGain: (gainUsd >= 0 ? '+' : '−') + this.val(Math.abs(gainUsd)) + ' · ' + this.pctStr(gainPct),
      gainCol: gainUsd >= 0 ? 'var(--up)' : 'var(--down)',
      hasRealized: Math.abs(selRealized) > 1e-9,
      realizedStr: (selRealized >= 0 ? '+' : '−') + this.val(Math.abs(selRealized)),
      realizedCol: selRealized >= 0 ? 'var(--up)' : 'var(--down)',
      starFill: S.starred[sel.sym] ? 'var(--gold)' : 'none'
    };

    // iOS delta: 'etf' (กองทุน) filter chip
    const wfDefs = [['all','ทั้งหมด'],['thai','หุ้นไทย'],['foreign','ต่างประเทศ'],['crypto','คริปโต'],['etf','กองทุน'],['gold','ทองคำ']];
    const watchTabs = wfDefs.map(([k, label]) => { const on = S.watchFilter === k; return { label, weight: on ? '600' : '400', bg: on ? t.gold : t.card, col: on ? t.ongold : t.sub, bd: on ? t.gold : t.line, onClick: () => this.setState({ watchFilter: k }) }; });
    const watchRows = this.watchList.filter(sym => S.watchFilter === 'all' || this.data[sym].cat === S.watchFilter).map(sym => {
      const s = this.data[sym]; const up = s.dayPct >= 0;
      return { sym: s.sym, name2: s.name2, priceStr: this.price(s.price), pct: this.pctStr(s.dayPct), pctColor: up ? 'var(--up)' : 'var(--down)', spark: up ? this.USPARK : this.DSPARK, onOpen: () => this.open(sym) };
    });

    // Phase 3: market overview strip — curated live tickers from the catalog (no new fetch).
    const marketStrip = ['XAU', 'BTC', 'SPY', 'PTT'].map(sym => {
      const s = this.data[sym]; const up = s.dayPct >= 0;
      return { sym: s.sym, name: s.name, priceStr: this.price(s.price), pct: this.pctStr(s.dayPct), pctColor: up ? 'var(--up)' : 'var(--down)', onOpen: () => this.open(sym) };
    });
    // Phase 3: news list (from MarketAPI.refresh → S.news; [] until first load / on failure).
    const newsItems = (S.news || []).map(n => ({ headline: n.headline, source: n.source || 'ข่าว', url: n.url }));

    const tfDefs = [['all','ทั้งหมด'],['buy','ซื้อ'],['sell','ขาย'],['dividend','ปันผล']];
    const txnTabs = tfDefs.map(([k, label]) => { const on = S.txnFilter === k; return { label, weight: on ? '600' : '400', bg: on ? t.gold : t.card, col: on ? t.ongold : t.sub, bd: on ? t.gold : t.line, onClick: () => this.setState({ txnFilter: k }) }; });
    const icon = (type) => {
      if (type === 'buy') return { iconBg:'color-mix(in oklab,var(--up) 16%,transparent)', iconStroke:'var(--up)', iconPath:'M12 5v14M5 12l7 7 7-7' };
      if (type === 'sell') return { iconBg:'color-mix(in oklab,var(--down) 16%,transparent)', iconStroke:'var(--down)', iconPath:'M12 19V5M5 12l7-7 7 7' };
      return { iconBg:'var(--goldsoft)', iconStroke:'var(--gold)', iconPath:'M12 7v10M9.5 9.5h5M9.5 14.5h5' };
    };
    // Build the transactions screen from the real (Supabase) transaction log,
    // grouped by Thai date. S.txns is already newest-first from the query.
    const txnByDate = [], txnIdx = {};
    S.txns.filter(tx => S.txnFilter === 'all' || tx.side === S.txnFilter).forEach(tx => {
      const dt = new Date(tx.ts);
      const date = dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
      const time = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const s = this.data[tx.sym] || { kind: 'stock', sym: tx.sym };
      const buy = tx.side === 'buy'; const q = Number(tx.qty), pr = Number(tx.price_usd);
      const div = tx.side === 'dividend';
      const verb = div ? 'ปันผล ' : buy ? 'ซื้อ ' : 'ขาย ';
      const item = Object.assign({
        type: tx.side, title: verb + tx.sym,
        sub: this.qtyLabel(s, q) + ' · ' + this.price(pr),
        amt: (buy ? '−' : '+') + this.val(q * pr), time,
        onEdit: () => this.openTxnForm(tx)
      }, icon(tx.side), { amtCol: div ? 'var(--up)' : 'var(--ink)' });
      if (txnIdx[date] == null) { txnIdx[date] = txnByDate.length; txnByDate.push({ date, items: [] }); }
      txnByDate[txnIdx[date]].items.push(item);
    });
    txnByDate.forEach(g => g.items.forEach((it, i, arr) => { it.bb = i === arr.length - 1 ? 'transparent' : 'var(--line)'; }));
    const txnGroups = txnByDate, txnEmpty = !txnGroups.length;
    const divUsd = S.txns.filter(t => t.side === 'dividend').reduce((a, t) => a + Number(t.qty) * Number(t.price_usd), 0);

    // Phase 4: saved DCA plans list (Planner screen).
    const planList = (S.buyPlans || []).map(p => {
      const levels = p.levels || [];
      const m = this.planMath(levels);
      const inst = this.getInst(p.sym);
      const delta = inst.price && m.avg ? (inst.price / m.avg - 1) * 100 : null;
      return {
        sym: p.sym, name: inst.name && inst.name !== p.sym ? inst.name : '',
        sub: levels.length + ' ระดับ · ' + this.qtyLabel(inst, m.totalQty),
        avgStr: this.price(m.avg), costStr: this.val(m.totalCost),
        hasDelta: delta != null,
        deltaStr: delta == null ? '' : (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1) + '% เทียบราคาล่าสุด',
        deltaCol: delta != null && delta <= 0 ? 'var(--up)' : 'var(--down)',
        onOpen: () => this.openPlanForm(p)
      };
    });
    const planEmpty = !planList.length;

    const tkState = S.ticket; let tk = {}, showTicket = false;
    if (tkState) {
      showTicket = true; const s = this.getInst(tkState.sym); const buy = tkState.mode === 'buy';
      const totalUsd2 = tkState.qty * s.price;
      const label = buy ? 'ยืนยันการซื้อ' : 'ยืนยันการขาย';
      tk = {
        logo: s.logo, title: (buy ? 'ซื้อ ' : 'ขาย ') + s.sym, sub: s.name2,
        priceStr: this.price(s.price), pct: this.pctStr(s.dayPct), pctColor: s.dayPct >= 0 ? 'var(--up)' : 'var(--down)',
        qty: tkState.qty, total: this.val(totalUsd2),
        btnBg: buy ? t.gold : t.down, btnCol: buy ? t.ongold : '#fff',
        btnLabel: S.submitting ? 'ส่งคำสั่ง…' : label // iOS delta: submitting state
      };
    }

    return {
      rootStyle, c,
      isOverview: scr === 'overview', isDetail: scr === 'detail', isWatch: scr === 'watch',
      isPlanner: scr === 'planner',
      isDividends: scr === 'dividends', isTransactions: scr === 'transactions', isAccount: scr === 'account',
      showTabs: scr !== 'detail',
      planList, planEmpty, newPlan: () => this.openPlanForm(null),
      thbBg, thbCol, usdBg, usdCol,
      darkTrack: mkTrack(S.dark), darkKnob: mkKnob(S.dark),
      notifTrack: mkTrack(S.notif), notifKnob: mkKnob(S.notif),
      ranges, holdings, alloc, d, watchTabs, watchRows, txnTabs, txnGroups, txnEmpty,
      marketStrip, newsItems, hasNews: newsItems.length > 0,
      divReceived: this.val(divUsd),
      realizedStr: (F.realizedUsd >= 0 ? '+' : '−') + this.val(Math.abs(F.realizedUsd)),
      realizedCol: F.realizedUsd >= 0 ? 'var(--up)' : 'var(--down)',
      hasRealized: Math.abs(F.realizedUsd) > 1e-9,
      addTxn: () => this.openTxnForm(null),
      exportCSV: () => this.exportCSV(),
      exportTax: () => this.exportTax(),
      userEmail: (this.user && this.user.email) || '',
      userName: (this.user && (this.user.email || '').split('@')[0]) || 'นักลงทุน',
      userInitial: (this.user && (this.user.email || 'M')[0].toUpperCase()) || 'M',
      totalMain: this.val(totalUsd), totalAlt: this.altVal(totalUsd),
      dayStr, dayBg: dayUp ? 'color-mix(in oklab,var(--up) 16%,transparent)' : 'color-mix(in oklab,var(--down) 16%,transparent)', dayCol: dayUp ? 'var(--up)' : 'var(--down)',
      showTicket, tk, showToast: !!S.toast, toastMsg: S.toast,
      goOverview: () => this.setState({ screen: 'overview' }),
      goWatch: () => this.setState({ screen: 'watch' }),
      goPlanner: () => this.setState({ screen: 'planner' }),
      goDividends: () => this.setState({ screen: 'dividends' }),
      goTransactions: () => this.setState({ screen: 'transactions' }),
      goAccount: () => this.setState({ screen: 'account' }),
      back: () => this.setState(st => ({ screen: st.prevScreen || 'overview' })),
      toggleDark: () => { this.setState(st => ({ dark: !st.dark })); this.savePrefs(); },
      toggleNotif: () => { this.setState(st => ({ notif: !st.notif })); this.savePrefs(); },
      setThb: () => { this.setState({ cur: 'thb' }); this.savePrefs(); },
      setUsd: () => { this.setState({ cur: 'usd' }); this.savePrefs(); },
      toggleStar: () => { const sym = S.selected; const on = !S.starred[sym]; this.setState(st => ({ starred: Object.assign({}, st.starred, { [sym]: on }) })); this.saveStar(sym, on); },
      signOut: () => Auth.signOut().then(() => location.reload()),
      openBuy: () => this.setState(st => ({ ticket: { mode: 'buy', sym: st.selected, qty: 1 } })),
      openSell: () => this.setState(st => ({ ticket: { mode: 'sell', sym: st.selected, qty: 1 } })),
      closeTicket: () => this.setState({ ticket: null }),
      ticketInc: () => this.setState(st => ({ ticket: Object.assign({}, st.ticket, { qty: st.ticket.qty + 1 }) })),
      ticketDec: () => this.setState(st => ({ ticket: Object.assign({}, st.ticket, { qty: Math.max(1, st.ticket.qty - 1) }) })),
      confirmTicket: () => this.confirmTicket()
    };
  }

  showToast(msg) {
    this.setState({ toast: msg });
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.setState({ toast: '' }), 2200);
  }

  // Simulated ~400ms MockBroker fill, then record a real transaction in Supabase.
  // Holdings re-derive from the refreshed log; the swap point for a live broker is here.
  confirmTicket() {
    const tk = this.state.ticket;
    if (!tk || this.state.submitting) return;
    this.setState({ submitting: true });
    setTimeout(async () => {
      const s = this.getInst(tk.sym); const buy = tk.mode === 'buy';
      try {
        const { error } = await SB.from('transactions').insert({
          user_id: this.user.id, sym: tk.sym, side: buy ? 'buy' : 'sell',
          qty: tk.qty, price_usd: s.price
        });
        if (error) throw error;
        await this.loadTxns();
        this.setState({ ticket: null, submitting: false, screen: 'transactions' });
        this.showToast((buy ? 'ซื้อ ' : 'ขาย ') + s.sym + ' สำเร็จ');
      } catch (e) {
        this.setState({ ticket: null, submitting: false });
        this.showToast('คำสั่งไม่สำเร็จ');
      }
    }, 400);
  }
}

// ---- bootstrap: auth gate → app ----------------------------------------
let app = null, gateMode = 'login';

let booting = false;
async function boot() {
  if (app || booting) return;      // guard double-fire (onChange + initial call)
  booting = true;
  const session = await Auth.session();
  if (!session) { booting = false; showGate(); return; }
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  app = new Component();
  app.user = session.user;
  app.render();
  app.wireTxnForm();               // bind the (DOM) add/edit transaction sheet
  app.wirePlanForm();              // bind the (DOM) buy-planner sheet
  await app.loadUserData();        // pull txns / watchlist / prefs, then re-render
  await app.hydrateHeldSymbols();  // recover discovered holdings (market+price) so totals aren't $0
  tick(); setInterval(tick, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

function showGate() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('gate').style.display = 'flex';
  wireGate();
}

function wireGate() {
  const $ = id => document.getElementById(id);
  const submit = $('gate-submit');
  if (submit._wired) return; submit._wired = true;   // idempotent
  const email = $('gate-email'), pw = $('gate-pw'), err = $('gate-err');
  const showErr = m => { err.textContent = m; err.style.display = 'block'; };
  const labelFor = () => gateMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';

  submit.addEventListener('click', async () => {
    err.style.display = 'none';
    const e = email.value.trim(), p = pw.value;
    if (!e || !p) return showErr('กรอกอีเมลและรหัสผ่าน');
    submit.disabled = true; submit.textContent = '…';
    const { data, error } = gateMode === 'login' ? await Auth.signIn(e, p) : await Auth.signUp(e, p);
    submit.disabled = false; submit.textContent = labelFor();
    if (error) return showErr(error.message);
    if (gateMode === 'signup' && !data.session) return showErr('สมัครสำเร็จ — ตรวจสอบอีเมลเพื่อยืนยัน แล้วเข้าสู่ระบบ');
    boot();
  });
  $('gate-google').addEventListener('click', () => Auth.signInGoogle());
  $('gate-toggle').addEventListener('click', () => {
    gateMode = gateMode === 'login' ? 'signup' : 'login';
    $('gate-toggle-txt').textContent = gateMode === 'login' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?';
    $('gate-toggle').textContent = gateMode === 'login' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
    $('gate-sub').textContent = gateMode === 'login' ? 'เข้าสู่ระบบเพื่อจัดการพอร์ตของคุณ' : 'สร้างบัญชีใหม่';
    submit.textContent = labelFor();
  });
}

// Live data on load + every 60s + on tab refocus.
async function tick() { try { await MarketAPI.refresh(app); } catch (e) {} }

Auth.onChange(session => { if (session) boot(); });
boot();
