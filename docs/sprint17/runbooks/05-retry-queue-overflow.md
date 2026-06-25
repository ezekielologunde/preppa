# Retry Queue Overflow

**Severity**: High
**Affects**: Event processing pipeline; projections stale; domain consistency at risk
**MTTR Target**: 45 minutes (identify root cause 15 min; drain queue 30 min)

---

## Detection

### Automated Signals
- `platform_health_metrics.retry_queue_depth` > 500
- `active_alerts` fires `retry_depth` alert
- `metrics_snapshots` shows `retry_queue_depth` trending upward over multiple snapshots
- pg_cron job `dispatch-retry-events` runs every minute but queue is not draining

### Manual Checks
```sql
-- Current retry queue depth
SELECT COUNT(*) FROM event_processing_log
WHERE status = 'pending_retry';

-- Retry queue breakdown by event type and error
SELECT
  event_type,
  error_message,
  COUNT(*) AS count,
  MIN(next_retry_at) AS earliest_retry,
  MAX(retry_count) AS max_retries
FROM event_processing_log
WHERE status = 'pending_retry'
GROUP BY event_type, error_message
ORDER BY count DESC;

-- Events that have exhausted retries (about to move to dead letter)
SELECT id, event_type, retry_count, last_error, updated_at
FROM event_processing_log
WHERE status = 'pending_retry'
  AND retry_count >= 3
ORDER BY updated_at;

-- Rate of new items entering the retry queue (last 10 minutes)
SELECT
  DATE_TRUNC('minute', updated_at) AS minute,
  COUNT(*) AS new_retries
FROM event_processing_log
WHERE status = 'pending_retry'
  AND updated_at > NOW() - INTERVAL '10 minutes'
GROUP BY 1
ORDER BY 1;
```

---

## Immediate Containment (< 5 minutes)

1. **Identify the dominant failure pattern** immediately — is one event type causing 80%+ of retries?
   ```sql
   SELECT event_type, COUNT(*) FROM event_processing_log
   WHERE status = 'pending_retry'
   GROUP BY event_type ORDER BY 2 DESC LIMIT 5;
   ```

2. **If a single event type is the poison pill**, stop new events of that type from entering the queue by disabling its source:
   ```sql
   -- Example: if 'order.notification_send' is the culprit
   UPDATE feature_flags
   SET kill_switch = TRUE, updated_at = NOW()
   WHERE flag_key = 'notifications_enabled';
   ```

3. **If the source is unknown or systemic**, pause all admin actions to stop new events:
   ```sql
   SELECT admin_pause_all_actions('retry_queue_overflow');
   ```

4. **Check edge function health** — view recent errors in Supabase dashboard → Edge Functions → `event-processor` → logs. Identify if there is a deploy issue or external dependency failure.

5. **Do not manually delete retry entries** — wait until root cause is confirmed; deleting may cause permanent data loss.

---

## Impact Assessment

| Component | Status |
|-----------|--------|
| New order events | Processing but may queue behind backlog |
| Projection freshness | Degraded — read models are stale |
| Dead letter queue | Filling up as retries exhaust |
| Admin metrics dashboard | Showing stale data |
| User-facing orders/payments | Likely still functional (payments are sync, not event-driven) |
| Notification delivery | Delayed or failing |

**Key insight**: Payments are synchronous (Stripe call in edge function, not event-driven), so payments continue working even during retry queue overflow. Orders placed will record correctly; projections will catch up once queue drains.

---

## Recovery Procedure

### Step 1 — Identify root cause category
```sql
-- Get a sample of failing events to read their error messages
SELECT
  id,
  event_type,
  error_message,
  retry_count,
  payload_snapshot
FROM event_processing_log
WHERE status = 'pending_retry'
ORDER BY retry_count DESC
LIMIT 10;
```

**Common root causes:**
- Edge function bug (code error in `event-processor`) → fix and redeploy
- DB schema mismatch (projection table missing column) → apply migration
- External API timeout (notification provider, Stripe) → wait for provider restore
- Poison-pill payload (malformed event data) → identify and resolve individual events

### Step 2 — Fix the underlying cause

