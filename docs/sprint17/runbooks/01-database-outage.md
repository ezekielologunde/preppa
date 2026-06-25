# PostgreSQL Database Outage

**Severity**: Critical
**Affects**: All users — orders, payments, auth, browsing all fail
**MTTR Target**: 60 minutes (Supabase-managed infra; operator role is monitoring + recovery, not repair)

---

## Detection

### Automated Signals
- `active_alerts` table stops updating (no new rows from `refresh-platform-health` pg_cron job)
- `metrics_snapshots` — `MAX(computed_at)` falls more than 2 minutes behind wall clock
- App clients surface `"unable to connect"` or `PostgrestError: connection refused`
- pg_cron jobs fail silently (no new rows in `domain_events` from scheduled projections)

### Manual Checks
```sql
-- From Supabase SQL editor once connectivity is partial:
SELECT MAX(computed_at) FROM platform_health_metrics;
SELECT MAX(snapped_at)  FROM metrics_snapshots;
SELECT COUNT(*)         FROM domain_events
  WHERE created_at > NOW() - INTERVAL '5 minutes';
```

### External Sources
- Supabase status page: https://status.supabase.com
- Supabase dashboard → project `nfwfnnfbikjxwflpmsnu` → health indicators

---

## Immediate Containment (< 5 minutes)

1. **Confirm the outage** — load https://status.supabase.com; distinguish full DB down vs. partial (Auth up, PostgREST down).
2. **Attempt feature-flag kill switch** — if the DB is partially reachable, disable new order creation:
   ```sql
   UPDATE feature_flags
   SET kill_switch = TRUE, updated_at = NOW()
   WHERE flag_key = 'order_creation_enabled';
   ```
   If DB is fully unreachable, skip this step; the app will error on its own.
3. **Post status communication** to users (see Communication Template below).
4. **Open a Supabase support ticket** if the status page shows no active incident after 5 minutes.
5. **Do not attempt DB-side fixes** — this is Supabase-managed infrastructure.

---

## Impact Assessment

| Component | Status |
|-----------|--------|
| Order placement | Completely down |
| Payment processing | Completely down |
| Auth / login | Down (JWT validation requires DB) |
| Read browsing (cached) | Partial — depends on client cache |
| Admin control plane | Down |
| pg_cron jobs | Silently failing — will resume on restore |
| Event bus | Stalled — events will accumulate in transit |

**What is NOT affected**: Stripe webhooks queue on Stripe's side; they retry for 72 hours.

---

## Recovery Procedure

### Step 1 — Wait for Supabase restoration
Monitor https://status.supabase.com. Supabase posts updates at 15-minute intervals during incidents.

### Step 2 — Verify connectivity
```sql
SELECT 1; -- basic connectivity
SELECT COUNT(*) FROM domain_events;
SELECT MAX(computed_at) FROM platform_health_metrics;
```

### Step 3 — Re-enable feature flags
```sql
UPDATE feature_flags
SET kill_switch = FALSE, updated_at = NOW()
WHERE flag_key = 'order_creation_enabled'
  AND kill_switch = TRUE;
```

### Step 4 — Verify pg_cron jobs resumed
```sql
-- Check cron job last run times
SELECT jobname, last_run, next_run, last_run_duration
FROM cron.job_run_details
ORDER BY last_run DESC
LIMIT 20;
```
If any job has not run since the outage ended, manually invoke it:
```sql
SELECT cron.schedule_in_database('refresh-platform-health', '* * * * *', $$SELECT refresh_platform_health()$$);
```

### Step 5 — Rebuild projections that missed events
```sql
-- Find events during outage window that may not have been projected
SELECT event_type, COUNT(*)
FROM domain_events
WHERE created_at BETWEEN '[outage_start]' AND '[outage_end]'
  AND processed_at IS NULL
GROUP BY event_type;

-- Rebuild if drift found
SELECT admin_rebuild_projection('order_created', FALSE, 'db-outage-recovery');
SELECT admin_rebuild_projection('payment_captured', FALSE, 'db-outage-recovery');
```

### Step 6 — Inspect and replay dead letters
```sql
-- Events that hit the dead letter queue during outage
SELECT id, event_type, final_error, created_at
FROM event_dead_letters
WHERE resolved_at IS NULL
  AND created_at BETWEEN '[outage_start]' AND NOW()
ORDER BY created_at;

-- Replay each recoverable letter
SELECT admin_replay_dead_letter('[dead_letter_id]');
```

### Step 7 — Check Stripe webhook backlog
Log in to Stripe dashboard → Developers → Webhooks → your endpoint → Failed deliveries. Manually retry any webhooks that failed during the outage window.

---

## Verification

```sql
-- 1. Platform health refreshed
SELECT computed_at, overall_health_score
FROM platform_health_metrics
ORDER BY computed_at DESC
LIMIT 1;
-- computed_at should be within last 2 minutes

-- 2. Metrics snapshotting resumed
SELECT snapped_at FROM metrics_snapshots ORDER BY snapped_at DESC LIMIT 1;
-- should be within last 2 minutes

-- 3. No unprocessed events older than 5 minutes
SELECT COUNT(*) FROM domain_events
WHERE processed_at IS NULL
  AND created_at < NOW() - INTERVAL '5 minutes';
-- should be 0

-- 4. No new dead letters from outage window
SELECT COUNT(*) FROM event_dead_letters
WHERE resolved_at IS NULL
  AND created_at > '[outage_start]';

-- 5. Retry queue drained
SELECT COUNT(*) FROM event_processing_log
WHERE status = 'pending_retry';
-- should be low (< 10)
```

---

## Communication Template

> **[Preppa Status Update]**
> We experienced a database outage from approximately [HH:MM] to [HH:MM] [TZ]. During this window, orders, payments, and logins were unavailable.
>
> Service has been fully restored. All existing orders and payments are intact — no data was lost.
>
> If you attempted to place an order during the outage, please try again. We apologize for the disruption.

---

## Postmortem Questions

1. What was the root cause on Supabase's side — hardware, network, Postgres process, storage?
2. How long did it take for our monitoring to detect the outage, and was the alert threshold appropriate?
3. Were any domain events permanently lost, or did the dead-letter queue capture all failures?
4. Did any Stripe webhooks fail permanently (exceeded retry window), and what is the remediation?
5. Did the feature-flag kill switch reach the client before users encountered errors, or did clients see raw DB errors?
6. Is there a read-only fallback (CDN-cached meal listings) we can show during DB unavailability?
7. What SLA does Supabase provide, and does this incident breach it — triggering a credit request?
