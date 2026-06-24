// Provider abstraction. Adding a data source = implement this interface and
// register it in PROVIDER_PRIORITY. No other layer hardcodes a provider name.

import { AssetType, Market, Quote, SymbolMeta } from "../types.ts";

export interface Provider {
  readonly name: string;
  // Which markets this provider can serve (so the orchestrator skips ones it can't).
  supports(market: Market): boolean;
  // Free-text search → candidate symbols. May return []. Throws AppError on transport failure.
  search(query: string): Promise<SymbolMeta[]>;
  // Live quote for a known symbol+market. Throws SYMBOL_NOT_FOUND / PROVIDER_* on failure.
  quote(symbol: string, market: Market): Promise<Quote>;
}

// ---- shared symbol-mapping helpers (Yahoo-style symbology) -----------------

// Map a (symbol, market) to its Yahoo ticker. Mirrors the legacy client yahooSym().
export function toYahooSymbol(symbol: string, market: Market): string {
  switch (market) {
    case "TH": return `${symbol}.BK`;
    case "CRYPTO": return `${symbol}-USD`;
    case "COMMODITY": return symbol === "XAU" ? "GC=F" : symbol;
    default: return symbol; // US
  }
}

// Infer market + asset type from a Yahoo quoteType + ticker suffix.
export function classify(symbol: string, quoteType?: string): { market: Market; assetType: AssetType } {
  const qt = (quoteType ?? "").toUpperCase();
  if (qt === "CRYPTOCURRENCY") return { market: "CRYPTO", assetType: "crypto" };
  if (symbol.endsWith(".BK")) return { market: "TH", assetType: qt === "ETF" ? "etf" : "stock" };
  if (qt === "ETF") return { market: "US", assetType: "etf" };
  if (qt === "INDEX") return { market: "US", assetType: "index" };
  if (qt === "FUTURE" || symbol.includes("=F")) return { market: "COMMODITY", assetType: "commodity" };
  return { market: "US", assetType: "stock" };
}

// Strip a market suffix back to the bare app-facing symbol (PTT.BK -> PTT, GC=F -> XAU).
export function bareSymbol(yahooSymbol: string): string {
  if (yahooSymbol === "GC=F") return "XAU";
  return yahooSymbol.replace(/\.BK$/, "").replace(/-USD$/, "");
}
