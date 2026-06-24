# Billing — mocked subscriptions → Stripe migration path

Subscriptions are **mocked** today and the quota system already runs off the
`subscriptions` table. The schema was built so a real provider drops in with **no
change to the hot path** (`consume_external_quota` reads whatever active
subscription exists, regardless of `provider`).

## Today (mocked)

Grant a user a tier by inserting a row (service role / SQL editor):

```sql
insert into subscriptions (user_id, plan_id, status, provider)
values ('<user-uuid>', 'pro', 'active', 'mock');
```

The next quota check resolves `pro` → 5000/day. Downgrade = set `status='canceled'`
(the partial-unique index frees the slot) or insert a `free`-equivalent (no row =
free by default). Nothing else to touch.

## Switching to Stripe (or LemonSqueezy / RevenueCat)

The `subscriptions` columns `provider`, `provider_customer_id`,
`provider_subscription_id`, `status`, `expires_at` are exactly the webhook's
landing fields. Steps:

1. **Map plans → prices.** Add the provider's price id to each plan (e.g.
   `plans.features->>'stripe_price_id'`), or a small `plan_prices(plan_id, provider,
   price_id)` table. No new concepts — just a lookup.
2. **Checkout** — a `create-checkout-session` Edge Function creates a Stripe
   Checkout session for the chosen price and returns its URL; the client redirects.
3. **Webhook** — a `stripe-webhook` Edge Function (deployed `--no-verify-jwt`, it's
   server-to-server) verifies the signature and upserts the subscription:

   ```ts
   // functions/stripe-webhook/index.ts (sketch — not shipped; needs STRIPE_* secrets)
   const sig = req.headers.get("stripe-signature");
   const event = stripe.webhooks.constructEvent(await req.text(), sig, WEBHOOK_SECRET);

   // Idempotency: skip if event.id already processed (reuse idempotency_keys or a
   // stripe_events table) — Stripe retries deliveries.
   switch (event.type) {
     case "customer.subscription.created":
     case "customer.subscription.updated":
     case "customer.subscription.deleted": {
       const s = event.data.object; // Stripe.Subscription
       await service.from("subscriptions").upsert({
         user_id: await userIdForCustomer(s.customer),   // map via provider_customer_id
         plan_id: planIdForPrice(s.items.data[0].price.id),
         status: mapStatus(s.status),                     // active|past_due|canceled|...
         provider: "stripe",
         provider_customer_id: s.customer,
         provider_subscription_id: s.id,
         starts_at: new Date(s.current_period_start * 1000).toISOString(),
         expires_at: new Date(s.current_period_end * 1000).toISOString(),
       }, { onConflict: "provider,provider_subscription_id" });
     }
   }
   return new Response("ok");
   ```

4. **No hot-path change.** `consume_external_quota` keeps resolving the active
   subscription by `user_id` — it never learns Stripe exists. That isolation is the
   whole point of the Phase 1 schema.

### Why this avoids a refactor

| Concern | Already in place |
|---------|------------------|
| provider-agnostic quota | RPC reads `subscriptions` by user, ignores `provider` |
| multiple billing providers | `provider` CHECK already allows stripe/lemonsqueezy/revenuecat |
| webhook dedupe | `idempotency_keys` pattern reusable for `event.id` |
| status lifecycle | `status` CHECK covers active/trialing/past_due/canceled/expired |
| proration / renewal | `expires_at` honored by the RPC (`expires_at > now()`) |

The only net-new code at switch time is the two Edge Functions (checkout + webhook)
and a price↔plan map. Tiers, limits, and enforcement stay exactly as they are now.
