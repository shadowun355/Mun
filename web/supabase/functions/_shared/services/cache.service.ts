// CacheService — the two-table read/write-through cache. The ONLY layer that
// touches symbol_metadata / symbol_quote. Reads return {value, fresh} so callers
// can implement stale-while-revalidate. Writes are PK upserts → idempotent, no dupes.
//
// TTLs: metadata is static (long); quote is volatile (short, by market).

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Market, Quote, SymbolMeta } from "../types.ts";

const META_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
const QUOTE_TTL_MS: Record<Market, number> = {
  US: 60_000, TH: 5 * 60_000, CRYPTO: 30_000, COMMODITY: 5 * 60_000,
};

export interface Cached<T> { value: T; fresh: boolean; }

export class CacheService {
  // Uses the service-role client: cache tables are public-read but service-write.
  constructor(private readonly db: SupabaseClient) {}

  // ---- metadata (long TTL) ------------------------------------------------

  async getMetadata(symbol: string, market: Market): Promise<Cached<SymbolMeta> | null> {
    const { data } = await this.db.from("symbol_metadata")
      .select("*").eq("symbol", symbol).eq("market", market).maybeSingle();
    if (!data) return null;
    return { value: rowToMeta(data), fresh: new Date(data.expires_at).getTime() > Date.now() };
  }

  // Trigram search over cached metadata (symbol + name). Cache-first search path.
  async searchMetadata(query: string, limit = 10): Promise<SymbolMeta[]> {
    // PostgREST .or() uses `*` as the ilike wildcard (not SQL `%`). Escape any
    // user-supplied `*`/`,` so they can't alter the filter expression.
    const safe = query.replace(/[*,()]/g, " ").trim();
    const q = `*${safe}*`;
    const { data } = await this.db.from("symbol_metadata")
      .select("*").eq("is_active", true)
      .or(`symbol.ilike.${q},name.ilike.${q}`)
      .limit(limit);
    return (data ?? []).map(rowToMeta);
  }

  async putMetadata(m: SymbolMeta): Promise<void> {
    await this.db.from("symbol_metadata").upsert({
      symbol: m.symbol, market: m.market, provider: m.provider,
      name: m.name, exchange: m.exchange, country: m.country,
      asset_type: m.assetType, currency: m.currency,
      sector: m.sector ?? null, industry: m.industry ?? null,
      data: m.data ?? {}, is_active: true,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + META_TTL_MS).toISOString(),
    }, { onConflict: "symbol,market" });
  }

  // ---- quote (short TTL) --------------------------------------------------

  async getQuote(symbol: string, market: Market): Promise<Cached<Quote> | null> {
    // Freshest row across providers for this symbol.
    const { data } = await this.db.from("symbol_quote")
      .select("*").eq("symbol", symbol).eq("market", market)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) return null;
    return { value: rowToQuote(data), fresh: new Date(data.expires_at).getTime() > Date.now() };
  }

  async putQuote(q: Quote): Promise<void> {
    await this.db.from("symbol_quote").upsert({
      symbol: q.symbol, market: q.market, provider: q.provider,
      price: q.price, day_pct: q.dayPct, open: q.open ?? null, high: q.high ?? null,
      low: q.low ?? null, volume: q.volume ?? null, market_cap: q.marketCap ?? null,
      currency: q.currency, data: q.data ?? {},
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (QUOTE_TTL_MS[q.market] ?? 60_000)).toISOString(),
    }, { onConflict: "symbol,market,provider" });
  }
}

// deno-lint-ignore no-explicit-any
function rowToMeta(r: any): SymbolMeta {
  return {
    symbol: r.symbol, market: r.market, provider: r.provider, name: r.name,
    exchange: r.exchange, country: r.country, assetType: r.asset_type,
    currency: r.currency, sector: r.sector, industry: r.industry, data: r.data,
  };
}
// deno-lint-ignore no-explicit-any
function rowToQuote(r: any): Quote {
  return {
    symbol: r.symbol, market: r.market, provider: r.provider, price: Number(r.price),
    dayPct: Number(r.day_pct), open: r.open, high: r.high, low: r.low,
    volume: r.volume, marketCap: r.market_cap, currency: r.currency, data: r.data,
  };
}
