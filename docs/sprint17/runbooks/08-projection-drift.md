# Projection Drift (Stale Read Models)

**Severity**: Medium–High (depends on which projection is drifting)
**Affects**: Admin dashboards, prepper stats, order counts, platform metrics — read models show incorrect data
**MTTR Target**: 30 minutes (rebuild takes 2–10 minutes depending on event volume)

---

## Detection

### Automated Signals
- `metrics_snapshots.p95_projection_lag_ms` > 5000 (5 seconds sustained)
- `active_alerts` fires `projection_lag` alert
- Admin dashboard shows inconsistent counts vs. raw table counts

### Manual Checks
```sql
-- Projection lag from latest snapshot
SELECT
  snapped_at,
  p95_projection_lag_ms,
  avg_projection_lag_ms
FROM metrics_snapshots
ORDER BY snapped_at DESC
LIMIT 5;

-- Compare projected order count to raw count
SELECT 'projected' AS source, total_orders AS count FROM platform_metrics
UNION ALL
SELECT 'raw' AS source, COUNT(*) FROM orders
  WHERE status NOT IN ('cancelled', 'refunded');

-- Compare projected revenue to raw revenue
SELECT 'projected' AS source, total_revenue FROM platform_metrics
UNION ALL
SELECT 'raw' AS source, SUM(amount)
  FROM payments WHERE status = 'captured';

-- Check for unprocessed domain events (events that should have updated projections)
SELECT
  event_type,
  COUNT(*) AS unprocessed_count,
  MIN(created_at) AS oldest
FROM domain_events
WHERE processed_at IS NULL
GROUP BY event_type
ORDER BY oldest;

-- Check projection-specific lag per aggregate
SELECT
  projection_name,
  MAX(last_event_at) AS last_event_processed,
  NOW() - MAX(last_event_at) AS lag
FROM projection_checkpoints
GROUP BY projection_name
ORDER BY lag DESC;
```

---

## Immediate Containment (< 5 minutes)

1. **Confirm it is a projection issue, not a data integrity issue**:
   ```sql
   -- If raw counts match payments table, projection is stale (safe)
   -- If raw counts don't match either, there is a data integrity problem (escalate)
   SELECT COUNT(*) FROM orders WHERE status = 'confirmed';
   SELECT COUNT(*) FROM order_metrics WHERE status = 'confirmed'; -- should match
   ```

2. **Identify which projections are drifting** using the projection lag query above.

3. **Check if domain events are stacking up unprocessed** — this is the most common cause:
   ```sql
   SELECT COUNT(*) FROM domain_events
   WHERE processed_at IS NULL
     AND created_at < NOW() - INTERVAL '5 minutes';
   ```
   If > 0: the event processor is not consuming events → check edge function logs.

4. **Do not take emergency action yet** — if the lag is under 30 seconds, wait and monitor; the pg_cron `snap-metrics` job runs every minute and will show if it's recovering.

---

## Impact Assessment

| Projection | User-Visible Impact if Stale |
|------------|------------------------------|
| `order_metrics` | Order counts wrong on admin dashboard |
| `platform_metrics` | Revenue, order totals wrong on admin dashboard |
| `prepper_stats` | Prepper's order count / rating shown incorrectly |
| `payment_projections` | Payment totals inconsistent with payments table |
| `notification_counters` | Unread badge count incorrect |
| `platform_health_metrics` | Health dashboard showing stale health score |

**User-facing impact**: In most cases, projection drift is visible only to admins and preppers checking their stats. Customers placing orders are unaffected — orders are written to the `orders` table directly and are consistent.

---

## Recovery Procedure

### Step 1 — Diagnose the cause of drift

**Case A: Event processor not consuming events (unprocessed events piling up)**
```sql
SELECT COUNT(*) FROM domain_events WHERE processed_at IS NULL;
-- If high: check edge function health
```
→ Check Supabase Edge Functions logs for `event-processor` errors
→ If error found: fix and redeploy; events will catch up automatically

**Case B: Event processor running but projection handler failing**
```sql
SELECT event_type, error_message, COUNT(*)
FROM event_processing_log
WHERE status IN ('failed', 'pending_retry')
  AND updated_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type, error_message;
```
→ Identify failing event type, fix the handler, trigger rebuild

