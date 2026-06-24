// ProviderService — owns provider priority and tries them in order until one
// answers. Knows nothing about cache or quota (those are higher layers). This is
// the ONLY place the provider order is defined.
//
// Priority: Yahoo (keyless, broad) → Finnhub (US) → Alpha Vantage (last resort).

import { Market, Quote, SymbolMeta } from "../types.ts";
import { AppError, asAppError } from "../errors.ts";
import { Provider } from "../providers/provider.ts";
import { YahooProvider } from "../providers/yahoo.ts";
import { FinnhubProvider } from "../providers/finnhub.ts";
import { AlphaVantageProvider } from "../providers/alphavantage.ts";

export class ProviderService {
  // Order = priority. Swap/extend here only.
  private readonly providers: Provider[] = [
    new YahooProvider(),
    new FinnhubProvider(),
    new AlphaVantageProvider(),
  ];

  // Merge search hits across providers (dedupe by symbol|market; first provider wins).
  async search(query: string): Promise<SymbolMeta[]> {
    const merged = new Map<string, SymbolMeta>();
    let lastErr: unknown;
    for (const p of this.providers) {
      try {
        for (const hit of await p.search(query)) {
          const k = `${hit.symbol}|${hit.market}`;
          if (!merged.has(k)) merged.set(k, hit);
        }
      } catch (e) {
        lastErr = e; // one provider failing is fine; keep going
      }
    }
    if (merged.size === 0 && lastErr) throw asAppError(lastErr);
    return [...merged.values()];
  }

  // First provider that supports the market and returns a quote wins.
  async quote(symbol: string, market: Market): Promise<Quote> {
    let lastErr: unknown = new AppError("SYMBOL_NOT_FOUND", `no provider resolved ${symbol}`);
    for (const p of this.providers) {
      if (!p.supports(market)) continue;
      try {
        return await p.quote(symbol, market);
      } catch (e) {
        lastErr = e; // fall through to the next provider
      }
    }
    throw asAppError(lastErr);
  }
}
