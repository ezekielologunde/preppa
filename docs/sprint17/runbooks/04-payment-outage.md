# Stripe Payment Outage

**Severity**: Critical
**Affects**: New order placement (payments blocked); active refund and escrow release flows
**MTTR Target**: 30 minutes (containment immediate; Stripe restore determines full recovery timeline)

---

## Detection

### Automated Signals
- `payments WHERE status = 'failed'` count growing rapidly (>5 in 5 minutes)
- `active_alerts` fires `payment_failure_rate` alert
- Edge function `process-payment` or `stripe-webhook` returning 5xx errors
- `platform_health_metrics.failed_payment_count_1h` spikes

### Manual Checks
```sql
-- Payment failure rate in the last 30 minutes
SELECT
  DATE_TRUNC('minute', created_at) AS minute,
  status,
  COUNT(*) AS count
FROM payments
WHERE created_at > NOW() - INTERVAL '30 minutes'
GROUP BY 1, 2
ORDER BY 1 DESC;

-- Payments stuck in processing (Stripe call in-flight but no response)
SELECT id, order_id, amount, status, stripe_payment_intent_id, created_at
FROM payments
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '10 minutes';

-- Recent payment errors with Stripe error codes
SELECT stripe_error_code, stripe_error_message, COUNT(*)
FROM payments
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY 1, 2
ORDER BY 3 DESC;
```

### External Sources
- Stripe status page: https://status.stripe.com — check "API" and "Webhooks" components
- Stripe dashboard → Developers → Events → filter last hour for `payment_intent.payment_failed`

---

## Immediate Containment (< 5 minutes)

1. **Confirm Stripe is the cause** — check https://status.stripe.com. If Stripe is healthy, the issue is in our edge function or DB (use different runbook).
2. **Disable new order payments** via feature flag:
   ```sql
   UPDATE feature_flags
   SET kill_switch = TRUE, updated_at = NOW()
   WHERE flag_key = 'payments_enabled';
   ```
   This prevents users from attempting payments that will fail, avoiding confusing UX and double-charge risk.
3. **Do NOT manually modify `payments` table records** — the `payments` table is the source of truth; Stripe is authoritative only for intents.
4. **Verify escrow is safe** — existing captured payments in escrow are held in the `payments` table and are not affected by a Stripe API outage:
   ```sql
   SELECT COUNT(*), SUM(amount) FROM payments
   WHERE status = 'captured'
     AND released_at IS NULL;
   -- This amount is safe regardless of Stripe availability
   ```
5. **Post status communication** (see template below).

---

## Impact Assessment

| Component | Status |
|-----------|--------|
| New order placement | Blocked (payments disabled) |
| Existing orders in escrow | Safe — held in payments table |
| Refund processing | Failing (Stripe API unreachable) |
| Prepper payout (escrow release) | Failing |
| Order browsing and management | Unaffected |
| Event bus / projections | Unaffected |
| Admin control plane | Unaffected |

**Critical**: Any refund or release attempted during the outage will fail at Stripe but may succeed at the DB layer. Check for divergence after restoration (Step 4 below).

---

## Recovery Procedure

### Step 1 — Confirm Stripe API restored
```bash
# Test Stripe API health with a minimal retrieve call
curl https://api.stripe.com/v1/payment_intents?limit=1 \
  -u "[STRIPE_SECRET_KEY]:" \
  -H "Stripe-Version: 2023-10-16"
# Expected: 200 with JSON
```

### Step 2 — Re-enable payments feature flag
```sql
UPDATE feature_flags
SET kill_switch = FALSE, updated_at = NOW()
WHERE flag_key = 'payments_enabled'
  AND kill_switch = TRUE;
```

### Step 3 — Retry failed payment intents
```sql
-- Identify failed payments that should be retried
SELECT id, order_id, stripe_payment_intent_id, amount, created_at
FROM payments
WHERE status = 'failed'
  AND created_at > '[outage_start]'
ORDER BY created_at;
```
For each, trigger retry via the event bus:
```sql
-- Insert a retry event
INSERT INTO domain_events (event_type, aggregate_id, payload)
VALUES ('payment.retry_requested', '[payment_id]',
  jsonb_build_object('payment_id', '[payment_id]', 'reason', 'stripe_outage_recovery'));
```

### Step 4 — Check for DB/Stripe divergence on refunds and releases
This is the highest-risk area. A refund may have been written to the DB as `refunded` but never reached Stripe:
```sql
-- Refunds marked successful in DB during outage window
SELECT p.id, p.stripe_payment_intent_id, p.refund_amount, p.refunded_at
FROM payments p
WHERE p.status = 'refunded'
  AND p.refunded_at BETWEEN '[outage_start]' AND '[outage_end]';
```
For each row: go to Stripe dashboard → Payments → search by `stripe_payment_intent_id` → confirm a refund exists. If no refund exists in Stripe, create it manually via Stripe dashboard.

### Step 5 — Check for stuck 'processing' payments
```sql
SELECT id, stripe_payment_intent_id, created_at
FROM payments
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '15 minutes';
```
For each: retrieve the payment intent from Stripe to get authoritative status, then update the DB:
```sql
UPDATE payments
SET status = '[stripe_status]', updated_at = NOW()
WHERE id = '[payment_id]';
```

---

## Verification

```sql
-- 1. Failed payment rate normalized
SELECT COUNT(*) FROM payments
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '15 minutes';
-- Should match pre-outage baseline (typically < 2 per 15 min)

-- 2. No payments stuck in processing
SELECT COUNT(*) FROM payments
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '10 minutes';
-- Expected: 0

-- 3. Feature flag restored
SELECT kill_switch FROM feature_flags
WHERE flag_key = 'payments_enabled';
-- Expected: FALSE

-- 4. Payment alert cleared
SELECT alert_name, resolved_at FROM active_alerts
WHERE alert_name = 'payment_failure_rate';

-- 5. Escrow amounts reconciled
SELECT COUNT(*), SUM(amount) FROM payments
WHERE status = 'captured' AND released_at IS NULL;
-- Compare to pre-outage snapshot in metrics_snapshots
```

---

## Communication Template

> **[Preppa Status Update]**
> We are experiencing an issue with our payment processor. New orders are temporarily paused while we resolve this.
>
> All existing orders and payments are unaffected. If you have an order in progress, it is safe and will be completed once service is restored.
>
> We will update this message when payments are restored. We apologize for the inconvenience.

**Post-recovery update:**
> Payments have been restored as of [HH:MM] [TZ]. You can now place new orders. If your order attempt failed during the outage, please try again.

---

## Postmortem Questions

1. Were any DB records left in divergence with Stripe (e.g., DB shows refunded but Stripe has no refund) — and what was the total dollar value at risk?
2. Did the `payments_enabled` feature flag reach the client before users saw failed payment screens?
3. Were any payment intents created on Stripe but never recorded in our DB (resulting in charges without orders)?
4. How long did the `payment_failure_rate` alert take to fire after the first failure?
5. Should we implement an idempotency-key retry mechanism so failed intents can be safely retried without double-charge risk?
6. Do we have a reconciliation job that compares our `payments` table against Stripe's payment intents daily?
7. What is our refund SLA, and did this outage cause us to breach it for any customers?
