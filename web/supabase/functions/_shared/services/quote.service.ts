// QuoteService — single-symbol quote resolution with stale-while-revalidate.
// Fresh cache → return free. Stale/miss → charge quota (free tier) → provider →
// write-through. Provider failure with a stale row present → serve stale
// (graceful degradation) rather than erroring.
//
// NOTE: this does a synchronous refresh on stale. True async background refresh
// (return stale immediately, revalidate after responding) is wired at the Edge
// Function boundary in Phase 3 using the same primitives.

import { Market, Quote } from "../types.ts";
import { AppError, asAppError } from "../errors.ts";
import { CacheService } from "./cache.service.ts";
import { RateLimitService } from "./ratelimit.service.ts";
import { ProviderService } from "./provider.service.ts";

export interface QuoteResult { quote: Quote; cached: boolean; stale: boolean; }

export class QuoteService {
  constructor(
    private readonly cache: CacheService,
    private readonly rate: RateLimitService,
    private readonly providers: ProviderService,
  ) {}

  async resolve(
    symbol: string,
    market: Market,
    opts: { premium: boolean; idempotencyKey: string | null },
  ): Promise<QuoteResult> {
    const cached = await this.cache.getQuote(symbol, market);
    if (cached?.fresh) return { quote: cached.value, cached: true, stale: false };

    // Stale or missing → external refresh. Charge quota for free users first.
    if (!opts.premium) {
      const quota = await this.rate.consume(opts.idempotencyKey);
      if (quota.replayed) return quota.response as QuoteResult;
    }

    try {
      const fresh = await this.providers.quote(symbol, market);
      await this.cache.putQuote(fresh);
      return { quote: fresh, cached: false, stale: false };
    } catch (e) {
      // Graceful degradation: a stale cached quote beats a hard failure.
      if (cached) return { quote: cached.value, cached: true, stale: true };
      throw e instanceof AppError ? e : asAppError(e);
    }
  }
}
