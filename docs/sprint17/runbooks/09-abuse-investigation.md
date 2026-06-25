# User Abuse Investigation

**Severity**: Medium (elevated to High if fraud involves payments)
**Affects**: Platform integrity, other users' experience, prepper revenue
**MTTR Target**: Investigation 30–60 minutes; action taken within 2 hours of report

---

## Detection

### Automated Signals
- `risk_scores WHERE score > 0.8` (high-risk threshold) for a user
- `active_alerts` fires `high_risk_user` alert
- `abuse_signals` table shows multiple signals for the same user within a short window
- `security_events` shows `self_order_detected` or `review_fraud_detected` event type
- Unusual pattern: single customer placing orders from multiple prepper accounts run by the same person

### Manual Checks
```sql
-- User's current risk score and component breakdown
SELECT
  user_id,
  score,
  score_components,
  computed_at,
  review_status
FROM risk_scores
WHERE user_id = '[target_user_id]'
ORDER BY computed_at DESC
LIMIT 1;

-- All abuse signals for the user
SELECT
  signal_type,
  signal_value,
  emitted_at,
  metadata
FROM abuse_signals
WHERE user_id = '[target_user_id]'
ORDER BY emitted_at DESC;

-- Order history — look for self-orders or suspicious patterns
SELECT
  o.id,
  o.customer_id,
  o.prepper_id,
  o.status,
  o.total_amount,
  o.created_at,
  -- Check if customer and prepper share account details
  cu.email AS customer_email,
  pu.email AS prepper_email
FROM orders o
JOIN auth.users cu ON cu.id = o.customer_id
JOIN auth.users pu ON pu.id = o.prepper_id
WHERE o.customer_id = '[target_user_id]'
   OR o.prepper_id = '[target_user_id]'
ORDER BY o.created_at DESC;

-- Check for self-ordering (customer ordering from own prepper account)
SELECT COUNT(*) FROM orders
WHERE customer_id = '[target_user_id]'
  AND prepper_id IN (
    SELECT id FROM preppers WHERE user_id = '[target_user_id]'
  );

-- Admin actions already taken on this user
SELECT action_type, metadata, created_at, admin_id
FROM admin_action_log
WHERE target_id = '[target_user_id]'
ORDER BY created_at DESC;
```

---

## Immediate Containment (< 5 minutes)

1. **Do not act on a single signal alone** — gather at least 3 corroborating data points before taking any user-visible action.
2. **If risk score > 0.9 and payment fraud is suspected**, freeze the account immediately while investigating:
   ```sql
   SELECT admin_freeze_account('[target_user_id]', 'high_risk_score_pending_investigation');
   ```
   A frozen account cannot place orders or receive payouts but can still log in and view their history.

3. **If the user is a prepper with a suspicious listing**, disable the listing:
   ```sql
   SELECT admin_disable_listing('[listing_id]', 'abuse_investigation_pending');
   ```

4. **Do not cancel in-progress orders yet** — wait until investigation is complete; cancelling legitimate orders harms both the customer and prepper.

---

## Impact Assessment

| Abuse Type | Who Is Harmed | Severity |
|------------|--------------|----------|
| Self-ordering (manipulating review count) | Competing preppers, platform integrity | Medium |
| Payment fraud (chargeback abuse) | Preppers who lose payout, Preppa margin | High |
| Review fraud (fake reviews) | Competing preppers, customer trust | Medium |
| Account takeover | The legitimate account holder | Critical |
| Bulk signups / bot accounts | Ad spend, marketplace economics | Medium |
| Coordinated price manipulation | Customers, competing preppers | High |

---

## Recovery Procedure

### Step 1 — Establish the timeline of abuse
```sql
-- Full chronological event log for the target
SELECT
  'order' AS type,
  id::TEXT,
  created_at,
  status::TEXT AS detail
FROM orders
WHERE customer_id = '[target_user_id]'
   OR prepper_id = '[target_user_id]'

UNION ALL

SELECT 'abuse_signal', signal_type, emitted_at, signal_value::TEXT
FROM abuse_signals
WHERE user_id = '[target_user_id]'

UNION ALL

SELECT 'admin_action', action_type, created_at, metadata::TEXT
FROM admin_action_log
WHERE target_id = '[target_user_id]'

ORDER BY created_at DESC;
```

