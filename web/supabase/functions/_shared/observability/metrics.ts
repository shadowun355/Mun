// Metrics as structured log events (`metric` lines), so they can be parsed out of
// the log stream into any backend without app changes. Same OTel seam as log.ts:
// swap emit() for an OTel meter later; the counter/gauge/timing call sites stay.
//
// Catalogue (see RELIABILITY.md): provider.latency_ms, provider.failure,
// cache.hit / cache.miss, quota.consume, request.duration_ms.

import { currentTrace } from "./trace.ts";

type Kind = "counter" | "gauge" | "timing";

function metric(kind: Kind, name: string, value: number, tags?: Record<string, string>) {
  const t = currentTrace();
  console.log(JSON.stringify({
    event: "metric", kind, name, value,
    ts: new Date().toISOString(),
    trace_id: t?.traceId, route: t?.route,
    ...tags,
  }));
}

export const counter = (name: string, tags?: Record<string, string>) => metric("counter", name, 1, tags);
export const gauge = (name: string, value: number, tags?: Record<string, string>) => metric("gauge", name, value, tags);
export const timing = (name: string, ms: number, tags?: Record<string, string>) => metric("timing", name, ms, tags);

// Convenience: time an async op and emit a timing metric (+ failure counter on throw).
export async function timed<T>(name: string, tags: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const out = await fn();
    timing(name, performance.now() - start, { ...tags, outcome: "ok" });
    return out;
  } catch (e) {
    timing(name, performance.now() - start, { ...tags, outcome: "error" });
    throw e;
  }
}
