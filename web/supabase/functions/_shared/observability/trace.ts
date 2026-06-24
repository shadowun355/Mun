// Request-scoped trace context via AsyncLocalStorage, so logs/metrics can attach a
// trace id, route, and user id WITHOUT threading a logger through every function
// signature. Set once at the Edge boundary; read anywhere downstream.

import { AsyncLocalStorage } from "node:async_hooks";

export interface TraceCtx {
  traceId: string;
  route: string;
  userId?: string;
}

const als = new AsyncLocalStorage<TraceCtx>();

export function runWithTrace<T>(ctx: TraceCtx, fn: () => Promise<T>): Promise<T> {
  return als.run(ctx, fn);
}

export function currentTrace(): TraceCtx | undefined {
  return als.getStore();
}

export function setUser(userId: string): void {
  const t = als.getStore();
  if (t) t.userId = userId;
}

export function newTraceId(): string {
  return crypto.randomUUID();
}
