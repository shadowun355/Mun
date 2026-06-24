// Structured logging — one JSON object per line to stdout/stderr (Supabase ships
// these to the dashboard / a log drain). Every line carries the trace id + route +
// user, so a request can be reconstructed end-to-end. This is the OpenTelemetry
// seam: to export to OTel later, replace the console sink here — call sites don't change.

import { currentTrace } from "./trace.ts";

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  const t = currentTrace();
  const line = {
    level,
    event,
    ts: new Date().toISOString(),
    trace_id: t?.traceId,
    route: t?.route,
    user_id: t?.userId,
    ...fields,
  };
  const text = JSON.stringify(line);
  if (level === "error" || level === "warn") console.error(text);
  else console.log(text);
}

export const log = {
  debug: (e: string, f?: Record<string, unknown>) => emit("debug", e, f),
  info: (e: string, f?: Record<string, unknown>) => emit("info", e, f),
  warn: (e: string, f?: Record<string, unknown>) => emit("warn", e, f),
  error: (e: string, f?: Record<string, unknown>) => emit("error", e, f),
};
