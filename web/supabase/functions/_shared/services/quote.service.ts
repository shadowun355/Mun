// QuoteService — single-symbol quote resolution with stale-while-revalidate.
//
//   fresh cache  → return free.
//   stale cache  → return stale free + hand back a `revalidate()` thunk; the Edge
//                  Function runs it AFTER responding (EdgeRuntime.waitUntil), so the
//                  user gets an instant answer and the cache self-heals. Background
//                  refresh does NOT charge quota — the symbol is already cached, and
//                  "accessing cached symbols is unlimited".
//   miss         → charge quota (atomic RPC) → provider → write-through → return.
//
// Only a true MISS (never-seen symbol) costs an external fetch against quota.

import { Market, Quote } from "../types.ts";
import { CacheService } from "./cache.service.ts";
import { RateLimitService } from "./ratelimit.service.ts";
import { ProviderService } from "./provider.service.ts";

export interface QuoteResult {
  quote: Quote;
  cached: boolean;
  stale: boolean;
  revalidate?: () => Promise<void>; // present only when serving stale
}

export class QuoteService {
  constructor(
    private readonly cache: CacheService,
    private readonly rate: RateLimitService,
    private readonly providers: ProviderService,
  ) {}

  async resolve(
    symbol: string,
    market: Market,
    opts: { idempotencyKey: string | null },
  ): Promise<QuoteResult> {
    const cached = await this.cache.getQuote(symbol, market);

    if (cached?.fresh) return { quote: cached.value, cached: true, stale: false };

    if (cached && !cached.fresh) {
      // Stale-while-revalidate: serve now, refresh in the background, no charge.
      return {
        quote: cached.value, cached: true, stale: true,
        revalidate: () => this.refresh(symbol, market),
      };
    }

    // True miss → charge quota, fetch synchronously.
    const quota = await this.rate.consume(opts.idempotencyKey);
    if (quota.replayed) return quota.response as QuoteResult;

    const fresh = await this.providers.quote(symbol, market);
    await this.cache.putQuote(fresh);
    return { quote: fresh, cached: false, stale: false };
  }

  // Best-effort background refresh; never throws (the user already got a response).
  private async refresh(symbol: string, market: Market): Promise<void> {
    try {
      const fresh = await this.providers.quote(symbol, market);
      await this.cache.putQuote(fresh);
    } catch (_e) {
      // swallow — stale data stays until the next attempt
    }
  }
}
