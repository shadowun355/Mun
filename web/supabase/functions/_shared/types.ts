// Domain types shared across the SymbolUniverse service layer.
// Kept intentionally small — these are the contracts every layer speaks in.

export type Market = "US" | "TH" | "CRYPTO" | "COMMODITY";
export type AssetType = "stock" | "etf" | "crypto" | "commodity" | "index";

// A search hit / static metadata about a symbol (long-TTL cache: symbol_metadata).
export interface SymbolMeta {
  symbol: string;
  market: Market;
  provider: string;
  name: string | null;
  exchange: string | null;
  country: string | null;
  assetType: AssetType | null;
  currency: string | null;
  sector?: string | null;
  industry?: string | null;
  data?: Record<string, unknown>;
}

// A live quote (short-TTL cache: symbol_quote).
export interface Quote {
  symbol: string;
  market: Market;
  provider: string;
  price: number;
  dayPct: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  marketCap?: number | null;
  currency: string;
  data?: Record<string, unknown>;
}

// Consistent envelope every Edge Function returns (see errors.ts for the failure side).
export interface Ok<T> {
  success: true;
  data: T;
  meta?: { cached?: boolean; stale?: boolean; provider?: string };
}
