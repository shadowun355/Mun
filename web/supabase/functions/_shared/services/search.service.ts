// SearchService — the search orchestrator. Locked flow: cache-first; only a cache
// MISS hits an external provider, and only a miss charges quota. Cache hits are
// always free and unlimited. The atomic quota RPC (RateLimitService) is the single
// source of truth for per-tier limits, so there is no per-plan branching here.
//
// Edge Fn → SearchService → (CacheService | RateLimitService | ProviderService)

import { SymbolMeta } from "../types.ts";
import { CacheService } from "./cache.service.ts";
import { RateLimitService } from "./ratelimit.service.ts";
import { ProviderService } from "./provider.service.ts";

export interface SearchResult { hits: SymbolMeta[]; cached: boolean; }

export class SearchService {
  constructor(
    private readonly cache: CacheService,
    private readonly rate: RateLimitService,
    private readonly providers: ProviderService,
  ) {}

  async search(
    query: string,
    opts: { idempotencyKey: string | null },
  ): Promise<SearchResult> {
    const q = query.trim();
    if (q.length < 1) return { hits: [], cached: true };

    // 1) Cache-first — previously-seen symbols, free + unlimited.
    const cached = await this.cache.searchMetadata(q);
    if (cached.length > 0) return { hits: cached, cached: true };

    // 2) Cache miss → external. Charge quota (RPC allows unlimited tiers, denies
    //    over-limit with QUOTA_EXCEEDED, replays a completed idempotent request).
    const quota = await this.rate.consume(opts.idempotencyKey);
    if (quota.replayed) return quota.response as SearchResult;

    const hits = await this.providers.search(q);

    // 3) Write-through (idempotent upserts) so the next identical search is a cache hit.
    await Promise.all(hits.map((h) => this.cache.putMetadata(h)));

    return { hits, cached: false };
  }
}
