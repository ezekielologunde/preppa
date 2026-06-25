# Dead Letter Queue Growth

**Severity**: High
**Affects**: Domain consistency — events that should have updated projections or triggered side effects have permanently failed
**MTTR Target**: 60 minutes (root cause analysis required before replay)

---

## Detection

### Automated Signals
- `platform_health_metrics.dead_letter_count` > 10
- `active_alerts` fires `dead_letter_growth` alert
- Dead letter count in `metrics_snapshots` shows sustained upward trend (not a spike from a single bad deploy)

### Manual Checks
```sql
-- Total unresolved dead letters
SELECT COUNT(*) FROM event_dead_letters
WHERE resolved_at IS NULL;

-- Breakdown by event type and error (identify the dominant failure)
SELECT
  event_type,
  final_error,
  COUNT(*) AS count,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM event_dead_letters
WHERE resolved_at IS NULL
GROUP BY event_type, final_error
ORDER BY count DESC;

-- Sample payloads to understand what is failing
SELECT
  id,
  event_type,
  final_error,
  retry_count_at_death,
  payload_snapshot,
  created_at
FROM event_dead_letters
WHERE resolved_at IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- Growth rate: new dead letters per hour
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS new_dead_letters
FROM event_dead_letters
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## Immediate Containment (< 5 minutes)

1. **Determine growth rate** — is the DLQ growing rapidly (100+/hour) or slowly (5-10/hour)?
   - Rapid growth: likely an active bug in the event processor; pause actions immediately.
   - Slow growth: investigate without pausing; may be a specific edge case.

2. **For rapid growth — pause event processing**:
   ```sql
   SELECT admin_pause_all_actions('dead_letter_growth_investigation');
   ```

3. **For slow growth** — identify the dominant event type and disable its source only:
   ```sql
   -- Example: notifications generating dead letters
   UPDATE feature_flags
   SET kill_switch = TRUE, updated_at = NOW()
   WHERE flag_key = 'notifications_enabled';
   ```

4. **Do not replay dead letters yet** — replaying before fixing the underlying bug will just re-create more dead letters.

---

## Impact Assessment

| Component | Status |
|-----------|--------|
| Read-model projections | Drifting — events that didn't process = stale aggregates |
| Side effects (emails, notifications) | Missed for failed events |
| Audit trail | Incomplete for affected events |
| Order/payment mechanics | Likely unaffected (sync, not event-driven) |
| User-visible impact | Depends on what the failing event was supposed to do |

**Severity of user impact depends on event type:**
- `order.created` failures → order metrics stale (cosmetic)
- `payment.captured` failures → payment projection drift (medium risk)
- `order.status_changed` failures → order status shown incorrectly to user (high risk)
- `notification.send` failures → user not notified (low-medium risk)

---

## Recovery Procedure

### Step 1 — Classify the root cause
```sql
-- Read a sample payload to understand the event structure
SELECT payload_snapshot FROM event_dead_letters
WHERE resolved_at IS NULL
  AND event_type = '[dominant_type]'
