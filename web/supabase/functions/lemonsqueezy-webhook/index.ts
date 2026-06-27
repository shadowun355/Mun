// Edge Function: POST /lemonsqueezy-webhook
//
// Server-to-server. Deploy with `--no-verify-jwt` (Lemon Squeezy has no Supabase
// JWT) — auth is the HMAC signature instead. Set the webhook URL + signing secret
// in the LS dashboard (Settings → Webhooks), subscribe to the `subscription_*`
// events, and pass the app user id at checkout as `checkout[custom][user_id]`.
//
// Flow: verify X-Signature (HMAC-SHA256 of the raw body) → map the LS subscription
// status + variant to our `subscriptions` row → service-role upsert. The quota
// hot-path (`consume_external_quota`) and the client both read `subscriptions` by
// user_id and never learn LS exists — see functions/BILLING.md.
//
// Secrets (supabase secrets set):
//   LEMONSQUEEZY_WEBHOOK_SECRET   — the webhook signing secret from LS
//   LEMONSQUEEZY_VARIANT_MONTHLY  — variant id of the ฿300/mo plan
//   LEMONSQUEEZY_VARIANT_YEARLY   — variant id of the ฿2,700/yr plan

import { serviceClient } from "../_shared/supabase.ts";
import { ENV } from "../_shared/env.ts";

const enc = new TextEncoder();

// Constant-time hex compare — avoids leaking the signature byte-by-byte via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validSignature(secret: string, body: string, sigHex: string): Promise<boolean> {
  if (!secret || !sigHex) return false;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, sigHex.toLowerCase());
}

// LS variant id → our plan_id. Both LS subscription plans are the single 'pro' tier;
// monthly vs yearly is a billing cadence, not a different feature set.
function planIdForVariant(variantId: string): string {
  if (variantId === ENV.LEMONSQUEEZY_VARIANT_MONTHLY) return "pro";
  if (variantId === ENV.LEMONSQUEEZY_VARIANT_YEARLY) return "pro";
  return "pro"; // any configured LS sub grants Pro; widen here if more tiers ship
}

// LS status → our enum. "Has access" statuses keep Pro until expires_at; a
// cancelled sub still has access until period end (ends_at), so it stays 'active'
// with expires_at=ends_at rather than being revoked immediately.
//   active | on_trial | cancelled | past_due → access (status active/trialing)
//   expired | unpaid | paused              → revoked
const STATUS_MAP: Record<string, string> = {
  active: "active",
  on_trial: "trialing",
  cancelled: "active",   // grace until ends_at
  past_due: "active",    // dunning grace; LS retries, then expires
  paused: "expired",
  unpaid: "expired",
  expired: "expired",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text(); // raw body required for HMAC — read before JSON.parse
  const sig = req.headers.get("x-signature") ?? "";
  if (!await validSignature(ENV.LEMONSQUEEZY_WEBHOOK_SECRET, raw, sig)) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const eventName: string = payload?.meta?.event_name ?? req.headers.get("x-event-name") ?? "";
  // Only lifecycle events carry a Subscription object. subscription_payment_*
  // events carry a Subscription *Invoice* (data.id is an invoice id, attrs.status
  // is an invoice status) — processing them would write garbage, so allowlist.
  const LIFECYCLE = new Set([
    "subscription_created", "subscription_updated", "subscription_cancelled",
    "subscription_resumed", "subscription_expired", "subscription_paused",
    "subscription_unpaused",
  ]);
  if (!LIFECYCLE.has(eventName)) return new Response("ignored", { status: 200 });

  const data = payload?.data;
  const attrs = data?.attributes ?? {};
  const subId: string | null = data?.id ? String(data.id) : null;
  const lsStatus: string = attrs.status ?? "";
  const mapped = STATUS_MAP[lsStatus] ?? "expired";
  const revoked = mapped === "expired";

  const svc = serviceClient();

  // Resolve the app user: custom_data from checkout, else the existing row for this
  // LS subscription (later events may omit custom_data).
  let userId: string | undefined = payload?.meta?.custom_data?.user_id;
  if (!userId && subId) {
    const { data: row } = await svc.from("subscriptions")
      .select("user_id").eq("provider", "lemonsqueezy")
      .eq("provider_subscription_id", subId).maybeSingle();
    userId = row?.user_id;
  }
  if (!userId || !subId) return new Response("no user mapping", { status: 200 }); // ack; nothing to do

  const planId = planIdForVariant(String(attrs.variant_id ?? ""));
  // expires_at honored by the quota RPC. Revoked → now (immediate). Else the LS
  // period boundary: ends_at when cancelling, otherwise the next renewal.
  const expiresAt = revoked
    ? new Date().toISOString()
    : (attrs.ends_at ?? attrs.renews_at ?? null);

  // One active sub per user (uniq_active_sub_per_user). Before granting access,
  // cancel EVERY active/trialing row for the user (incl. a leftover 'mock' sub —
  // NULL provider_subscription_id would slip past a `.neq` filter). The upsert
  // below flips this LS subscription's own row back to active.
  if (!revoked) {
    await svc.from("subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("user_id", userId).in("status", ["active", "trialing"]);
  }

  const { error } = await svc.from("subscriptions").upsert({
    user_id: userId,
    plan_id: planId,
    status: mapped,
    provider: "lemonsqueezy",
    provider_customer_id: attrs.customer_id ? String(attrs.customer_id) : null,
    provider_subscription_id: subId,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider,provider_subscription_id" });

  if (error) {
    console.error("subscription upsert failed", { eventName, subId, error: error.message });
    return new Response("db error", { status: 500 }); // 500 → LS retries delivery
  }

  return new Response("ok", { status: 200 });
});
