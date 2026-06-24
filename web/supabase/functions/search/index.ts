// Edge Function: GET|POST /search?q=<query>
// Flow: auth → cache-first search → (miss) atomic quota → providers → write-through.
// Thin by design; all logic is in SearchService.
//
// Headers: Authorization: Bearer <jwt>  (required)
//          Idempotency-Key: <uuid>      (optional; makes retries safe)

import { buildContext } from "../_shared/context.ts";
import { handle, json, param } from "../_shared/respond.ts";
import { AppError } from "../_shared/errors.ts";
import { counter } from "../_shared/observability/metrics.ts";

Deno.serve(handle(async (req) => {
  const q = (await param(req, "q"))?.trim() ?? "";
  if (q.length < 1) throw new AppError("INVALID_REQUEST", "query `q` is required");

  const key = req.headers.get("idempotency-key");
  const ctx = await buildContext(req);

  const result = await ctx.search.search(q, { idempotencyKey: key });
  counter(result.cached ? "cache.hit" : "cache.miss", { fn: "search" });

  // Idempotency: store the result so a retry with the same key replays it.
  if (key) await ctx.rate.finalize(key, result);

  return json({ success: true, data: result.hits, meta: { cached: result.cached } });
}));
