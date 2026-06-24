// Two Supabase clients with deliberately different privileges:
//  - serviceClient(): bypasses RLS — used ONLY for cache writes and reading any
//    user's subscription/usage during server logic. Never exposed to the browser.
//  - userClient(authHeader): carries the caller's JWT so RLS applies and
//    auth.uid() is set inside SECURITY DEFINER RPCs (quota is charged to the caller).
//
// The quota RPC must run on the user client — auth.uid() drives who gets charged.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ENV } from "./env.ts";
import { AppError } from "./errors.ts";

export function serviceClient(): SupabaseClient {
  return createClient(ENV.SUPABASE_URL, ENV.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(authHeader: string | null): SupabaseClient {
  if (!authHeader) throw new AppError("UNAUTHENTICATED", "Missing Authorization header");
  return createClient(ENV.SUPABASE_URL, ENV.ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Resolve and validate the caller. Throws UNAUTHENTICATED if the JWT is absent/invalid.
export async function requireUser(authHeader: string | null): Promise<{ id: string; email?: string }> {
  const sb = userClient(authHeader);
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new AppError("UNAUTHENTICATED", "Invalid or expired session");
  return { id: data.user.id, email: data.user.email ?? undefined };
}
