# Notification Storm

**Severity**: High
**Affects**: All users receive excessive notifications; platform notification infrastructure overloaded
**MTTR Target**: Containment in 5 minutes; root cause + drain in 30 minutes

---

## Detection

### Automated Signals
- `platform_notification_counters.current_minute_count` > 10,000
- Global circuit breaker trips automatically — `security_events` records `notification_storm_detected`
- `active_alerts` fires `notification_storm` alert
- `notifications WHERE created_at > NOW() - INTERVAL '1 minute'` count abnormally high
- Admin dashboard `notification_queue` section shows `unread_count` climbing rapidly

### Manual Checks
```sql
-- Current notification volume (last 5 minutes, bucketed by minute)
SELECT
  DATE_TRUNC('minute', created_at) AS minute,
  notification_type,
  COUNT(*) AS count
FROM notifications
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

-- Platform notification counter state
SELECT
  current_minute_count,
  total_today,
  circuit_breaker_tripped,
  last_reset_at
FROM platform_notification_counters
LIMIT 1;

-- Find the source: which admin action or event type is generating notifications
SELECT
  n.notification_type,
  n.metadata->>'source_event' AS source_event,
  COUNT(*) AS count
FROM notifications n
WHERE n.created_at > NOW() - INTERVAL '10 minutes'
GROUP BY 1, 2
ORDER BY 3 DESC;

-- Check if an admin bulk_notify call caused the storm
SELECT
  admin_id,
  action_type,
  metadata,
  created_at
FROM admin_action_log
WHERE action_type = 'bulk_notify'
  AND created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;

-- Check event_processing_log for notification-emitting events running in a loop
SELECT
  event_type,
  COUNT(*) AS count,
  MIN(created_at) AS first,
  MAX(created_at) AS last
FROM event_processing_log
WHERE created_at > NOW() - INTERVAL '10 minutes'
  AND event_type LIKE '%notification%'
GROUP BY event_type
ORDER BY count DESC;
```

---

## Immediate Containment (< 5 minutes)

1. **Kill the notification feature flag immediately**:
   ```sql
   UPDATE feature_flags
   SET kill_switch = TRUE, updated_at = NOW()
   WHERE flag_key = 'notifications_enabled';
   ```
   This prevents any new notifications from being created. The circuit breaker in `platform_notification_counters` should have already auto-paused sends, but this is the belt-and-suspenders confirmation.

2. **Verify the circuit breaker has tripped**:
   ```sql
   SELECT circuit_breaker_tripped FROM platform_notification_counters;
   -- If FALSE, manually trip it:
   UPDATE platform_notification_counters
   SET circuit_breaker_tripped = TRUE
   WHERE TRUE;
   ```

3. **If an admin RPC is the source** (e.g., someone called `admin_bulk_notify` with bad parameters), pause all admin actions:
   ```sql
   SELECT admin_pause_all_actions('notification_storm_containment');
   ```

4. **Check if the storm is still generating rows** — run the volume query from Detection above twice, 30 seconds apart. If count is still climbing after the flag kill switch, the source is bypassing the flag (edge function or DB trigger):
   ```sql
   -- Find DB-level triggers that emit notifications
   SELECT trigger_name, event_object_table, action_statement
   FROM information_schema.triggers
   WHERE trigger_name LIKE '%notif%';
   ```

---

## Impact Assessment

| Component | Status |
|-----------|--------|
| User notification inbox | Flooded with duplicate/erroneous notifications |
| Notification badge count | Inflated / unreliable |
| Push notification delivery | Not yet live (Sprint 18) — no push spam risk |
| Order placement | Unaffected |
| Payments | Unaffected |
| DB write load | Elevated — notifications table growing rapidly |
| Event bus | Potentially backing up if notification events are looping |

**Sprint 18 note**: Push notifications are not yet wired to Expo Push. The storm is contained to in-app notification rows. No external push spam is being sent to devices.

---

## Recovery Procedure

### Step 1 — Identify the amplification source

**Source category A — Admin bulk_notify with bad filter:**
```sql
SELECT metadata FROM admin_action_log
WHERE action_type = 'bulk_notify'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC LIMIT 5;
```
If found: the admin RPC fired with an overly broad user filter. Stop via flag kill switch (already done).

**Source category B — Event processing loop (event A triggers notification, notification triggers event A):**
```sql
SELECT event_type, COUNT(*), MIN(created_at), MAX(created_at)
FROM domain_events
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY event_type
ORDER BY COUNT(*) DESC LIMIT 10;
```
If one event type is in the millions: it is in a loop. Disable the event handler:
```sql
UPDATE feature_flags
SET kill_switch = TRUE
WHERE flag_key = '[event_source_flag]';
```

**Source category C — Edge function bug (deploy with runaway notification emit):**
Check Supabase Edge Functions → `event-processor` logs for repeated notification inserts from a single invocation.
→ Roll back the edge function deployment:
```bash
supabase functions deploy event-processor --project-ref nfwfnnfbikjxwflpmsnu
# (redeploy the last known-good version from git)
```