LIMIT 3;
```

**Root cause categories:**

| Category | Indicator | Fix |
|----------|-----------|-----|
| Code bug in projection handler | Error: `column X does not exist`, `null value` | Fix code, redeploy edge function |
| Missing DB migration | Error: `relation X does not exist` | Apply migration |
| External API failure | Error: HTTP 5xx from external service | Wait + replay after service restores |
| Malformed payload | Error: `invalid input syntax`, JSON parse error | Identify source; fix emitter |
| Race condition | Intermittent errors, no pattern | Add retry delay; replay |

### Step 2 — Fix the underlying issue

**Code bug fix:**
```bash
# After fixing the edge function code:
supabase functions deploy event-processor --project-ref nfwfnnfbikjxwflpmsnu
```

**Missing migration:**
```sql
-- Apply the required schema change in Supabase SQL editor
-- Example: adding a missing column to a projection table
ALTER TABLE order_metrics ADD COLUMN IF NOT EXISTS prepper_rating NUMERIC(3,2);
```

**Confirm the fix works** by processing one test event through the system before replaying the entire DLQ.

### Step 3 — Resume actions (if paused)
```sql
SELECT admin_resume_all_actions('dead_letter_growth_fixed');
```

### Step 4 — Triage dead letters for replay vs. permanent resolution

For each unresolved dead letter, decide:
- **Replayable**: the event is still valid and the fix will allow it to process correctly
- **Permanently failed**: the event's data is invalid, its window has passed, or the side effect is no longer meaningful

```sql
-- Get all unresolved letters for triage
SELECT id, event_type, final_error, payload_snapshot, created_at
FROM event_dead_letters
WHERE resolved_at IS NULL
ORDER BY event_type, created_at;
```

### Step 5 — Replay replayable dead letters
```sql
-- Replay one at a time and verify before bulk replay
SELECT admin_replay_dead_letter('[dead_letter_id]');

-- Check if it processed successfully after replay
SELECT status FROM event_processing_log
WHERE event_id = '[original_event_id]'
ORDER BY created_at DESC LIMIT 1;
```

**Important**: `admin_replay_dead_letter` has a max 3-replay guard. Events that have already been replayed 3 times cannot be replayed again. Check `replay_count`:
```sql
SELECT id, replay_count FROM event_dead_letters
WHERE id = '[dead_letter_id]';
```

### Step 6 — Permanently resolve unrecoverable dead letters
```sql
UPDATE event_dead_letters
SET
  resolved_at = NOW(),
  resolution_note = 'permanently_failed: [reason] — data loss accepted, documented in postmortem [date]'
WHERE id IN ('[id1]', '[id2]', '[id3]');
```

### Step 7 — Rebuild affected projections
```sql
SELECT admin_rebuild_projection('order_created', FALSE, 'dlq_recovery');
SELECT admin_rebuild_projection('payment_captured', FALSE, 'dlq_recovery');
```

---

## Verification

```sql
-- 1. DLQ alert resolved
SELECT alert_name, resolved_at FROM active_alerts
WHERE alert_name = 'dead_letter_growth';

-- 2. No new dead letters in last 15 minutes
SELECT COUNT(*) FROM event_dead_letters
WHERE created_at > NOW() - INTERVAL '15 minutes'
  AND resolved_at IS NULL;
-- Expected: 0

-- 3. All triaged letters resolved
SELECT COUNT(*) FROM event_dead_letters
WHERE resolved_at IS NULL;
-- Expected: 0 (all either replayed or permanently resolved with a note)

-- 4. Dead letter count in platform health normalized
SELECT dead_letter_count FROM platform_health_metrics
ORDER BY computed_at DESC LIMIT 1;
-- Expected: 0

-- 5. Projection data reconciled
SELECT total_orders FROM platform_metrics;
SELECT COUNT(*) FROM orders WHERE status NOT IN ('cancelled', 'refunded');
-- Both numbers should match (within 1-2 for in-flight orders)
```

---

## Communication Template

> **[Internal only — no user communication required for DLQ growth unless user-visible data is wrong for > 1 hour]**
>
> If order statuses are visibly wrong to users:
>
> **[Preppa Notice]**
> We are investigating an issue that may be causing some order status displays to be incorrect. Your actual orders are unaffected — if you have a question about a specific order, please contact support at [support@preppa.com].

---

## Postmortem Questions

1. Which event type was dominant in the DLQ, and what was the exact error — was this detectable before it caused DLQ growth?
2. How many dead letters were permanently unrecoverable, and what data was lost?
3. Was the root cause a code regression introduced by a recent deploy — if so, which commit?
4. How long between the first dead letter appearing and the alert firing?
5. Were projections visibly wrong to users during the incident, and for how long?
6. Did the fix require a DB migration, and if so, was it backward-compatible (no downtime)?
7. What test coverage would have caught this before production — integration test, contract test, or replay test?
