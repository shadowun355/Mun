// The Edge Function boundary: CORS, the consistent JSON envelope, and the single
// catch site that turns any thrown AppError into a {success:false,...} body.

import { asAppError } from "./errors.ts";

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

// Wrap a handler: answer CORS preflight, and serialize errors uniformly.
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    try {
      return await fn(req);
    } catch (e) {
      const ae = asAppError(e);
      return json(ae.toBody(), ae.httpStatus);
    }
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
