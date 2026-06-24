// Centralized env access. Fail fast on missing required secrets at cold start
// rather than mid-request. Set these with `supabase secrets set` (and SUPABASE_*
// are injected automatically in the Edge runtime).

function req(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
function opt(name: string): string {
  return Deno.env.get(name) ?? "";
}

export const ENV = {
  SUPABASE_URL: req("SUPABASE_URL"),
  SERVICE_ROLE_KEY: req("SUPABASE_SERVICE_ROLE_KEY"),
  ANON_KEY: req("SUPABASE_ANON_KEY"),
  // Provider keys are optional — a provider without its key is simply skipped.
  FINNHUB_KEY: opt("FINNHUB_KEY"),
  ALPHAVANTAGE_KEY: opt("ALPHAVANTAGE_KEY"),
};
