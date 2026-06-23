'use strict';
// Port of Mun/MarketAPI.swift. Each source fails independently back to seed —
// nothing throws to the UI. Only numeric fields (price/dayPct/OHLC) are patched;
// static fields + holdings keep their seed. Model stays USD-canonical: Thai THB
// prices are divided by the live FX rate.
//
// Direct from browser (keyless, CORS-open): CoinGecko, Frankfurter.
// Via proxy (key hidden / Yahoo blocks browsers): Finnhub /us, Thai /quote.
const MarketAPI = {
  proxyBase: 'https://mun-re6q.onrender.com',
  cryptoIds: { BTC: 'bitcoin', ETH: 'ethereum' },
  usSyms: ['AAPL', 'NVDA', 'TSLA', 'SPY', 'QQQ'],
  thaiSyms: ['PTT', 'CPALL', 'KBANK'],

  async getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  },

  patch(app, sym, f) {
    const s = app.data[sym]; if (!s) return;
    if (f.price != null) s.price = f.price;
    if (f.dayPct != null) s.dayPct = f.dayPct;
    if (f.open != null) s.open = f.open;
    if (f.high != null) s.high = f.high;
    if (f.low != null) s.low = f.low;
  },

  async fx(app) {
    const j = await this.getJSON('https://api.frankfurter.dev/v1/latest?base=USD&symbols=THB');
    if (j.rates && j.rates.THB) app.RATE = j.rates.THB;
  },

  async crypto(app) {
    const ids = Object.values(this.cryptoIds).join(',');
    const j = await this.getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
    for (const [sym, id] of Object.entries(this.cryptoIds)) {
      const q = j[id]; if (!q) continue;
      this.patch(app, sym, { price: q.usd, dayPct: q.usd_24h_change });
    }
  },

  async us(app) {
    await Promise.allSettled(this.usSyms.map(async sym => {
      const j = await this.getJSON(`${this.proxyBase}/us?sym=${sym}`);
      this.patch(app, sym, j); // already USD, same field names
    }));
  },

  async thai(app) {
    const rate = app.RATE;
    await Promise.allSettled(this.thaiSyms.map(async sym => {
      const j = await this.getJSON(`${this.proxyBase}/quote?sym=${sym}`); // THB
      this.patch(app, sym, { price: j.price / rate, dayPct: j.dayPct, open: j.open / rate, high: j.high / rate, low: j.low / rate });
    }));
  },

  // Map an instrument to its Yahoo symbol: Thai -> .BK, crypto -> -USD, else plain.
  yahooSym(s) {
    if (s.cat === 'thai') return s.sym + '.BK';
    if (s.kind === 'crypto') return s.sym + '-USD';
    return s.sym;
  },

  // OHLC bars for the detail candlestick chart. USD-canonical: THB bars / FX rate.
  // Returns [] on any failure — the UI keeps whatever it had, never throws.
  async fetchCandles(app, s, range) {
    try {
      const j = await this.getJSON(`${this.proxyBase}/candles?sym=${this.yahooSym(s)}&range=${range}`);
      const div = j.ccy === 'THB' ? app.RATE : 1;
      return j.bars.map(b => ({ o: b.o / div, h: b.h / div, l: b.l / div, c: b.c / div }));
    } catch (e) { return []; }
  },

  async refresh(app) {
    // FX first: USD display + Thai normalization depend on a fresh rate.
    try { await this.fx(app); } catch (e) {}
    await Promise.allSettled([this.crypto(app), this.us(app), this.thai(app)]);
    app.setState({}); // re-render with patched numbers
  }
};
