// Per-provider circuit breaker — stops cascading failures. When an upstream is
// down, the breaker OPENS and subsequent calls fail fast (skipped in milliseconds)
// so the orchestrator falls through to the next provider instead of eating a full
// timeout on every request.
//
// State is per Edge-Function INSTANCE (serverless = multiple short-lived instances),
// which is the right granularity: each instance protects its own event loop. There
// is intentionally no shared/global breaker — that would need Redis (a future layer).

import { AppError } from "../errors.ts";

type State = "closed" | "open" | "half_open";

export interface BreakerOpts {
  failureThreshold?: number; // consecutive failures that trip the breaker
  openMs?: number;           // cooldown before a half-open trial
}

export class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private openUntil = 0;
  private readonly threshold: number;
  private readonly openMs: number;

  constructor(readonly name: string, opts: BreakerOpts = {}) {
    this.threshold = opts.failureThreshold ?? 5;
    this.openMs = opts.openMs ?? 30_000;
  }

  get current(): State {
    // Lazily transition open → half_open once the cooldown elapses.
    if (this.state === "open" && Date.now() >= this.openUntil) this.state = "half_open";
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.current === "open") {
      throw new AppError("PROVIDER_UNAVAILABLE", `circuit open: ${this.name}`);
    }
    try {
      const out = await fn();
      this.onSuccess();
      return out;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failures++;
    // A failed half-open trial, or crossing the threshold while closed, opens it.
    if (this.state === "half_open" || this.failures >= this.threshold) {
      this.state = "open";
      this.openUntil = Date.now() + this.openMs;
    }
  }
}

// One breaker per provider name, shared across requests in this instance.
const registry = new Map<string, CircuitBreaker>();
export function breakerFor(name: string): CircuitBreaker {
  let b = registry.get(name);
  if (!b) { b = new CircuitBreaker(name); registry.set(name, b); }
  return b;
}
