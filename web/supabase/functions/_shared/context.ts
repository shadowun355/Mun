// Per-request wiring. Authenticates the caller and constructs the service graph
// with the right client privileges:
//   - CacheService  → service-role client (cache tables are service-write)
//   - RateLimitService → user-JWT client (auth.uid() must charge the caller)
// Keeping this in one place means the Edge Functions stay a few lines each.

import { requireUser, serviceClient, userClient } from "./supabase.ts";
import { CacheService } from "./services/cache.service.ts";
import { RateLimitService } from "./services/ratelimit.service.ts";
import { ProviderService } from "./services/provider.service.ts";
import { SearchService } from "./services/search.service.ts";
import { QuoteService } from "./services/quote.service.ts";

export interface Ctx {
  user: { id: string; email?: string };
  search: SearchService;
  quote: QuoteService;
  rate: RateLimitService;
}

export async function buildContext(req: Request): Promise<Ctx> {
  const auth = req.headers.get("authorization");
  const user = await requireUser(auth);

  const cache = new CacheService(serviceClient());
  const rate = new RateLimitService(userClient(auth));
  const providers = new ProviderService();

  return {
    user,
    rate,
    search: new SearchService(cache, rate, providers),
    quote: new QuoteService(cache, rate, providers),
  };
}