### Step 2 — Assess payment impact
```sql
-- Payments associated with the user (as customer or prepper)
SELECT
  p.id,
  p.order_id,
  p.amount,
  p.status,
  p.stripe_payment_intent_id,
  p.created_at
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE o.customer_id = '[target_user_id]'
   OR o.prepper_id = '[target_user_id]'
ORDER BY p.created_at DESC;
```

### Step 3 — Make a determination

**Decision tree:**

| Finding | Action |
|---------|--------|
| Confirmed self-ordering | Freeze + cancel self-orders + resolve abuse_review |
| Confirmed review fraud | Freeze + remove fraudulent reviews + resolve |
| Confirmed payment fraud | Freeze + issue refund to victims + notify Stripe |
| Inconclusive evidence | Clear abuse review; no action |
| False positive | Clear abuse review with note |

### Step 4 — Execute the appropriate action

**Freeze confirmed abuser:**
```sql
SELECT admin_freeze_account('[target_user_id]', 'confirmed_[abuse_type]: [brief_description]');
```

**If prepper listing was used for fraud:**
```sql
SELECT admin_disable_listing('[listing_id]', 'confirmed_fraud_[YYYY-MM-DD]');
```

**Clear a false positive:**
```sql
SELECT admin_clear_abuse_review('[target_user_id]', 'investigation_cleared: no_evidence_of_abuse');
```

**Cancel fraudulent orders** (if self-orders or fraud-funded):
```sql
UPDATE orders
SET status = 'cancelled',
    cancellation_reason = 'admin_abuse_investigation',
    updated_at = NOW()
WHERE id IN ('[order_id_1]', '[order_id_2]')
  AND status NOT IN ('delivered', 'refunded');

-- Then insert domain event to trigger projections
INSERT INTO domain_events (event_type, aggregate_id, payload)
VALUES ('order.cancelled_by_admin', '[order_id_1]',
  jsonb_build_object('reason', 'abuse_investigation', 'admin_note', '[your_note]'));
```

### Step 5 — Document the finding
```sql
-- All admin actions are logged automatically via admin_action_log
-- Add an explicit investigation note
INSERT INTO admin_action_log (admin_id, action_type, target_id, target_type, metadata)
VALUES (
  auth.uid(),
  'abuse_investigation_closed',
  '[target_user_id]',
  'user',
  jsonb_build_object(
    'outcome', '[cleared|frozen|banned]',
    'evidence_summary', '[brief description]',
    'postmortem_date', NOW()::DATE
  )
);
```

---

## Verification

```sql
-- 1. Account status is correct
SELECT account_status, frozen_at, freeze_reason
FROM user_profiles
WHERE user_id = '[target_user_id]';

-- 2. Abuse review cleared from queue
SELECT review_status FROM risk_scores
WHERE user_id = '[target_user_id]'
ORDER BY computed_at DESC LIMIT 1;
-- Expected: 'cleared' or 'actioned'

-- 3. If frozen — user cannot place orders
-- Attempt: SELECT is_account_active('[target_user_id]');
-- Expected: FALSE

-- 4. Fraudulent orders cancelled
SELECT status FROM orders
WHERE id IN ('[fraud_order_ids]');
-- Expected: 'cancelled'

-- 5. Admin action logged
SELECT * FROM admin_action_log
WHERE target_id = '[target_user_id]'
ORDER BY created_at DESC LIMIT 5;
```

---

## Communication Template

**To the investigated user (if cleared):**
> We recently reviewed your account as part of routine platform safety checks. No issues were found — your account remains in good standing.

**To the investigated user (if actioned — keep vague for legal reasons):**
> We have detected activity on your account that violates our Terms of Service. Your account has been restricted. Please contact [support@preppa.com] to appeal this decision.

**To a harmed prepper (if their payout was affected by fraud):**
> We identified fraudulent activity on a recent order. We are processing a correction to your account within [X] business days. We apologize for the disruption.

---

## Postmortem Questions

1. How long did the abuse run before detection — and what signals appeared earliest?
2. Was the risk score threshold (0.8) appropriate, or did it fire too early/late for this case?
3. Were any legitimate users frozen as false positives during a related investigation sweep?
4. What was the total dollar value of fraudulent transactions, and were victims made whole?
5. Does this abuse pattern suggest a gap in our RLS policies, pricing rules, or self-order guards?
6. Should `self_order` be blocked at the DB level via a constraint rather than detected after the fact?
7. Do we have a legal obligation to report this fraud to law enforcement, Stripe, or a payments authority?
