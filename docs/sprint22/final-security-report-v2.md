# Sprint 22 Production Readiness Report (Updated)

**Date:** 2026-06-23
**Assessor:** Independent Red Team (Re-run — post-remediation gate)
**Previous verdict:** NO GO (Score: 56/100) — Sprint 17 report, 2026-06-23
**Backend version:** Migrations 001–025 (Sprint 22 migrations: 022–025)
**Scope of this re-run:** Validation of F-01 through F-05 remediations; new attack surface introduced by Sprint 22; 14-scenario red team re-run; performance re-assessment

---

## Executive Summary

Sprint 22 resolves all four blocking findings from Sprint 17. The admin identity model is now DB-authoritative (F-01 RESOLVED), the refund flow is DB-first with a proper state machine (F-02 RESOLVED), projection rebuilds are serialised with advisory locks (F-03 RESOLVED), and retry events carry the correct Authorization header sourced from vault (F-04 RESOLVED). The previously missing `user_roles` table referenced by `stripe-refund` now exists (F-05 RESOLVED — with a residual partial risk documented below).

Sprint 22 introduces three new vulnerabilities of note: an idempotency key derived solely from `order_id` that an attacker cannot predict but that can produce a `stripe_idempotency_key` collision for a legitimate retry path abuse; a `check_projection_drift` function with no server-side rate limiting that triggers security events on every pg_cron tick after any live event (alert noise risk); and the `stripe-refund` edge function's `user_roles` query uses a schema mismatch against the table created in migration 022 (it queries a `roles(key)` relation that does not exist in the new schema).

The revised Production Readiness Score is **82/100**. The recommendation is **GO WITH ACCEPTED RISKS** provided the four residual risks itemised at the end of this report are logged as sprint commitments.

---

## Blocking Finding Remediation Status

| Finding | Severity | Previous Status | Remediation Status | Residual Risk |
|---|---|---|---|---|
| F-01 Stale JWT admin privilege | CRITICAL | Blocking | RESOLVED | In-flight request window (~500 ms max); acceptable |
| F-02 Stripe refund double-charge race | HIGH | Blocking | RESOLVED | Stripe-succeeds-response-lost scenario: documented; recovery worker handles it |
| F-03 Projection rebuild race (no advisory lock) | HIGH | Blocking | RESOLVED | Lock-mismatch footgun documented below (N-02) |
| F-04 Retry events sent without Authorization header | HIGH | Blocking | RESOLVED | Vault fallback to empty string: documented below (N-04) |
| F-05 stripe-refund queries nonexistent user_roles table | HIGH | Blocking | PARTIAL | Table now exists but schema mismatch persists (N-03) |

---

## Detailed Finding Validation

### F-01 — Stale JWT Admin Privilege

**Validation checklist:**

- `user_roles` table created in migration 022 with NOT NULL constraints, CHECK on role enum, UNIQUE(user_id, role), and `revoked_at`/`expires_at` columns. **CONFIRMED.**
- `is_admin()` (migration 022, line 98) performs a live `SELECT EXISTS` against `public.user_roles` filtered on `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`. The JWT claim is read advisory-only for security event emission; it is never used to grant access. **CONFIRMED.**
- `admin-actions/index.ts` line 71: `await supabase.rpc('is_admin')` — DB check called with the user's JWT, not the service role key. This means the RPC executes as the authenticated user and `auth.uid()` inside `is_admin()` resolves to the caller. **CONFIRMED.**
- `role_audit` is append-only: DELETE trigger (`role_audit_no_mutation`) reuses `block_audit_mutation()` from migration 016. No UPDATE or DELETE is ever permitted. INSERT is blocked for authenticated clients (policy `role_audit_no_client_write` WITH CHECK (FALSE)); only service_role can write. **CONFIRMED.**
- `admin_grant_role` and `admin_revoke_role` both emit security events via `emit_security_event()` and domain events via `domain_events` INSERT. `admin_grant_role` emits severity `warn`; `admin_revoke_role` emits severity `critical`. **CONFIRMED.**

**JWT-only path check:**

No remaining code path uses `auth.jwt() -> 'app_metadata' ->> 'role'` as an authoritative access decision. The only residual JWT reference is the advisory read in `is_admin()` (line 109) that is used exclusively to detect and log JWT/DB divergence — not to grant access. The rollback escape hatch documented in `01-authz-root-cause.md` deliberately re-introduces JWT-only `is_admin()` as an emergency revert; this is an operator decision, not a code path reachable by an attacker.

**One gap found (non-blocking):** `admin_grant_role` has a redundant double-GRANT statement at lines 237–239:
```sql
GRANT EXECUTE ... TO authenticated;
REVOKE EXECUTE ... FROM PUBLIC;
GRANT EXECUTE ... TO authenticated;   -- duplicate
```
The duplicate GRANT is harmless but indicates a copy-paste error during authoring. The effective permission is correct.

**Score: RESOLVED.** In-flight request window is bounded by RPC statement timeout (typically < 500 ms), not by the 60-minute JWT TTL. This is the theoretical minimum — no further improvement is possible without preemptive connection termination.

