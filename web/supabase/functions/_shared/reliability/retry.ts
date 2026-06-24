// Retry with exponential backoff + full jitter. Only TRANSIENT failures retry
// (provider timeout / upstream unavailable). A 4xx-class AppError — bad symbol,
// quota exceeded, invalid request, auth — fails immediately; retrying it is wasted
// latency and, for quota, would be wrong.

import { AppError } from "../errors.ts";

const TRANSIENT = new Set(["PROVIDER_TIMEOUT", "PROVIDER_UNAVAILABLE"]);

function isTransient(e: unknown): boolean {
  return e instanceof AppError && TRANSIENT.has(e.code);
}

export interface RetryOpts { retries?: number; baseMs?: number; maxMs?: number; }

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const { retries = 2, baseMs = 150, maxMs = 2000 } = opts;
  let attempt = 0;
  // 1 initial try + `retries` retries.
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (!isTransient(e) || attempt >= retries) throw e;
      const exp = Math.min(maxMs, baseMs * 2 ** attempt);
      const jitter = Math.random() * exp; // full jitter — avoids retry stampedes
      await new Promise((r) => setTimeout(r, jitter));
      attempt++;
    }
  }
}
