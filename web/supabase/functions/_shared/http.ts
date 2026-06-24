// Minimal HTTP helper: a hard timeout on every outbound provider call so one slow
// upstream can't hang a request. Retry/backoff/circuit-breaker are Phase 4 — this
// is just the timeout that any external call needs to be safe at all.

import { AppError } from "./errors.ts";

export async function fetchJSON(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<unknown> {
  const { timeoutMs = 8000, headers } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    if (!r.ok) {
      throw new AppError("PROVIDER_UNAVAILABLE", `upstream ${r.status} for ${url}`);
    }
    return await r.json();
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AppError("PROVIDER_TIMEOUT", `timeout after ${timeoutMs}ms: ${url}`);
    }
    throw new AppError("PROVIDER_UNAVAILABLE", String(e));
  } finally {
    clearTimeout(timer);
  }
}