**For edge function bugs:**
```bash
# Redeploy the event-processor edge function
supabase functions deploy event-processor --project-ref nfwfnnfbikjxwflpmsnu
```

**For DB schema issues:**
```sql
-- Apply the needed migration in Supabase SQL editor
-- Then verify the projection table is correct:
\d order_metrics  -- or whichever projection is failing
```

**For poison-pill events (specific bad payloads):**
```sql
-- Move specific bad events directly to dead letter
-- (resolve them manually rather than retrying forever)
UPDATE event_processing_log
SET status = 'permanently_failed',
    error_message = 'poison_pill: [reason]',
    updated_at = NOW()
WHERE id IN ('[id1]', '[id2]')
  AND status = 'pending_retry';
```

### Step 3 — Resume actions (if paused)
```sql
SELECT admin_resume_all_actions('retry_queue_overflow_resolved');
```

### Step 4 — Drain the retry queue
After the fix is deployed, the `dispatch-retry-events` pg_cron job will automatically pick up pending retries every minute. Monitor the queue draining:
```sql
-- Run every 2 minutes to watch the queue shrink
SELECT
  status,
  COUNT(*) AS count
FROM event_processing_log
WHERE updated_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

### Step 5 — Handle events that exhausted retries (moved to dead letter)
```sql
SELECT COUNT(*) FROM event_dead_letters
WHERE resolved_at IS NULL
  AND created_at > '[incident_start]';
```
For each dead letter entry, evaluate if it is replayable, then:
```sql
SELECT admin_replay_dead_letter('[dead_letter_id]');
```
Or resolve permanently if unrecoverable:
```sql
UPDATE event_dead_letters
SET resolved_at = NOW(),
    resolution_note = 'permanently_failed: retry_queue_overflow_event_type_[x]'
WHERE id = '[dead_letter_id]';
```

### Step 6 — Verify projections are caught up
```sql
SELECT admin_rebuild_projection('order_created', FALSE, 'post_retry_overflow_recovery');
```

---

## Verification

```sql
-- 1. Retry queue drained
SELECT COUNT(*) FROM event_processing_log
WHERE status = 'pending_retry';
-- Expected: < 10 (some in-flight is normal)

-- 2. Queue not growing
SELECT
  DATE_TRUNC('minute', updated_at) AS minute,
  COUNT(*) AS count
FROM event_processing_log
WHERE status = 'pending_retry'
  AND updated_at > NOW() - INTERVAL '5 minutes'
GROUP BY 1 ORDER BY 1;
-- Expected: flat or declining

-- 3. Alert resolved
SELECT alert_name, resolved_at FROM active_alerts
WHERE alert_name = 'retry_depth';

-- 4. No events stuck in permanently_failed
SELECT COUNT(*) FROM event_processing_log
WHERE status = 'permanently_failed'
  AND updated_at > '[incident_start]';

-- 5. Projection lag normalized
SELECT p95_projection_lag_ms FROM metrics_snapshots
ORDER BY snapped_at DESC LIMIT 3;
-- Expected: < 1000ms
```

---

## Communication Template

> **[Preppa Internal Status — No User Communication Needed Unless Projections Stale > 30 min]**
>
> If projections are visibly stale (order counts wrong, prepper stats wrong) and it has been over 30 minutes:
>
> **[Preppa Notice]**
> We are experiencing a delay in updating some dashboard statistics. Your orders, payments, and listings are unaffected. Stats will catch up automatically within [X] minutes.

---

## Postmortem Questions

1. What was the root cause — edge function bug, schema mismatch, external dependency, or poison-pill payload?
2. How long did the retry queue take to grow from 0 to 500 (our alert threshold), and is that threshold appropriate?
3. How many events exhausted retries and moved to dead letter — and are any permanently unrecoverable?
4. Did `admin_pause_all_actions` create user-visible disruption, or was it transparent?
5. Is there a circuit breaker on the edge function that stops processing when it knows it is failing, rather than queuing retries indefinitely?
6. Should we add a per-event-type retry cap that kills the flag automatically rather than requiring manual operator intervention?
7. What projection data was stale at peak, and for how long were users seeing incorrect information?
