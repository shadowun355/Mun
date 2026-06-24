// Edge Function: GET|POST /quote?sym=<symbol>&market=<US|TH|CRYPTO|COMMODITY>
// Flow: auth → fresh cache returns instantly → stale cache returns instantly and
// revalidates in the BACKGROUND (EdgeRuntime.waitUntil) → miss charges atomic
// quota, fetches synchronously, writes through.
//
// Headers: Authorization: Bearer <jwt> (required), Idempotency-Key (optional).

import { buildContext } from "../_shared/context.ts";
import { handle, json, param } from "../_shared/respond.ts";
import { AppError } from "../_shared/errors.ts";
import { Market } from "../_shared/types.ts";

const MARKETS: Market[] = ["US", "TH", "CRYPTO", "COMMODITY"];

// Supabase Edge runtime exposes EdgeRuntime.waitUntil for post-response work.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(handle(async (req) => {
  const sym = (await param(req, "sym"))?.trim().toUpperCase() ?? "";
  const market = ((await param(req, "market"))?.trim().toUpperCase() ?? "US") as Market;
  if (!sym) throw new AppError("INVALID_REQUEST", "param `sym` is required");
  if (!MARKETS.includes(market)) throw new AppError("INVALID_REQUEST", `bad market: ${market}`);

  const key = req.headers.get("idempotency-key");
  const ctx = await buildContext(req);

  const result = await ctx.quote.resolve(sym, market, { idempotencyKey: key });

  // Stale-while-revalidate: respond now, refresh the cache after the response.
  if (result.revalidate) {
    const job = result.revalidate();
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime) EdgeRuntime.waitUntil(job);
    else void job; // local dev fallback: fire-and-forget
  }

  // Idempotency: store a serializable snapshot (drop the revalidate fn) for replay.
  if (key) await ctx.rate.finalize(key, { quote: result.quote, cached: result.cached, stale: result.stale });

  return json({
    success: true,
    data: result.quote,
    meta: { cached: result.cached, stale: result.stale, provider: result.quote.provider },
  });
}));
