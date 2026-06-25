# Supabase Service Outage (Auth / API)

**Severity**: Critical
**Affects**: All authenticated users — logins fail, existing sessions may not be validated, all PostgREST API calls fail
**MTTR Target**: 45 minutes (Supabase-managed; operator role is containment + communication)

---

## Detection

### Automated Signals
- Expo app returns `AuthApiError` or `401 Unauthorized` on all API calls
- `metrics_snapshots.api_error_rate` spikes above baseline
- `active_alerts` entry fires for `api_error_rate` threshold breach
- New user registrations and logins drop to zero in `auth.users` insert rate

### Manual Checks
```sql
-- From Supabase SQL editor (if DB is reachable but PostgREST is not):
SELECT COUNT(*) FROM auth.users
WHERE created_at > NOW() - INTERVAL '10 minutes';
-- Should match expected sign-up rate; zero = likely Auth outage

-- Check if PostgREST itself is healthy (from app logs):
-- HTTP 503 from https://nfwfnnfbikjxwflpmsnu.supabase.co/rest/v1/ = PostgREST down
-- HTTP 401 on all valid JWTs = GoTrue Auth down
```

### External Sources
- Supabase status page: https://status.supabase.com — check "Auth" and "API" components separately
- Supabase dashboard: project `nfwfnnfbikjxwflpmsnu` → API health indicator

### Distinguishing Auth-only vs. Full API Outage
```sql
-- If DB is reachable via SQL editor but REST API returns 503:
-- → PostgREST process down (not Auth)
-- If SQL editor also fails: → full DB outage (use Runbook 01)
-- If SQL editor works but JWTs rejected system-wide: → GoTrue Auth down
SELECT NOW(); -- if this works, DB is up; Auth/PostgREST layer is the issue
```

---

## Immediate Containment (< 5 minutes)

1. **Confirm component** — distinguish GoTrue (Auth) vs. PostgREST (REST API) vs. full DB using the checks above.
2. **Do not force-expire user sessions** — wait for Supabase to restore; premature session invalidation will force all users to re-login unnecessarily.
3. **If PostgREST is down but DB is up**, enable the maintenance mode flag via direct SQL (Supabase SQL editor remains available):
   ```sql
   UPDATE feature_flags
   SET kill_switch = TRUE, updated_at = NOW()
   WHERE flag_key IN ('order_creation_enabled', 'payments_enabled');
   ```
4. **If GoTrue Auth is down**, no SQL action is needed — unauthenticated reads (if any) still work; authenticated endpoints self-fail.
5. **Post status communication** immediately (see template below).
6. **Open Supabase support ticket** if no active incident posted within 10 minutes.

---

## Impact Assessment

| Component | Auth Down | PostgREST Down | Both Down |
|-----------|-----------|----------------|-----------|
| New logins | Fail | Fail | Fail |
| Existing sessions (in-app) | JWT validation fails | API calls fail | All fail |
| Order placement | Blocked | Blocked | Blocked |
| Payments | Blocked | Blocked | Blocked |
| Admin control plane | Down | Down | Down |
| DB-direct (SQL editor) | Works | Works | Fails |
| Edge Functions | Works (no auth) | Works | Fails |

**Stripe webhooks**: continue queuing on Stripe's side; retry for 72 hours.
**pg_cron**: unaffected — runs in the DB layer; projections continue if DB is up.

---

## Recovery Procedure

### Step 1 — Monitor Supabase status
Refresh https://status.supabase.com every 5 minutes. Supabase typically resolves Auth incidents within 30 minutes.

### Step 2 — Verify Auth restored
```bash
# From a terminal, test a token refresh:
curl -X POST https://nfwfnnfbikjxwflpmsnu.supabase.co/auth/v1/token?grant_type=refresh_token \
  -H "apikey: [SUPABASE_ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "[any_valid_refresh_token]"}'
# Expected: 200 with new access_token
```

### Step 3 — Verify PostgREST restored
```bash
curl -X GET https://nfwfnnfbikjxwflpmsnu.supabase.co/rest/v1/feature_flags?select=flag_key&limit=1 \
  -H "apikey: [SUPABASE_ANON_KEY]"
# Expected: 200 with JSON array
```

### Step 4 — Re-enable feature flags
```sql
UPDATE feature_flags
SET kill_switch = FALSE, updated_at = NOW()
WHERE flag_key IN ('order_creation_enabled', 'payments_enabled')
  AND kill_switch = TRUE;
```

### Step 5 — Verify RLS policies are enforcing correctly
After an Auth outage, confirm that `auth.uid()` context is restored and RLS is not bypassed:
```sql
-- Should return 0 (no rows visible without auth context)
SET LOCAL role = anon;
SELECT COUNT(*) FROM orders;
RESET role;
```

### Step 6 — Check for failed events during outage
```sql
SELECT COUNT(*) FROM event_dead_letters
WHERE resolved_at IS NULL
  AND created_at > NOW() - INTERVAL '2 hours';

-- Replay recoverable letters
SELECT id, event_type FROM event_dead_letters
WHERE resolved_at IS NULL ORDER BY created_at;
-- For each: SELECT admin_replay_dead_letter('[id]');
```

### Step 7 — Force client token refresh (if needed)
If users report being logged out post-restore, send an in-app notification (once push is live in Sprint 18) or surface an in-app banner prompting re-authentication. For now, direct users to close and reopen the app.

---

## Verification

```sql
-- 1. New auth events flowing
SELECT COUNT(*) FROM auth.audit_log_entries
WHERE created_at > NOW() - INTERVAL '5 minutes';
-- Should be non-zero if any users are active

-- 2. API error rate normalized
SELECT api_error_rate, snapped_at
FROM metrics_snapshots
ORDER BY snapped_at DESC LIMIT 5;

-- 3. Active alerts cleared
SELECT alert_name, triggered_at, resolved_at
FROM active_alerts
WHERE alert_name = 'api_error_rate';

-- 4. Feature flags restored
SELECT flag_key, kill_switch FROM feature_flags
WHERE flag_key IN ('order_creation_enabled', 'payments_enabled');
-- kill_switch should be FALSE

-- 5. RLS identity helper working
SELECT auth.uid(); -- run as authenticated user; should return their UUID
```

---

## Communication Template

> **[Preppa Status Update]**
> We experienced an authentication and API outage from approximately [HH:MM] to [HH:MM] [TZ]. During this window, logging in and all app features were unavailable.
>
> Service has been fully restored. Your account, orders, and payment information are intact.
>
> If you were logged out, please open the app and log in again. We apologize for the disruption.

---

## Postmortem Questions

1. Was this a GoTrue (Auth) outage, a PostgREST outage, or both — and did our monitoring correctly distinguish the two?
2. Did any in-flight order or payment transactions fail mid-flight due to session expiry, and is there a recovery path for those users?
3. Were RLS policies fully enforced immediately after Auth restored, or was there a window of looser enforcement?
4. How long did users experience errors before our status communication went out?
5. Should we implement a read-only "degraded mode" that allows meal browsing without auth during Auth outages?
6. Do we have a runbook for manually invalidating specific compromised sessions if GoTrue is up but behaving unexpectedly?
7. What is the detection-to-alert latency for Auth outages, and is it under our 2-minute target?