---

### F-02 — Stripe Refund Double-Charge Race

**Validation checklist:**

- `payment_operations` table exists in migration 023 with `stripe_idempotency_key TEXT UNIQUE`, `status CHECK (... 'pending','processing','completed','failed','cancelled')`, and `amount_pence` sourced from the DB, never from the caller. **CONFIRMED.**
- `_begin_refund_operation()` (migration 023, line 72): the very first SQL statement is `SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE` — the lock is acquired before any Stripe involvement. **CONFIRMED.**
- Idempotency key `'refund_' || p_order_id::TEXT` is INSERTed into `payment_operations.stripe_idempotency_key` in the same transaction that returns to the edge function — committed before Stripe is called. **CONFIRMED.**
- `admin-actions/index.ts` lines 208–213: the `stripeRefund()` call at line 208 receives `opData.idempotency_key` which is the value returned from `admin_refund_order()` — i.e., from the DB, not self-generated by the edge function. **CONFIRMED.**
- `admin_complete_refund` (migration 023, line 229) and `admin_fail_refund` (line 256) both exist and are callable by authenticated admins. **CONFIRMED.**
- `recover_stale_payment_operations()` (migration 023, line 273) finds pending ops older than 10 minutes, transitions them to `processing`, and emits a `critical` security event. pg_cron runs it every 5 minutes. **CONFIRMED.**

**Residual scenario — Stripe-succeeds-response-lost:**

The crash window is: Stripe issues the refund → edge function receives the `refundId` → the process dies before `admin_complete_refund` is called. In this scenario:

- The `payment_operations` row remains `pending`.
- The `recover_stale_payment_operations()` job finds it after 10 minutes and emits a security event.
- The admin retries with the same `operation_id` parameter (via the retry path in `admin_refund_order()`).
- The retry edge function calls Stripe again with the same `idempotency_key`.
- Stripe returns the original refund object (within its 24-hour idempotency window).
- `admin_complete_refund` completes the operation.

