// Alpha Vantage — last-resort fallback. Free tier is ~25 req/day, so it sits at
// the bottom of PROVIDER_PRIORITY and only runs if Yahoo and Finnhub both fail.
// Implements the same interface; no special-casing elsewhere.

import { AppError } from "../errors.ts";
import { ENV } from "../env.ts";
import { fetchJSON } from "../http.ts";
import { Market, Quote, SymbolMeta } from "../types.ts";
import { classify, Provider } from "./provider.ts";

const BASE = "https://www.alphavantage.co/query";

export class AlphaVantageProvider implements Provider {
  readonly name = "alphavantage";
  supports(market: Market): boolean {
    return !!ENV.ALPHAVANTAGE_KEY && market === "US";
  }

  async search(query: string): Promise<SymbolMeta[]> {
    if (!ENV.ALPHAVANTAGE_KEY) return [];
    const url = `${BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${ENV.ALPHAVANTAGE_KEY}`;
    const j = await fetchJSON(url) as { bestMatches?: AvMatch[] };
    return (j.bestMatches ?? []).slice(0, 10).map((m) => {
      const symbol = m["1. symbol"];
      const { market, assetType } = classify(symbol, m["3. type"]);
      return {
        symbol, market, provider: this.name,
        name: m["2. name"] ?? null, exchange: m["4. region"] ?? null,
        country: "US", assetType, currency: m["8. currency"] ?? "USD",
      } as SymbolMeta;
    });
  }

  async quote(symbol: string, market: Market): Promise<Quote> {
    if (!ENV.ALPHAVANTAGE_KEY) throw new AppError("PROVIDER_UNAVAILABLE", "ALPHAVANTAGE_KEY unset");
    const url = `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ENV.ALPHAVANTAGE_KEY}`;
    const j = await fetchJSON(url) as { "Global Quote"?: AvQuote };
    const g = j["Global Quote"];
    if (!g || !g["05. price"]) throw new AppError("SYMBOL_NOT_FOUND", `alphavantage: no quote for ${symbol}`);
    return {
      symbol, market, provider: this.name,
      price: Number(g["05. price"]),
      dayPct: Number((g["10. change percent"] ?? "0").replace("%", "")),
      open: Number(g["02. open"]) || null,
      high: Number(g["03. high"]) || null,
      low: Number(g["04. low"]) || null,
      currency: "USD",
    };
  }
}

interface AvMatch { "1. symbol": string; "2. name"?: string; "3. type"?: string; "4. region"?: string; "8. currency"?: string; }
interface AvQuote { "02. open"?: string; "03. high"?: string; "04. low"?: string; "05. price"?: string; "10. change percent"?: string; }
