# Lemon Squeezy billing — setup

Real subscriptions via **Lemon Squeezy** (merchant-of-record: LS is the seller of
record, remits VAT, no Thai company needed). Drops into the existing
`subscriptions` table — the quota hot-path and client never learn LS exists
(see `../BILLING.md`).

Pricing: **฿300/mo** · **฿2,700/yr** (yearly = ฿3,600 −25%).

## One-time dashboard setup

1. **Create a store** at app.lemonsqueezy.com (Settings → Stores).
2. **Create one product** "Mun Pro" with **two variants**:
   - Monthly — ฿300, billing interval *month*.
   - Yearly — ฿2,700, billing interval *year*.
3. For each variant: **Share → copy the buy-link URL** (`https://<store>.lemonsqueezy.com/buy/<uuid>`).
   Note each variant's **numeric id** (variant page URL / API) — the webhook maps it.
4. Product → **Redirect URL after purchase** = the app URL (so buyers return).
5. **Webhooks** (Settings → Webhooks) → add:
   - URL: `https://<project-ref>.functions.supabase.co/lemonsqueezy-webhook`
   - Signing secret: generate one, save it.
   - Events: `subscription_created`, `subscription_updated`, `subscription_cancelled`,
     `subscription_resumed`, `subscription_expired`, `subscription_paused`,
     `subscription_unpaused`. (Subscribing to `subscription_payment_*` is harmless —
     the webhook allowlists lifecycle events and ignores the rest — but unnecessary.)

## Secrets (Supabase)

```
supabase secrets set \
  LEMONSQUEEZY_WEBHOOK_SECRET="<signing secret from step 5>" \
  LEMONSQUEEZY_VARIANT_MONTHLY="<monthly numeric variant id>" \
  LEMONSQUEEZY_VARIANT_YEARLY="<yearly numeric variant id>"
```

## Deploy

```
supabase db push                                          # applies the unique-index migration
supabase functions deploy lemonsqueezy-webhook --no-verify-jwt
```

`--no-verify-jwt` is required — LS is server-to-server and carries no Supabase JWT.
Auth is the `X-Signature` HMAC instead.

## Client wiring

In `web/app.js`, set the `LS` constant (top of file) to the two buy-link URLs from
step 3 plus the customer portal URL (`https://<store>.lemonsqueezy.com/billing`).
Until then `LS_LIVE` is false and the CTA falls back to the mock upgrade.
The checkout appends `checkout[custom][user_id]=<auth uid>` so the webhook maps
the subscription back to the account.

## How it maps

| LS subscription status | our `subscriptions.status` | Pro? |
|------------------------|----------------------------|------|
| active / on_trial      | active / trialing          | yes  |
| cancelled              | active until `ends_at`     | yes (grace) |
| past_due               | active (dunning grace)     | yes  |
| paused / unpaid / expired | expired                 | no   |

Upsert keys on `(provider, provider_subscription_id)` (unique partial index from
migration `20260627000002`). Idempotent — LS retries failed deliveries and the
upsert converges to the latest state. `expires_at` is honored by `consume_external_quota`.

## Test

LS dashboard → Webhooks → **Send test event**, or use test-mode checkout. Then:
`select user_id, plan_id, status, provider, expires_at from subscriptions order by updated_at desc;`
— a `provider='lemonsqueezy'` row should appear; reload the app → Pro unlocked.