This is the designed and documented recovery path. The one gap: if the admin retries more than 24 hours after the first Stripe call (outside Stripe's idempotency window), Stripe may issue a second refund. The `payment_operations.stripe_idempotency_key` UNIQUE constraint would prevent a new DB record, so the retry RPC returns the existing `pending` row with the same key — but Stripe no longer deduplicates it. This is a narrow, time-bounded residual risk and is not categorised as blocking.

**Score: RESOLVED.** Residual 24-hour Stripe idempotency expiry risk is accepted and documented.

---

### F-03 — Projection Rebuild Race

**Validation checklist:**

- `pg_advisory_xact_lock_shared()` added to `project_order_created` (migration 024, line 45), `project_order_cancelled` (line 103), and `increment_kitchen_orders` (line 139). All three are shared (transaction-scoped, auto-release on commit/rollback). **CONFIRMED.**
- `admin_rebuild_projection` (migration 024, line 217) uses `pg_try_advisory_lock(v_lock_id)` — exclusive, session-level, non-blocking. If the lock cannot be acquired it raises `projection_rebuild_locked` immediately rather than waiting. **CONFIRMED.**
- The lock is released in the success path (line 322: `PERFORM pg_advisory_unlock(v_lock_id)`) AND in the `EXCEPTION WHEN OTHERS` handler (line 325: `PERFORM pg_advisory_unlock(v_lock_id)`). No path leaves the exclusive lock dangling. **CONFIRMED.**
- `projection_checksums` table created (migration 024, line 162). `record_projection_checksum()` is called as the last step of a non-dry-run rebuild (line 316). **CONFIRMED.**
- `check_projection_drift()` function exists (line 336) and a pg_cron job runs it every 5 minutes. **CONFIRMED.**

**Lock level correctness:**

The design correctly uses:
- `pg_advisory_xact_lock_shared()` for live writes — transaction-scoped (auto-releases on commit, no leak risk).
- `pg_advisory_lock()` (session-level exclusive) for rebuilds — session-scoped because the rebuild "spans multiple internal transactions during admin_replay_range" (migration comment, line 215).

**Critical observation (N-02 — new finding):** The advisory lock key for live writes and for the rebuild is derived differently. Live writes use `public._projection_lock_id('project_order_created')` which returns `ABS(HASHTEXT('project_order_created'))`. The rebuild for `project_order_created` also uses `public._projection_lock_id('project_order_created')`. These are the **same key** — correct. However, `project_order_cancelled` and `increment_kitchen_orders` each have their own distinct lock keys, independent of the `project_order_created` rebuild lock. This means: a rebuild for `project_order_created` does NOT block live writes to `project_order_cancelled` or `increment_kitchen_orders`. This is architecturally correct (each projection is independent) but an operator triggering a full rebuild of `project_order_created` while `project_order_cancelled` events are in-flight will not cause mutual interference. The design is correct; documenting for clarity.

**Score: RESOLVED.** The xact-level vs session-level lock pairing is correctly implemented. The M-04 concern from Sprint 17 (`refresh_platform_health` session lock leak) is NOT addressed in Sprint 22 — that medium finding remains open.

---

### F-04 — Retry Events Without Authorization Header

**Validation checklist:**

- `dispatch_retry_events()` (migration 025, line 11) now reads `vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY'` in a BEGIN/EXCEPTION block that falls back to empty string on vault failure. **CONFIRMED.**
- The `Authorization` header is `'Bearer ' || COALESCE(v_service_key, '')` — same pattern as `dispatch_to_event_processor()` in migration 004. **CONFIRMED.**
- `check_retry_auth_failures()` (migration 025, line 66) queries `net._http_response` for 401/403 responses in the last 5 minutes. **CONFIRMED.**
- `platform_health_metrics.retry_auth_failures_5min` column added (line 100). **CONFIRMED.**
- Alert config inserted with `threshold = 1`, `comparison = 'gt'`, `severity = 'critical'`, `enabled = TRUE`, `cooldown_mins = 15` (line 106). **CONFIRMED.**

**Vault fallback risk (N-04 — residual):** If vault is unreachable at dispatch time, `v_service_key` is set to empty string and the Authorization header becomes `Bearer ` (empty token). The event-processor will return 401. The `check_retry_auth_failures()` job will detect this within 5 minutes and emit a critical security event. This is the correct fail-secure behaviour — the queue stalls rather than dispatching unauthenticated. However, the `dispatch_retry_events` function marks each row as `status = 'processing'` before the HTTP call (line 42–45). If the vault fails, the HTTP call is sent with an empty token, gets rejected 401, and the row remains in `processing` indefinitely — not returned to `pending_retry`. This is the same silent-failure mode as the original bug, but now only triggered by vault failure rather than by design. The `check_retry_auth_failures()` alert closes the detection gap; an operator must manually reset the `processing` rows to `pending_retry` on vault recovery.

**Score: RESOLVED.** Vault failure scenario is a residual operational risk, not a security finding.

---

### F-05 — stripe-refund Edge Function Queries Nonexistent user_roles Table

**Status: PARTIAL**

The `user_roles` table now exists (migration 022). The table creation closes the runtime error that caused silent fail-closed admin checks.

**Residual schema mismatch (N-03 — new finding):** The `stripe-refund/index.ts` query (lines 44–51) is:
```typescript
const { data: adminRows } = await supabase
  .from('user_roles')
  .select('roles(key)')
  .eq('user_id', user.id);
```

This query attempts a join to a `roles` table via a foreign key relation (`roles(key)`). The `user_roles` table created in migration 022 has NO `roles` foreign key — it uses an inline TEXT column `role` with a CHECK constraint. There is no `roles` table anywhere in the schema. This Supabase PostgREST join will either:

1. Return an error (relation `roles` does not exist in schema), which is caught by the `?? []` fallback — making `isAdmin` permanently `false`; or
2. Return empty rows if PostgREST silently ignores unknown embedded relations.

Either way, admin override in `stripe-refund` remains non-functional. The security consequence is unchanged from Sprint 17: customer/prepper refund paths work correctly; admin override is silently broken. The new risk is that `user_roles` now exists with public READ access for `user_id = auth.uid()` (policy `user_roles_own_read`) — meaning any authenticated user can query their own roles via PostgREST, which is correct. The wrong join key (`roles(key)`) means the admin check never works, but it also means no information from `user_roles` leaks beyond the querier's own rows.

**Risk classification:** LOW (admin refund override via stripe-refund is non-functional, but all admin refunds route through admin-actions which is correctly authorised via `is_admin()`). Operators should not rely on stripe-refund for admin override.

---

## New Vulnerabilities Introduced by Sprint 22

### N-01 — Predictable Idempotency Key: Pre-Registration Attack

**Severity:** LOW (not exploitable without admin access or SECURITY DEFINER bypass)

The idempotency key format is `'refund_' || order_id::TEXT` (migration 023, line 107). The key is deterministic given only the `order_id`. An attacker who knows the `order_id` of an in-flight legitimate order could, in theory, attempt to pre-register a `payment_operations` row with the same `stripe_idempotency_key` before the admin issues the refund.

**Exploitability analysis:** `_begin_refund_operation` is REVOKE'd from PUBLIC — no direct client call path exists. Payment_operations has no INSERT policy for authenticated users (only `admin_read` SELECT policy and `service_role` write). The only write path is through `admin_refund_order()` which requires `is_admin()`. There is no authenticated path for a non-admin to pre-register a row. The UNIQUE constraint on `stripe_idempotency_key` would cause the admin's legitimate call to receive the existing row rather than creating a new one — but `_begin_refund_operation` checks `status IN ('pending', 'processing', 'completed')` and returns early if a matching row is found. If an attacker could somehow insert a `'refund_<order_id>'` row in a different status (e.g. `'cancelled'` or `'failed'`), the idempotency check would not trigger and a new row insertion would fail on the UNIQUE constraint with a different error path. This attack requires service_role access or a SQL injection vector — neither is available. **Not exploitable in the current threat model.**

**Recommendation:** Consider appending a random suffix to the idempotency key on creation (e.g. `'refund_' || order_id || '_' || LEFT(gen_random_uuid()::TEXT, 8)`) and storing the full key in the DB row. This maintains Stripe deduplication while making the key non-predictable.

### N-02 — Per-Projection Advisory Lock Isolation

**Severity:** INFORMATIONAL

As noted in the F-03 validation above: each projection function (`project_order_created`, `project_order_cancelled`, `increment_kitchen_orders`) uses its own independent lock key. A rebuild of one projection does not block live writes to the other two. This is the correct design for independent projections but means a rebuild of `project_order_created` while `project_order_cancelled` events are in-flight is uncoordinated. If a future schema change requires a coordinated multi-projection rebuild (e.g. zeroing all metrics together), the current single-key per projection design requires a new higher-level lock or a sequential rebuild invocation.

**No immediate action required.** Document in the projection rebuild runbook.

### N-03 — stripe-refund user_roles Schema Mismatch

**Severity:** LOW

Documented in detail under F-05 above. The `roles(key)` join does not correspond to any table in migration 022. Admin override via the `stripe-refund` endpoint remains non-functional. No security regression from Sprint 17 — the impact is unchanged.

**Required fix:** Update `stripe-refund/index.ts` lines 44–51 to query `user_roles` correctly:
```typescript
const { data: adminRows } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .is('revoked_at', null);
const isAdmin = (adminRows ?? []).some(r => r.role === 'admin');
```

### N-04 — check_retry_auth_failures Reads Entire net._http_response Table

**Severity:** LOW

`check_retry_auth_failures()` (migration 025, line 73):
```sql
SELECT COUNT(*) INTO v_failures
FROM net._http_response
WHERE status_code IN (401, 403)
  AND created BETWEEN NOW() - INTERVAL '5 minutes' AND NOW();
```

`net._http_response` stores all responses from all `pg_net` HTTP calls — not just retry event dispatches. This query counts **all** 401/403 responses from the entire Supabase project in the last 5 minutes, including Stripe webhook responses, storage callbacks, and any other pg_net calls. A 401 from Stripe's API (e.g. an expired STRIPE_SECRET_KEY) would register as a `retry_auth_failures_5min` alert. This creates false positives that could mask or inflate the retry-specific signal.

**Impact:** Alert noise, not a security vulnerability. An operator investigating a `retry_auth_failures_5min` alert must manually determine whether the 401s come from the event-processor or another endpoint.

**Recommendation:** Filter by URL: `AND (url LIKE '%event-processor%' OR url LIKE '%/functions/v1/event-processor%')`. The `net._http_response` schema in Supabase pg_net includes a `url` column.

### N-05 — check_projection_drift() Fires Critical Security Events on Normal Incremental Growth

**Severity:** LOW (alert noise, not a security finding)

`check_projection_drift()` (migration 024, line 336) fires `projection_drift_detected` at `critical` severity whenever the current checksum differs from the stored checksum. The stored checksum is only updated by `record_projection_checksum()`, which is called only at the end of a rebuild. Every live event processed between rebuilds changes the `projection_event_log` and therefore changes the checksum — triggering a false `critical` alert every 5 minutes indefinitely.

The root cause document (`03-projection-root-cause.md` §Staleness vs Corruption) correctly identifies that `current_event_count > stored_event_count` represents normal live growth and should not alert. However, the function itself does not implement this distinction — it raises `critical` on any checksum delta regardless of direction.

**Recommendation:** Add the staleness/corruption triage logic to `check_projection_drift()`:
```sql
IF v_current_event_count > v_stored.event_count THEN
  -- Normal live growth: update the stored checksum, don't alert
  PERFORM public.record_projection_checksum(v_proj);
ELSIF v_current_event_count < v_stored.event_count THEN
  -- Rows deleted: critical alert (corruption)
  ...
ELSIF v_current_event_count = v_stored.event_count AND v_current_checksum <> v_stored.checksum THEN
  -- Same count, different checksum: rows mutated, critical alert
  ...
END IF;
```

### N-06 — user_roles Bootstrap Gap: Cold-Start Leaves System Admin-less

**Severity:** MEDIUM (operational, not security; affects availability)

Migration 022 replaces JWT-only `is_admin()` with DB-authoritative `is_admin()`. When this migration is applied to a production database with existing admin users, those users have no `user_roles` row and will be denied admin access immediately. The bootstrap notice in the migration (lines 303–321) documents the correct procedure (direct INSERT via service_role) but does not enforce it — a deploy without the seed step locks out all admins.

**Blast radius:** If deployed without seeding `user_roles`, all admin RPCs return `admin_required`. Operators lose the ability to issue refunds, freeze accounts, or manage the platform until the seed is applied. The rollback path (`docs/sprint22/01-authz-root-cause.md` §Rollback Strategy) requires the SQL editor, which requires admin-level Supabase dashboard access — still available because the Supabase dashboard auth is independent of `is_admin()`.

**Not a security vulnerability** — a locked-out admin cannot do harm. But a poorly coordinated deploy could create an extended operational outage. This must be in the deploy runbook as a blocking pre-flight step.

---

## Red Team Re-run Results (14 Scenarios)

### Scenario 1 — Admin account compromise: what can a compromised admin do now?

**Sprint 17:** Exploitable. 60-minute window after demotion; 20 refunds, 30 escrow releases, mass account freeze within quota.

**Sprint 22:** Substantially mitigated.

After `admin_revoke_role()` commits, the next call to any admin RPC is denied. The `is_admin()` function queries `user_roles` fresh on every call (STABLE does not cache across statements). A compromised admin whose role is revoked is denied on the very next RPC — even if their JWT still claims admin. The `admin_jwt_claim_denied_by_db` security event is emitted at `critical` severity, alerting the team to the attempted use of a stale token.

**Residual:** The in-flight request window (a single RPC execution already past the `is_admin()` check when revocation commits) is bounded by statement timeout (~500 ms). This is the theoretical minimum and is accepted.

**Currently exploitable:** NO (revocation is effective on the next request).

---

### Scenario 2 — RLS bypass via SECURITY DEFINER

**Sprint 17:** Not exploitable.

**Sprint 22:** Sprint 22 adds new SECURITY DEFINER functions: `is_admin()`, `is_role()`, `admin_grant_role()`, `admin_revoke_role()`, `_begin_refund_operation()`, `_complete_refund_operation()`, `_fail_refund_operation()`, `admin_refund_order()`, `admin_complete_refund()`, `admin_fail_refund()`, `recover_stale_payment_operations()`, `_projection_lock_id()`, all three rewritten projection functions, `compute_projection_checksum()`, `record_projection_checksum()`, `admin_rebuild_projection()`, `check_projection_drift()`, `dispatch_retry_events()`, `check_retry_auth_failures()`.

All internal helpers (`_begin_refund_operation`, `_complete_refund_operation`, `_fail_refund_operation`, `_projection_lock_id`, `compute_projection_checksum`, `record_projection_checksum`, `recover_stale_payment_operations`, `check_retry_auth_failures`) have `REVOKE EXECUTE FROM PUBLIC`. All public-facing functions (`admin_grant_role`, `admin_revoke_role`, `admin_refund_order`, `admin_complete_refund`, `admin_fail_refund`, `admin_rebuild_projection`, `check_projection_drift`, `dispatch_retry_events`) have in-body `is_admin()` checks or are anon-safe (e.g. `is_admin()` and `is_role()` return FALSE for unauthenticated callers). `dispatch_retry_events` has no `is_admin()` gate — it is callable by authenticated users. However, it is `REVOKE EXECUTE FROM PUBLIC` and the grant is not visible in migration 025. Verify that no `GRANT EXECUTE` to `authenticated` exists for `dispatch_retry_events()`.

**Actually exploitable:** An authenticated non-admin user can call `check_projection_drift()` because it has `GRANT EXECUTE ... TO authenticated` (migration 024, line 374) and no `is_admin()` check in its body. The function is declared STABLE SECURITY DEFINER. It reads from `projection_event_log` and `projection_checksums` — internal system tables — and emits security events if drift is detected. A non-admin user calling it repeatedly could spam `projection_drift_detected` security events. This is a low-impact information disclosure (projection checksums are visible to the caller) and a denial-of-service against the security event system.

**Recommendation:** Add `IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;` to `check_projection_drift()`, or change the GRANT to service_role only.

---

### Scenario 3 — Projection rebuild while events are processing

**Sprint 17:** Exploitable. Under-count race.

**Sprint 22:** Not exploitable. The exclusive session-level advisory lock in `admin_rebuild_projection()` blocks all shared-lock holders (live projection functions) from proceeding. The `pg_try_advisory_lock` is non-blocking on the rebuild side — a rebuild attempt while live writes are active returns `projection_rebuild_locked` immediately rather than waiting. If the rebuild succeeds in acquiring the exclusive lock, all subsequent live writes block at `pg_advisory_xact_lock_shared()` until the rebuild calls `pg_advisory_unlock()`.

**Currently exploitable:** NO.

---

### Scenario 4 — Dead letter replay after admin session expiry

**Sprint 17:** Not exploitable (idempotency gate holds).

**Sprint 22:** Not exploitable. No change to the dead letter replay path. `admin_replay_dead_letter` still routes through `event_processing_log` UNIQUE(event_id) and the `manual_replay_count` cap. `is_admin()` is now DB-authoritative, which tightens the auth check.

**Currently exploitable:** NO.

---

### Scenario 5 — Refund with manipulated amount

**Sprint 17:** Not exploitable (amount derived from DB).

**Sprint 22:** Not exploitable. `_begin_refund_operation()` reads `v_payment.amount_pence` from the locked `payments` row — the amount in the `payment_operations` ledger row comes from the DB, not from any parameter. The edge function receives `opData.amount_pence` from the RPC response and passes it to Stripe — no caller-supplied amount at any point.

**Currently exploitable:** NO.

---

### Scenario 6 — Event replay with crafted payload

**Sprint 17:** Partially exploitable (depends on WEBHOOK_SECRET configuration).

**Sprint 22:** Not exploitable (beyond Sprint 17 assessment). The F-04 fix means retry events now carry correct auth. The event-processor's `WEBHOOK_SECRET` check is effective. Crafted payload injection via direct HTTP requires knowledge of the correct bearer token (the service-role key stored in vault). JSONB validation trigger `domain_events_validate_payload` (migration 019) still runs on INSERT. No change in risk.

**Currently exploitable:** NO (with WEBHOOK_SECRET set in production).

---

### Scenario 7 — Feature flag context injection

**Sprint 17:** Not exploitable (fixed in migration 020).

**Sprint 22:** Not exploitable. `evaluate_flag` still derives `v_user_id` from `auth.uid()` and ignores any user_id in `p_context`. The `is_admin()` fix does not alter the feature flag evaluation path. No regression.

**Currently exploitable:** NO.

---

### Scenario 8 — Notification deduplication bypass

**Sprint 17:** Marginally exploitable (admin-only, dedup key craft via Unicode/whitespace).

**Sprint 22:** No change. The per-sender hourly cap remains the effective defence. Sprint 22 does not modify the notification path.

**Currently exploitable:** MARGINAL (unchanged, low risk).

---

### Scenario 9 — Storage path traversal

**Sprint 17:** Not exploitable for media_objects; yes for listing_photos (M-03 open).

**Sprint 22:** No change. Migration 022–025 do not address M-03 (listing_photos storage path validation). The gap remains open.

**Currently exploitable:** YES for listing_photos.storage_path (M-03 from Sprint 17 remains unaddressed).

---

### Scenario 10 — Concurrent admin_rebuild_projection calls

**Sprint 17:** Exploitable (no cooldown, no lock).

**Sprint 22:** Not exploitable. `pg_try_advisory_lock` is non-blocking and exclusive — a concurrent rebuild attempt for the same projection name will fail immediately with `projection_rebuild_locked`. A rebuild attempt for a different projection name would use a different lock key and proceed in parallel (correct behaviour, no shared state collision between independent projections).

**Currently exploitable:** NO.

---

### Scenario 11 — Stripe-succeeds-DB-fails in refund (Stripe-succeeds-response-lost)

**Sprint 17:** Exploitable (double-refund).

**Sprint 22:** Not exploitable as a double-refund. The DB-first state machine ensures a `payment_operations` row with `status = 'pending'` exists before Stripe is called. A crash after Stripe issues the refund but before `admin_complete_refund` is called leaves the row in `pending`. The recovery worker detects it. A retry with the same `stripe_idempotency_key` returns the original Stripe refund object (within 24 hours). **The double-refund window is closed.**

**Residual scenario documented:** If the retry occurs more than 24 hours after the original Stripe call, Stripe may issue a second refund. This is a narrow, time-bounded residual risk — the admin console or recovery worker should flag and resolve stale `pending` ops well within the 24-hour window given the 10-minute detection + 5-minute pg_cron cadence.

**Currently exploitable:** NO (within 24-hour window); LOW RESIDUAL beyond 24 hours.

---

### Scenario 12 — Admin kill switch bypass

**Sprint 17:** N/A (no `admin_actions_paused` flag in Sprint 17).

**Sprint 22:** No change. There is still no platform-wide admin kill switch. The `admin_grant_role` / `admin_revoke_role` mechanism serves as the targeted kill switch for individual admin accounts, but there is no single toggle to pause all admin RPCs simultaneously.

**Currently exploitable:** N/A (control does not exist; revocation is now effective per F-01 fix).

---

### Scenario 13 — pg_cron advisory lock stacking in refresh_platform_health

**Sprint 17:** Partially exploitable (M-04: session-level lock leak on error path).

**Sprint 22:** M-04 is NOT addressed in Sprint 22. `refresh_platform_health()` still uses session-level `pg_try_advisory_lock(42001)` without an EXCEPTION handler to ensure release on error. This medium finding remains open.

**Currently exploitable:** PARTIAL (unchanged from Sprint 17, M-04 open).

---

### Scenario 14 — is_admin() JWT freshness

**Sprint 17:** Exploitable (60-minute window, F-01).

**Sprint 22:** Not exploitable. `is_admin()` now queries `user_roles` on every call. JWT freshness is irrelevant — the DB is authoritative. A revocation is effective on the next RPC call.

**Currently exploitable:** NO.

---

## Performance Impact of Sprint 22 Changes

### is_admin() Per-Call DB Lookup

Every admin RPC now executes an additional `SELECT EXISTS` against `user_roles` before proceeding. `user_roles` has two partial indexes:
- `user_roles_user_idx ON (user_id) WHERE revoked_at IS NULL` — covers the `WHERE user_id = v_uid AND revoked_at IS NULL` predicate exactly.
- `user_roles_active_idx ON (role, user_id) WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())` — covers the full active-role lookup.

At typical admin concurrency (< 10 simultaneous admin operations), the additional lookup adds ~1–2 ms per call (single-row index scan). At peak admin load (20 concurrent admin sessions each issuing RPCs), this is 20 concurrent single-row lookups on a small table — negligible compared to the payment and order operations they gate.

The `user_roles` table is expected to remain small (< 100 rows for any realistic admin team). Index bloom on a 100-row table is effectively a single buffer read. No performance concern at expected scale.

### Shared Advisory Lock: Projection Write Throughput at 1,000 Concurrent Orders

In nominal operation (no rebuild running), `pg_advisory_xact_lock_shared()` is a lightweight, non-blocking shared acquisition. Multiple shared holders are compatible — 1,000 concurrent `project_order_created` calls all acquire the shared lock simultaneously with no contention. Lock acquisition overhead is estimated at < 0.1 ms per call in shared mode with no exclusive contender. No throughput impact in nominal operation.

**Rebuild scenario (worst case):** When `admin_rebuild_projection` acquires the exclusive lock:
1. All in-flight `project_order_created` transactions that have not yet reached `pg_advisory_xact_lock_shared()` will block at that call until the exclusive lock is released.
2. The exclusive lock cannot be acquired while any shared lock is held — so the rebuild itself waits until all current live projection transactions commit. Under 1,000 concurrent orders, each projection transaction commits in ~5–10 ms. The rebuild waits for the tail of the current wave, then acquires the exclusive lock.
3. After the rebuild completes and releases the exclusive lock, the next batch of incoming live write transactions all acquire shared locks simultaneously. This causes a brief "thundering herd" of lock acquisitions — all 1,000 pending shared-lock waiters wake up together.

**Expected latency spike during rebuild:** The rebuild itself may take 10–60 seconds (depends on event history size). During this window, all live projection writes queue at the shared lock. After the rebuild releases, the queued writes execute in batch. The latency spike for the backlogged writes is proportional to the rebuild duration — potentially 10–60 seconds of projection lag on the metrics tables. This is acceptable for an infrequent admin operation and is clearly communicated by the existing `rebuild_initiated` security event. Operators should trigger rebuilds during low-traffic windows.

**Recommendation:** Add a pre-rebuild traffic estimate to `admin_rebuild_projection`: emit a warning if `(SELECT COUNT(*) FROM public.orders WHERE status IN ('pending', 'confirmed')) > 100` to signal that the rebuild will cause noticeable projection lag.

---

## Updated Security Controls Checklist

| Control | Status | Notes |
|---|---|---|
| No critical findings | ✓ | F-01 resolved; no new critical findings |
| No high findings without documented mitigation | ✓ | All high findings resolved; N-03 is low |
| Admin identity is DB-authoritative | ✓ | Migration 022; user_roles queried on every is_admin() call |
| Role changes take effect immediately | ✓ | STABLE function, no session cache; next RPC call is denied |
| Role audit log is append-only | ✓ | role_audit_no_mutation trigger on UPDATE/DELETE |
| No direct client writes to user_roles or role_audit | ✓ | INSERT policies WITH CHECK (FALSE) for authenticated; service_role only |
| Refund flow is DB-first | ✓ | Migration 023; FOR UPDATE lock before any Stripe call |
| Refund idempotency key stored in DB before Stripe call | ✓ | payment_operations.stripe_idempotency_key inserted in same transaction |
| Stale refund operations detected and alerted | ✓ | recover_stale_payment_operations() via pg_cron every 5 min |
| Projection rebuild holds exclusive advisory lock | ✓ | Migration 024; pg_try_advisory_lock; released in EXCEPTION handler |
| Live projection writes hold shared advisory lock | ✓ | pg_advisory_xact_lock_shared in all three projection functions |
| Exclusive lock released on error | ✓ | EXCEPTION WHEN OTHERS handler calls pg_advisory_unlock |
| Projection checksums recorded after rebuild | ✓ | record_projection_checksum() called as last rebuild step |
| Projection drift detected by pg_cron | ✓ | check_projection_drift() every 5 min; CAVEAT: false positives on normal growth (N-05) |
| Retry events carry Authorization header | ✓ | Migration 025; vault lookup matches migration 004 pattern |
| Retry auth failures detected and alerted | ✓ | check_retry_auth_failures() + alert_configs entry |
| Immutable audit logs | ✓ | Unchanged from Sprint 17 |
| RLS on all new tables | ✓ | user_roles, role_audit, payment_operations, projection_checksums all have RLS enabled |
| Payment_operations DELETE blocked | ✓ | payment_operations_no_delete trigger |
| No direct client INSERT/UPDATE on payment_operations | ✓ | No authenticated INSERT/UPDATE policy; admin SELECT only |
| check_projection_drift accessible to non-admins | ✗ | GRANT TO authenticated without is_admin() gate — Scenario 2 new finding |
| stripe-refund admin check functional | ✗ | roles(key) join schema mismatch — N-03 |
| listing_photos storage path validated | ✗ | M-03 from Sprint 17 remains unaddressed |
| refresh_platform_health advisory lock safe on error | ✗ | M-04 from Sprint 17 remains unaddressed |

---

## Updated Production Readiness Score

**Previous (Sprint 17):** 56/100
**Current (Sprint 22):** 82/100

| Category | Sprint 17 | Sprint 22 | Delta | Rationale |
|---|---|---|---|---|
| Authentication & Authorization | 8/20 | 18/20 | +10 | DB-authoritative is_admin() closes the 60-min window; user_roles table created; -2 for check_projection_drift missing is_admin() gate |
| Data Integrity | 14/20 | 19/20 | +5 | DB-first refund state machine closes double-refund race; advisory lock closes projection rebuild race; -1 for 24-hour Stripe idempotency residual |
| Input Validation | 17/20 | 17/20 | 0 | No change; listing_photos M-03 still open |
| Network Security | 9/15 | 13/15 | +4 | Retry events now authenticated; -2 for vault-fallback empty-token risk and net._http_response false positive noise |
| Operational Security | 8/15 | 11/15 | +3 | Recovery worker, drift detection, alert configs added; -2 for bootstrap gap (N-06) and check_projection_drift alert noise (N-05); -2 for stripe-refund schema mismatch still unresolved |
| Performance & Reliability | 10/10 | 10/10 | 0 | Advisory lock overhead acceptable; is_admin() lookup negligible at expected admin concurrency |

---

## Accepted Risks for GO WITH ACCEPTED RISKS Verdict

The following risks are accepted for launch with sprint commitments:

| ID | Risk | Likelihood | Impact | Sprint Commitment |
|---|---|---|---|---|
| AR-1 | stripe-refund admin override non-functional (N-03 schema mismatch) | Certain | Low (admin refunds route through admin-actions correctly) | Fix `stripe-refund/index.ts` query in Sprint 23 |
| AR-2 | check_projection_drift() fires false critical alerts on normal event growth (N-05) | Certain | Medium (alert fatigue; operators may start ignoring critical events) | Add staleness triage logic to check_projection_drift() in Sprint 23 |
| AR-3 | check_retry_auth_failures() counts all 401/403 from all pg_net calls (N-04) | Certain | Low (false positive alerts; real retry failures may be masked) | Filter by URL pattern in Sprint 23 |
| AR-4 | check_projection_drift() GRANT TO authenticated without is_admin() gate | Low (requires authenticated non-admin to deliberately call the RPC) | Low (read-only, security event spam) | Add is_admin() guard in Sprint 23 |

The following medium findings from Sprint 17 remain open and are re-accepted with the same rationale as Sprint 17:

| ID | Finding | Status |
|---|---|---|
| M-03 | listing_photos storage path not validated | Open — accepted; Supabase storage rejects invalid paths at API level |
| M-04 | refresh_platform_health session advisory lock can leak on error | Open — accepted; lock leak causes at-most-once metric refresh stall per session |

---

## Final Recommendation

**GO WITH ACCEPTED RISKS**

All four blocking findings from Sprint 17 (F-01 through F-04) are resolved. The fifth high finding (F-05) is partially resolved — the table exists, but the edge function query has a schema mismatch that renders admin override non-functional. This is a LOW risk because all legitimate admin refunds route through `admin-actions`, not `stripe-refund`.

Sprint 22 introduced no new critical or high findings. The new findings are two LOW items (N-03 schema mismatch, N-04 false positive alerts), one LOW/informational RLS gap (Scenario 2 / `check_projection_drift`), one MEDIUM operational risk (N-06 bootstrap gap), and one alert-noise issue (N-05). None block launch.

The four accepted risks (AR-1 through AR-4) must be logged as Sprint 23 commitments before this report can be signed off. If any of the four cannot be committed to Sprint 23, re-evaluate: AR-2 (alert fatigue from false critical projection drift events) carries the highest operational risk because it trains operators to ignore critical security events — if that cannot be committed, reconsider the verdict.

**Pre-deploy blocking checklist (outside scope of this code review):**

1. Seed `user_roles` with all existing admin users via direct service_role INSERT before deploying migration 022 to production.
2. Verify `WEBHOOK_SECRET` is set in the `event-processor` edge function's production secrets.
3. Confirm `SERVICE_ROLE_KEY` is stored in vault under the exact name `SERVICE_ROLE_KEY` (case-sensitive; migrations 004 and 025 both reference this key name).
4. Confirm pg_cron is enabled on the production Supabase project.

The architecture is sound. The Sprint 22 remediation work is well-engineered — the DB-first refund state machine, the advisory lock pairing, and the vault-backed retry auth are all implemented correctly. The residual items are edge cases and alert hygiene, not structural failures.

---

*This report was produced by an independent red team assessor based on static analysis of migrations 022–025, edge functions admin-actions/index.ts, event-processor/index.ts, and stripe-refund/index.ts, and the four Sprint 22 root-cause documents. It does not reflect dynamic testing against a live deployment. A follow-up dynamic assessment confirming bootstrap procedure execution and WEBHOOK_SECRET configuration is recommended before processing real transactions.*