### Step 2 — Assess the backlog

```sql
-- How many duplicate/erroneous notifications were created?
SELECT
  user_id,
  notification_type,
  COUNT(*) AS duplicate_count
FROM notifications
WHERE created_at BETWEEN '[storm_start]' AND '[storm_end]'
GROUP BY user_id, notification_type
HAVING COUNT(*) > 5
ORDER BY duplicate_count DESC
LIMIT 20;

-- Total storm volume
SELECT COUNT(*) FROM notifications
WHERE created_at BETWEEN '[storm_start]' AND '[storm_end]';
```

### Step 3 — Decide: keep or purge the storm notifications

**Option A: Purge (if notifications are clearly erroneous/duplicate):**
```sql
-- Soft-delete the storm notifications (preserve for audit, hide from users)
UPDATE notifications
SET deleted_at = NOW(),
    metadata = metadata || jsonb_build_object('purge_reason', 'notification_storm_[date]')
WHERE created_at BETWEEN '[storm_start]' AND '[storm_end]'
  AND notification_type = '[storm_type]';

-- If hard delete is necessary (volume threatens table performance):
DELETE FROM notifications
WHERE created_at BETWEEN '[storm_start]' AND '[storm_end]'
  AND notification_type = '[storm_type]';
```

**Option B: Retain (if notifications were legitimate but duplicated):**
Mark duplicates as read to clear badge count:
```sql
UPDATE notifications
SET read_at = NOW()
WHERE created_at BETWEEN '[storm_start]' AND '[storm_end]'
  AND read_at IS NULL
  AND notification_type = '[storm_type]';
```

### Step 4 — Reset the circuit breaker
```sql
UPDATE platform_notification_counters
SET
  current_minute_count = 0,
  circuit_breaker_tripped = FALSE,
  last_reset_at = NOW()
WHERE TRUE;
```

### Step 5 — Re-enable notifications (gradual rollout)
```sql
-- Start at 10% of users
UPDATE feature_flags
SET
  kill_switch = FALSE,
  global_rollout_pct = 10,
  updated_at = NOW()
WHERE flag_key = 'notifications_enabled';

-- Monitor for 5 minutes — if volume is normal, increase:
-- SELECT current_minute_count FROM platform_notification_counters;

-- Increase to 50%
UPDATE feature_flags SET global_rollout_pct = 50 WHERE flag_key = 'notifications_enabled';

-- Full rollout after another 5 minutes of clean operation
UPDATE feature_flags SET global_rollout_pct = 100 WHERE flag_key = 'notifications_enabled';
```

### Step 6 — Resume admin actions (if paused)
```sql
SELECT admin_resume_all_actions('notification_storm_resolved');
```

---

## Verification

```sql
-- 1. Notification volume back to normal
SELECT COUNT(*) FROM notifications
WHERE created_at > NOW() - INTERVAL '1 minute';
-- Expected: < 100 (normal rate)

-- 2. Circuit breaker not re-tripping
SELECT circuit_breaker_tripped, current_minute_count
FROM platform_notification_counters;
-- circuit_breaker_tripped: FALSE; current_minute_count: < 1000

-- 3. Storm alert resolved
SELECT alert_name, resolved_at FROM active_alerts
WHERE alert_name = 'notification_storm';

-- 4. Feature flag at 100%
SELECT flag_key, kill_switch, global_rollout_pct
FROM feature_flags
WHERE flag_key = 'notifications_enabled';
-- kill_switch: FALSE; global_rollout_pct: 100

-- 5. Event processing loop stopped
SELECT COUNT(*) FROM domain_events
WHERE created_at > NOW() - INTERVAL '1 minute';
-- Expected: < 50 (normal event rate)

-- 6. No new dead letters from notification-related events
SELECT COUNT(*) FROM event_dead_letters
WHERE event_type LIKE '%notification%'
  AND created_at > '[storm_start]'
  AND resolved_at IS NULL;
```

---

## Communication Template

> **[Preppa Notice]**
> We experienced a technical issue earlier today that may have caused you to receive duplicate notifications. We apologize for the confusion — no action is required on your part.
>
> All duplicate notifications have been cleared. Your orders, payments, and account are unaffected.

---

## Postmortem Questions

1. What was the root cause — admin RPC bug, event processing loop, or edge function regression?
2. Did the circuit breaker in `platform_notification_counters` trip automatically as designed, and within what time?
3. How many unique users received erroneous notifications, and were they notified of the issue?
4. Did the storm cause measurable DB write latency or storage growth that affected other platform operations?
5. Was the gradual re-enable rollout (10% → 50% → 100%) necessary, or could we have restored at 100% safely?
6. Should the `admin_bulk_notify` RPC require a confirmation step with a hard cap on recipient count?
7. With push notifications arriving in Sprint 18, what safeguards do we need to add before wiring Expo Push to prevent a storm from reaching devices?
