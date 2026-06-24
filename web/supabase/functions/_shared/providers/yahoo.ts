// Yahoo Finance — the primary provider: keyless, broad coverage, returns OHLC.
// Search covers US/ETF well but MISSES bare Thai tickers, so search() also probes
// `<query>.BK` directly (verified: ADVANC/DELTA/PTT resolve cleanly that way).

import { AppError } from "../errors.ts";
import { fetchJSON } from "../http.ts";
import { Market, Quote, SymbolMeta } from "../types.ts";
import { bareSymbol, classify, Provider, toYahooSymbol } from "./provider.ts";

const UA = { "User-Agent": "Mozilla/5.0" }; // Yahoo 403s the default fetch UA
const SEARCH = "https://query1.finance.yahoo.com/v1/finance/search";
const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

export class YahooProvider implements Provider {
  readonly name = "yahoo";
  supports(_market: Market): boolean { return true; } // covers every market

  async search(query: string): Promise<SymbolMeta[]> {
    const q = query.trim();
    if (!q) return [];
    const hits = new Map<string, SymbolMeta>(); // dedupe by symbol|market

    // 1) General search (US stocks/ETFs/crypto).
    const url = `${SEARCH}?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const j = await fetchJSON(url, { headers: UA }) as { quotes?: YahooQuoteHit[] };
    for (const it of j.quotes ?? []) {
      if (!it.symbol) continue;
      const m = this.toMeta(it.symbol, it.quoteType, it.longname ?? it.shortname, it.exchDisp);
      hits.set(`${m.symbol}|${m.market}`, m);
    }

    // 2) Thai fallback: bare A–Z ticker → probe `<q>.BK` (general search misses these).
    if (/^[A-Za-z][A-Za-z0-9.&-]{0,11}$/.test(q) && !q.includes(".")) {
      try {
        const probe = await this.quoteRaw(`${q.toUpperCase()}.BK`);
        const m = this.toMeta(probe.symbol, "EQUITY", probe.name, probe.exchange);
        hits.set(`${m.symbol}|${m.market}`, m);
      } catch { /* not a Thai symbol — ignore */ }
    }

    return [...hits.values()];
  }

  async quote(symbol: string, market: Market): Promise<Quote> {
    const raw = await this.quoteRaw(toYahooSymbol(symbol, market));
    return {
      symbol, market, provider: this.name,
      price: raw.price, dayPct: raw.dayPct,
      open: raw.open, high: raw.high, low: raw.low,
      currency: raw.currency,
    };
  }

  // ---- internals ----------------------------------------------------------

  private toMeta(yahooSym: string, quoteType: string | undefined, name?: string, exch?: string): SymbolMeta {
    const { market, assetType } = classify(yahooSym, quoteType);
    return {
      symbol: bareSymbol(yahooSym), market, provider: this.name,
      name: name ?? null, exchange: exch ?? null, country: market === "TH" ? "TH" : null,
      assetType, currency: market === "TH" ? "THB" : market === "US" ? "USD" : "USD",
    };
  }

  private async quoteRaw(ysym: string): Promise<RawQuote> {
    const url = `${CHART}/${encodeURIComponent(ysym)}?range=1d&interval=1d`;
    const j = await fetchJSON(url, { headers: UA }) as YahooChart;
    const res = j?.chart?.result?.[0];
    if (!res?.meta?.regularMarketPrice) throw new AppError("SYMBOL_NOT_FOUND", `no quote for ${ysym}`);
    const m = res.meta;
    const prev = m.chartPreviousClose ?? m.previousClose ?? m.regularMarketPrice;
    return {
      symbol: m.symbol ?? ysym,
      price: m.regularMarketPrice,
      dayPct: prev ? ((m.regularMarketPrice - prev) / prev) * 100 : 0,
      open: m.regularMarketOpen ?? null,
      high: m.regularMarketDayHigh ?? null,
      low: m.regularMarketDayLow ?? null,
      currency: m.currency ?? "USD",
      name: m.longName ?? m.shortName ?? null,
      exchange: m.fullExchangeName ?? m.exchangeName ?? null,
    };
  }
}

// ---- Yahoo response shapes (only the fields we read) -----------------------
interface YahooQuoteHit { symbol?: string; shortname?: string; longname?: string; exchDisp?: string; quoteType?: string; }
interface RawQuote { symbol: string; price: number; dayPct: number; open: number | null; high: number | null; low: number | null; currency: string; name: string | null; exchange: string | null; }
interface YahooChart { chart?: { result?: Array<{ meta?: YahooMeta }> }; }
interface YahooMeta {
  symbol?: string; regularMarketPrice: number; chartPreviousClose?: number; previousClose?: number;
  regularMarketOpen?: number; regularMarketDayHigh?: number; regularMarketDayLow?: number;
  currency?: string; longName?: string; shortName?: string; fullExchangeName?: string; exchangeName?: string;
}