**Case C: pg_cron jobs not running (platform_health_metrics stale)**
```sql
SELECT jobname, last_run, next_run
FROM cron.job_run_details
WHERE jobname = 'refresh-platform-health'
ORDER BY last_run DESC LIMIT 1;
```
→ If last_run is more than 2 minutes ago: manually invoke
```sql
SELECT refresh_platform_health();
```

**Case D: Rebuild needed (projection got out of sync due to past incident)**
→ Proceed to Step 2

### Step 2 — Rebuild the drifting projection

```sql
-- Rebuild order projection (most common drift target)
SELECT admin_rebuild_projection('order_created', FALSE, 'drift_detected_[YYYY-MM-DD]');

-- Rebuild payment projection
SELECT admin_rebuild_projection('payment_captured', FALSE, 'drift_detected_[YYYY-MM-DD]');

-- Rebuild prepper stats
SELECT admin_rebuild_projection('prepper_stats', FALSE, 'drift_detected_[YYYY-MM-DD]');

-- Rebuild platform health (singleton — safe to always rebuild)
SELECT refresh_platform_health();
```

**Note**: The `FALSE` parameter means "do not truncate first" — the rebuild will upsert. Pass `TRUE` only if you want a full truncate-and-replay (longer, more disruptive).

### Step 3 — Verify projection data matches raw tables
```sql
-- Order count reconciliation
SELECT
  (SELECT total_orders FROM platform_metrics) AS projected_orders,
  (SELECT COUNT(*) FROM orders WHERE status NOT IN ('cancelled', 'refunded')) AS raw_orders;

-- Revenue reconciliation
SELECT
  (SELECT total_revenue FROM platform_metrics) AS projected_revenue,
  (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'captured') AS raw_revenue;
```
Both pairs should match within 1-2 for in-flight events.

### Step 4 — Monitor that lag clears
```sql
SELECT p95_projection_lag_ms, snapped_at
FROM metrics_snapshots
ORDER BY snapped_at DESC LIMIT 5;
-- Should trend toward 0
```

---

## Verification

```sql
-- 1. Projection lag alert resolved
SELECT alert_name, resolved_at FROM active_alerts
WHERE alert_name = 'projection_lag';

-- 2. p95 lag under 1 second
SELECT p95_projection_lag_ms FROM metrics_snapshots
ORDER BY snapped_at DESC LIMIT 1;
-- Expected: < 1000

-- 3. Order counts match
SELECT
  ABS(
    (SELECT total_orders FROM platform_metrics) -
    (SELECT COUNT(*) FROM orders WHERE status NOT IN ('cancelled','refunded'))
  ) AS order_count_delta;
-- Expected: <= 2

-- 4. Revenue matches (allow small float delta)
SELECT
  ROUND(ABS(
    (SELECT total_revenue FROM platform_metrics) -
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'captured')
  ), 2) AS revenue_delta;
-- Expected: < 0.10

-- 5. No unprocessed events older than 5 minutes
SELECT COUNT(*) FROM domain_events
WHERE processed_at IS NULL
  AND created_at < NOW() - INTERVAL '5 minutes';
-- Expected: 0
```

---

## Communication Template

> **[Internal only — projection drift is not user-visible in most cases]**
>
> If prepper stats are visibly wrong for an extended period:
>
> **[Preppa Notice to Prepper]**
> We are aware of a display issue affecting some statistics in your prepper dashboard. Your actual order history and earnings are correct — only the displayed totals may be temporarily inaccurate. This will be corrected automatically within [X] minutes.

---

## Postmortem Questions

1. Which projection was drifting, and for how long before detection?
2. What was the root cause — event processor failure, pg_cron pause, or a missed event during a prior incident?
3. Did the drift cause any admin decisions to be made on incorrect data (e.g., a suspension based on wrong order counts)?
4. Is the `projection_checkpoints` table tracking lag per-projection accurately, and is it part of the alerting pipeline?
5. Should we add a scheduled reconciliation job that compares projected counts to raw counts and alerts on divergence > 5?
6. How long did the `admin_rebuild_projection` take, and did it lock any tables during the rebuild?
7. Is there a way to make projections self-healing (detect their own drift and trigger a rebuild automatically)?
