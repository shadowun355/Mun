// The Edge Function boundary: CORS, the consistent JSON envelope, and the single
// catch site that turns any thrown AppError into a {success:false,...} body.

import { asAppError } from "./errors.ts";
import { newTraceId, runWithTrace } from "./observability/trace.ts";
import { log } from "./observability/log.ts";
import { timing } from "./observability/metrics.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, idempotency-key",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Wrap a handler: answer CORS preflight, open a trace, time the request, and
// serialize any error into the consistent envelope (the single catch site).
export function handle(fn: (req: Request) => Promise<Response>) {
  return (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return Promise.resolve(new Response("ok", { headers: CORS }));
    const route = new URL(req.url).pathname;
    return runWithTrace({ traceId: newTraceId(), route }, async () => {
      const start = performance.now();
      try {
        const res = await fn(req);
        log.info("request.ok", { status: res.status });
        timing("request.duration_ms", performance.now() - start, { status: String(res.status) });
        return res;
      } catch (e) {
        const ae = asAppError(e);
        log.error("request.error", { error_code: ae.code, message: ae.message });
        timing("request.duration_ms", performance.now() - start, { status: String(ae.httpStatus) });
        return json(ae.toBody(), ae.httpStatus);
      }
    });
  };
}

// Read a param from the query string or a JSON body (whichever is present).
export async function param(req: Request, name: string): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get(name);
  if (fromQuery !== null) return fromQuery;
  if (req.method === "POST") {
    try {
      const body = await req.clone().json();
      const v = body?.[name];
      return v == null ? null : String(v);
    } catch { /* not JSON */ }
  }
  return null;
}
