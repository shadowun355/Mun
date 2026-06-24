// ProviderService — owns provider priority and tries them in order until one
// answers. Each provider call is wrapped with: a per-provider circuit breaker
// (fail fast when an upstream is down → fall through instead of timing out every
// request), retry-with-backoff for transient blips, and a latency metric.
//
// This is the ONLY place the provider order is defined.
// Priority: Yahoo (keyless, broad) → Finnhub (US) → Alpha Vantage (last resort).

import { Market, Quote, SymbolMeta } from "../types.ts";
import { AppError, asAppError } from "../errors.ts";
import { Provider } from "../providers/provider.ts";
import { YahooProvider } from "../providers/yahoo.ts";
import { FinnhubProvider } from "../providers/finnhub.ts";
import { AlphaVantageProvider } from "../providers/alphavantage.ts";
import { breakerFor } from "../reliability/circuit-breaker.ts";
import { withRetry } from "../reliability/retry.ts";
import { timed, counter } from "../observability/metrics.ts";
import { log } from "../observability/log.ts";

export class ProviderService {
  // Order = priority. Swap/extend here only.
  private readonly providers: Provider[] = [
    new YahooProvider(),
    new FinnhubProvider(),
    new AlphaVantageProvider(),
  ];

  // Wrap one provider call: circuit breaker → retry → timing. Failures are tagged
  // and counted; the caller decides whether to fall through or surface them.
  private call<T>(provider: string, op: string, fn: () => Promise<T>): Promise<T> {
    return breakerFor(provider).exec(() =>
      timed("provider.latency_ms", { provider, op }, () => withRetry(fn))
    ).catch((e) => {
      counter("provider.failure", { provider, op, code: (e as AppError)?.code ?? "UNKNOWN" });
      throw e;
    });
  }

  // Merge search hits across providers (dedupe by symbol|market; first provider wins).
  async search(query: string): Promise<SymbolMeta[]> {
    const merged = new Map<string, SymbolMeta>();
    let lastErr: unknown;
    for (const p of this.providers) {
      try {
        for (const hit of await this.call(p.name, "search", () => p.search(query))) {
          const k = `${hit.symbol}|${hit.market}`;
          if (!merged.has(k)) merged.set(k, hit);
        }
      } catch (e) {
        lastErr = e; // one provider failing (or its breaker open) is fine; keep going
        log.warn("provider.search_failed", { provider: p.name, error: String(e) });
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
        return await this.call(p.name, "quote", () => p.quote(symbol, market));
      } catch (e) {
        lastErr = e; // fall through to the next provider
        log.warn("provider.quote_failed", { provider: p.name, symbol, market, error: String(e) });
      }
    }
    throw asAppError(lastErr);
  }
}
