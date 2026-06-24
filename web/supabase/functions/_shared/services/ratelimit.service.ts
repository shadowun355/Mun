// RateLimitService — thin wrapper over the Phase 1 quota RPCs. All concurrency /
// atomicity / idempotency correctness lives in Postgres (consume_external_quota);
// this layer just calls it on the USER client so auth.uid() charges the caller.
//
// Contract: call consume() BEFORE every external provider fetch. Cache hits must
// NOT call this — only real external calls count against quota.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AppError } from "../errors.ts";

export interface QuotaResult {
  allowed: boolean;
  replayed?: boolean;     // a completed idempotent request — replay its stored response
  response?: unknown;     // present when replayed
  count?: number;
  limit?: number;
  unlimited?: boolean;
}

export class RateLimitService {
  constructor(private readonly userDb: SupabaseClient) {}

  // Atomically charge one external fetch. Throws QUOTA_EXCEEDED / REQUEST_IN_PROGRESS
  // (mapped from the RPC's error_code) so the Edge Function returns a consistent body.
  async consume(idempotencyKey: string | null): Promise<QuotaResult> {
    const { data, error } = await this.userDb.rpc("consume_external_quota", {
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw new AppError("INTERNAL", `quota rpc failed: ${error.message}`);
    const r = data as Record<string, unknown>;
    if (r.allowed) return r as unknown as QuotaResult;

    const code = String(r.error_code ?? "QUOTA_EXCEEDED");
    if (code === "REQUEST_IN_PROGRESS") {
      throw new AppError("REQUEST_IN_PROGRESS", String(r.message ?? "in progress"));
    }
    if (code === "UNAUTHENTICATED") {
      throw new AppError("UNAUTHENTICATED", "Not signed in");
    }
    throw new AppError("QUOTA_EXCEEDED", String(r.message ?? "Daily limit reached."),
      { limit: r.limit });
  }

  // Persist the final response so a retry with the same key replays it.
  async finalize(idempotencyKey: string, response: unknown): Promise<void> {
    await this.userDb.rpc("finalize_request", { p_key: idempotencyKey, p_response: response });
  }
}
