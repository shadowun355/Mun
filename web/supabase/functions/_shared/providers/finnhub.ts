// Finnhub — secondary provider for US stocks/ETFs. Key-gated; if FINNHUB_KEY is
// unset the provider reports it supports nothing, so the orchestrator skips it.

import { AppError } from "../errors.ts";
import { ENV } from "../env.ts";
import { fetchJSON } from "../http.ts";
import { Market, Quote, SymbolMeta } from "../types.ts";
import { classify, Provider } from "./provider.ts";

const BASE = "https://finnhub.io/api/v1";

export class FinnhubProvider implements Provider {
  readonly name = "finnhub";
  supports(market: Market): boolean {
    return !!ENV.FINNHUB_KEY && (market === "US"); // free tier: US coverage only
  }

  async search(query: string): Promise<SymbolMeta[]> {
    if (!ENV.FINNHUB_KEY) return [];
    const url = `${BASE}/search?q=${encodeURIComponent(query)}&token=${ENV.FINNHUB_KEY}`;
    const j = await fetchJSON(url) as { result?: FinnhubHit[] };
    return (j.result ?? [])
      .filter((r) => r.symbol && !r.symbol.includes(".")) // skip foreign-listed dupes
      .slice(0, 10)
      .map((r) => {
        const { market, assetType } = classify(r.symbol, r.type);
        return {
          symbol: r.symbol, market, provider: this.name,
          name: r.description ?? null, exchange: null, country: "US",
          assetType, currency: "USD",
        } as SymbolMeta;
      });
  }

  async quote(symbol: string, market: Market): Promise<Quote> {
    if (!ENV.FINNHUB_KEY) throw new AppError("PROVIDER_UNAVAILABLE", "FINNHUB_KEY unset");
    if (market !== "US") throw new AppError("PROVIDER_UNAVAILABLE", "finnhub: US only");
    const url = `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${ENV.FINNHUB_KEY}`;
    const j = await fetchJSON(url) as FinnhubQuote;
    if (!j.c) throw new AppError("SYMBOL_NOT_FOUND", `finnhub: no quote for ${symbol}`);
    return {
      symbol, market, provider: this.name,
      price: j.c, dayPct: j.dp ?? 0, open: j.o ?? null, high: j.h ?? null, low: j.l ?? null,
      currency: "USD",
    };
  }
}

interface FinnhubHit { symbol: string; description?: string; type?: string; }
interface FinnhubQuote { c: number; d?: number; dp?: number; o?: number; h?: number; l?: number; pc?: number; }
