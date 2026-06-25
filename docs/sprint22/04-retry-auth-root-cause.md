# F-04: Retry Auth Root Cause — dispatch_retry_events 401 Failure

## The Bug

**File:** `supabase/migrations/20260622225734_005_reliability_layer.sql`
**Function:** `public.dispatch_retry_events()`
**Lines:** 115–119

The pg_net call in the retry loop:

```sql
PERFORM net.http_post(
  url     := 'https://nfwfnnfbikjxwflpmsnu.supabase.co/functions/v1/event-processor',
  headers := jsonb_build_object('Content-Type', 'application/json'),
  body    := row_to_json(v_rec)::JSONB
);
```

The `headers` object contains only `Content-Type`. There is no `Authorization` header.

## How the Edge Function Validates Requests

`supabase/functions/event-processor/index.ts` lines 230–232:

```ts
if (WEBHOOK_SECRET) {
  const secret = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (secret !== WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 })
}
```

`WEBHOOK_SECRET` is set in production via the Supabase Edge Function secrets (`WEBHOOK_SECRET` env var). When present, every request that doesn't supply the correct `Bearer` token is rejected with 401 — including all retry attempts from `dispatch_retry_events`.

## How dispatch_to_event_processor Does It Correctly

`supabase/migrations/20260622200637_004_event_processor_webhook.sql` lines 16–23:

```sql
BEGIN
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SERVICE_ROLE_KEY'
  LIMIT 1;
EXCEPTION WHEN OTHERS THEN
  v_service_role_key := '';
END;
```

Then passes it in the `pg_net.http_post` call:

```sql
headers := jsonb_build_object(
  'Content-Type',  'application/json',
  'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
)
```

**Vault secret name:** `SERVICE_ROLE_KEY`

The service-role JWT satisfies the edge function's `WEBHOOK_SECRET` check because both values are set to the same Supabase service-role key in production.

## Why 401s Are Silent

`pg_net.http_post` is fire-and-forget. It schedules the HTTP call, returns immediately, and stores the response asynchronously in `net._http_response`. The PostgreSQL caller sees no error; `dispatch_retry_events` increments `v_count` and marks the log row as `processing` even though the remote call will be rejected. The event then stays in `processing` indefinitely (it will not be retried again because only `pending_retry` rows are eligible). This causes the retry queue to appear to drain but events are never actually processed.

## How to Observe the Failures

Query the pg_net response table directly:

```sql
SELECT id, status_code, error_msg, created
FROM net._http_response
WHERE status_code IN (401, 403)
ORDER BY created DESC
LIMIT 50;
```

After applying migration 025, `check_retry_auth_failures()` does this check every 5 minutes and writes the count to `platform_health_metrics.retry_auth_failures_5min`. The admin dashboard RPC (`admin_get_dashboard`) returns this via `row_to_json(h)`.

## Verifying the Fix

After applying migration 025 (`20260623000500_025_retry_authentication.sql`):

1. Trigger a domain event that will fail on first attempt so it enters `pending_retry`.
2. Wait for `dispatch_retry_events` to fire (scheduled via pg_cron in migration 014).
3. Check that the response is 200, not 401:

```sql
SELECT status_code, created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;
```

4. Verify the event_processing_log row transitions to `success` or back to `pending_retry` (on real failure), not stuck in `processing`.
5. Confirm `platform_health_metrics.retry_auth_failures_5min` reads 0 in the admin dashboard.
