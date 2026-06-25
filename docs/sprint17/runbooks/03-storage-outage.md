# Supabase Storage Outage

**Severity**: High
**Affects**: Preppers uploading meal photos; users viewing meal images (broken image URLs); media pipeline stalls
**MTTR Target**: 30 minutes (active operator work); image serving may lag until CDN cache warms

---

## Detection

### Automated Signals
- `platform_health_metrics.storage_pending_count` > 50
- `active_alerts` fires `storage_backlog` alert
- Edge function `process-media` returns 5xx errors logged in Supabase Edge Function logs
- `media_objects` pipeline shows accumulation of stuck records:

```sql
SELECT pipeline_status, COUNT(*)
FROM media_objects
WHERE uploaded_at < NOW() - INTERVAL '15 minutes'
GROUP BY pipeline_status;
-- Healthy: all should be 'confirmed' or recent 'pending'
-- Unhealthy: 'pending' or 'validating' counts growing
```

### Manual Checks
```sql
-- Identify stuck objects with precise timestamps
SELECT id, pipeline_status, uploaded_at, confirmed_at, owner_id, media_type
FROM media_objects
WHERE pipeline_status IN ('pending', 'validating')
  AND uploaded_at < NOW() - INTERVAL '30 minutes'
ORDER BY uploaded_at;

-- Check if any objects have been stuck for over an hour
SELECT COUNT(*) FROM media_objects
WHERE pipeline_status = 'pending'
  AND uploaded_at < NOW() - INTERVAL '60 minutes';
```

### External Sources
- Supabase status page: https://status.supabase.com — check "Storage" component
- Supabase dashboard → Storage → verify bucket `meal-images` is accessible
- Attempt a manual upload in the Supabase Storage UI to confirm the outage

---

## Immediate Containment (< 5 minutes)

1. **Confirm storage is unreachable**:
   ```sql
   -- Try listing storage objects (will fail if storage is down)
   SELECT * FROM storage.objects LIMIT 1;
   ```
2. **Disable upload feature flag** to prevent users from attempting uploads that will fail:
   ```sql
   UPDATE feature_flags
   SET kill_switch = TRUE, updated_at = NOW()
   WHERE flag_key = 'media_uploads_enabled';
   ```
3. **Do not reject or delete pending media_objects yet** — wait for storage restoration; objects can be retried.
4. **Check if served image URLs are broken** — Supabase Storage CDN may still serve cached images even when uploads fail. Test a known-good URL in a browser.
5. **Post status communication** (see template below).

---

## Impact Assessment

| Component | Status |
|-----------|--------|
| New meal photo uploads | Failing |
| Existing meal images (CDN cached) | Likely still serving |
| Prepper profile photos | Failing for new uploads |
| Media pipeline (begin_upload → confirm) | Stalled |
| Order placement | Unaffected |
| Payments | Unaffected |
| Browse / search | Unaffected (images may be broken) |

---

## Recovery Procedure

### Step 1 — Wait for Supabase Storage restoration
Monitor https://status.supabase.com. Storage incidents typically resolve in 15–45 minutes.

### Step 2 — Re-enable upload feature flag
```sql
UPDATE feature_flags
SET kill_switch = FALSE, updated_at = NOW()
WHERE flag_key = 'media_uploads_enabled'
  AND kill_switch = TRUE;
```

### Step 3 — Let pg_cron cleanup handle stale uploads
The `cleanup_stale_uploads` pg_cron job runs every hour and automatically reverts `pending` uploads older than the staleness threshold back to `needs_upload`. Verify the next scheduled run:
```sql
SELECT jobname, next_run FROM cron.job_run_details
WHERE jobname = 'cleanup-stale-uploads'
ORDER BY next_run DESC LIMIT 1;
```

If the next run is more than 30 minutes away and you need immediate cleanup:
```sql
-- Manually invoke the cleanup function
SELECT cleanup_stale_uploads();
```

### Step 4 — Handle stuck 'validating' objects
Objects stuck in `validating` status need manual rejection; pg_cron does not handle this state:
```sql
-- Find all stuck validating objects
SELECT id, owner_id, media_type, uploaded_at
FROM media_objects
WHERE pipeline_status = 'validating'
  AND uploaded_at < NOW() - INTERVAL '30 minutes';

-- Reject each one (replace [id] with actual UUID):
SELECT reject_media('[id]', 'storage_outage_recovery');
```

### Step 5 — Notify affected preppers
Query which preppers had uploads fail during the outage window and surface an in-app prompt:
```sql
SELECT DISTINCT owner_id, media_type
FROM media_objects
WHERE pipeline_status IN ('failed', 'rejected')
  AND updated_at BETWEEN '[outage_start]' AND '[outage_end]';
```

### Step 6 — Verify CDN cache is serving images correctly
Test public image URLs from the `media_objects.public_url` field for recently confirmed objects:
```sql
SELECT public_url FROM media_objects
WHERE pipeline_status = 'confirmed'
ORDER BY confirmed_at DESC LIMIT 5;
```
Open each URL in a browser and confirm images load.

---

## Verification

```sql
-- 1. No stuck pending objects older than 30 minutes
SELECT COUNT(*) FROM media_objects
WHERE pipeline_status = 'pending'
  AND uploaded_at < NOW() - INTERVAL '30 minutes';
-- Expected: 0

-- 2. No stuck validating objects
SELECT COUNT(*) FROM media_objects
WHERE pipeline_status = 'validating'
  AND uploaded_at < NOW() - INTERVAL '15 minutes';
-- Expected: 0

-- 3. Storage alert cleared
SELECT alert_name, resolved_at FROM active_alerts
WHERE alert_name = 'storage_backlog';
-- resolved_at should be populated

-- 4. Storage pending count normalized
SELECT storage_pending_count FROM platform_health_metrics
ORDER BY computed_at DESC LIMIT 1;
-- Expected: < 5

-- 5. Feature flag re-enabled
SELECT kill_switch FROM feature_flags
WHERE flag_key = 'media_uploads_enabled';
-- Expected: FALSE
```

---

## Communication Template

> **[Preppa Status Update]**
> We experienced a file storage issue from approximately [HH:MM] to [HH:MM] [TZ]. During this window, meal photo uploads were unavailable and some images may not have displayed correctly.
>
> Service has been restored. If your upload failed during this time, please try again — your account and listings are unaffected.
>
> We apologize for the inconvenience.

---

## Postmortem Questions

1. Were any media_objects permanently lost — i.e., the file was uploaded to storage but the DB record was rejected, or vice versa?
2. Did `cleanup_stale_uploads` pg_cron job run on schedule during the outage, and if not, when did it resume?
3. How many preppers were actively uploading during the outage window, and were they notified?
4. Did broken image URLs in meal listings cause any measurable drop in order conversion during the outage?
5. Should we add a storage health check to `platform_health_metrics` that probes a canary object on every snapshot cycle?
6. Is the 30-minute staleness threshold for stale upload detection appropriate, or should we lower it?
7. Do we need a `storage_validating_timeout` pg_cron job to complement `cleanup_stale_uploads`?
