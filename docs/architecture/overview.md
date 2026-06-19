# Preppa Architecture Overview

## Stack
| Layer | Technology |
|-------|-----------|
| Mobile/Web app | React Native (Expo 56+), TypeScript, Expo Router |
| UI kit | Nativewind (TailwindCSS), Moti (animations), Lucide icons |
| State | React Query (server state), Zustand/AsyncStorage (local state) |
| Backend-as-a-Service | Supabase (PostgreSQL, PostgREST, Realtime, Edge Functions) |
| Payments | Stripe (Checkout, Connect, Billing Portal, Webhooks) |
| Push notifications | Expo Notifications → Supabase → FCM/APNs |
| Web deployment | Vercel (auto-deploys from `main`) |

## Request flow
```
[User] → [Expo App]
           ↓ REST/realtime
        [Supabase PostgREST + RLS]
           ↓ SQL (PostgreSQL 15)
        [Supabase DB]
           ↓ DB webhooks / triggers
        [Supabase Edge Functions (Deno)]
           ↓ Stripe SDK
        [Stripe API]
           ↓ Webhooks (HTTPS signed)
        [stripe-webhook Edge Fn]
           ↓ DB writes
        [Supabase DB]
```

## Security model
- **Authentication**: Supabase JWT (email/OTP or password) with 7-day session TTL
- **Authorization**: Row-Level Security on every table; `is_admin()`, `has_role()`, `my_prepper_id()` helper functions
- **Payments**: Stripe-hosted iframes (PCI SAQ-A); no card data touches our servers
- **Payouts**: Stripe Connect Express for direct bank payouts; manual payout requests fall back to admin-processed ACH
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` in Supabase edge function secrets only; never in app bundle

## Data retention
- **Orders**: retained indefinitely for financial reconciliation
- **User profiles**: soft-deleted on request (30-day grace period); hard-delete removes PII
- **Audit logs**: retained for minimum 7 years (financial compliance)
- **Rate limit events**: auto-purged after 10 minutes
- **Session tokens**: invalidated on sign-out; max 7-day TTL

## RTO / RPO Targets
| Metric | Target | Basis |
|--------|--------|-------|
| RTO (Recovery Time Objective) | < 4 hours | Supabase's built-in HA; Vercel instant rollback |
| RPO (Recovery Point Objective) | < 1 hour | Supabase daily backups + WAL streaming |

## Disaster recovery
1. **DB failure**: Supabase manages PostgreSQL with HA (auto-failover). Manual recovery via Supabase dashboard → restore from point-in-time backup.
2. **Edge function failure**: Stateless; re-deploy from git. Stripe webhooks will retry for 72 hours.
3. **Payment processing failure**: Stripe is HA; Stripe downtime → orders fail gracefully (no double-charge). Webhooks retry automatically.
4. **App crash (web)**: Vercel instant rollback via `vercel rollback` or dashboard.
5. **App crash (mobile)**: OTA update via Expo EAS Update; full rebuild and submit takes ~2 hours.

## Key database tables (by domain)
See `supabase/migrations/` for full schema. Key tables:
- `profiles` — user identity
- `prepper_profiles` — prepper-specific data
- `meals` — menu items
- `orders`, `order_items` — purchase records
- `payout_requests` — prepper payout queue
- `subscriptions` — recurring meal plans
- `audit_logs` — tamper-evident action log
- `rate_limit_events` — abuse prevention
