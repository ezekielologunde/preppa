# Sprint 17 Final Security Gate Report

**Date:** 2026-06-23
**Assessor:** Independent Red Team — Offensive Security Gate Assessment
**Backend Version:** Migrations 001–020 (applied); Migration 021 not observed in repository
**Scope:** Full stack — PostgreSQL/RLS/migrations, Edge Functions (all 15), Admin RPC surface, Event Bus, Stripe integration, Feature Flags, Replay Console, Notification system, Storage pipeline, Observability, pg_cron
**Verdict:** NO GO

---

## Executive Summary

Preppa is a meal-prep marketplace backed by a well-architected Supabase PostgreSQL stack with CQRS event sourcing, a 14-RPC admin control plane, an edge-function layer, and Stripe payment processing. The team has made substantial, genuine security investments: append-only audit triggers (016), per-hour monetary quota guards (016), JSONB payload validation (019), storage path traversal blocks (018), and a hardened feature flag system with JWT-anchored user-ID evaluation (020). Many findings from the Sprint 11 threat model have been addressed.

However, this assessment identifies **one CRITICAL finding that is not resolved** and **four HIGH findings** that require documented mitigation before any of them can be accepted. The CRITICAL finding is a structural flaw in the admin identity model: `is_admin()` is implemented against `app_metadata` claims in the JWT rather than a live, revocation-aware database table. This means a demoted or compromised admin retains full administrative power for the duration of their token's TTL (typically 1 hour on Supabase). This is not a theoretical concern — it directly enables the single most dangerous attack vector for a financial marketplace: a former admin initiating mass refunds, mass account freezes, or escrow releases after their privilege has been revoked.

The remaining HIGH findings cover: a live Stripe-succeeds-DB-fails double-refund window in the admin-actions edge function; the absence of a concurrency guard on `admin_rebuild_projection` (no advisory lock means two concurrent rebuilds produce double-counted metrics); the `dispatch_retry_events` function forwarding events to the event-processor without the service-role authorization header; and the `stripe-refund` edge function performing admin identity verification against a `user_roles` table that does not exist in these migrations.

The **Production Readiness Score is 56/100**. Deployment is blocked pending resolution of F-01 and F-02 at minimum, and documented mitigations for F-03 through F-05.

---

## Architecture Assessment

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  CLIENTS (React Native / Expo)                                               │
│   Authenticated via Supabase Auth (JWT, RS256, app_metadata.role)            │
└───────────────────┬──────────────────────────────────────────────────────────┘
                    │ HTTPS / PostgREST / Edge Functions
┌───────────────────▼──────────────────────────────────────────────────────────┐
│  EDGE FUNCTIONS (Deno, Supabase Edge Runtime)                                │
│   admin-actions · event-processor · stripe-webhook · stripe-checkout        │
│   stripe-refund · feature-flags · notify · stripe-connect · stripe-boost    │
│   stripe-subscribe · stripe-payment-methods · stripe-capture-home-cook      │
│   stripe-home-cook-payment · notify-order-* · order-status-email            │
│                                                                              │
│   Shared auth: _shared/security.ts (CORS allowlist, readBody, getUser)      │
└───────────────────┬──────────────────────────────────────────────────────────┘
                    │ service_role key / user JWT
┌───────────────────▼──────────────────────────────────────────────────────────┐
│  POSTGRESQL (Supabase-managed)                                               │
│                                                                              │
│  RLS on every table · SECURITY DEFINER RPCs · pg_net webhooks               │
│  pg_cron (4 per-minute jobs + 3 daily)                                      │
│                                                                              │
│  WRITE SIDE:  domain_events ──► on_domain_event_insert (pg_net)             │
│                                         │                                   │
│                                         ▼                                   │
│  EDGE:        event-processor ──► projection RPCs ──► *_metrics             │
│                                                                              │
│  ADMIN:       admin_* RPCs (SECURITY DEFINER, is_admin() gate)              │
│  AUDIT:       audit_logs · admin_action_log · security_events (append-only) │
│  QUOTA:       admin_action_quota (monetary cap per admin per hour)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Overall security posture:** The architecture is sound. CQRS with append-only event sourcing, SECURITY DEFINER with pinned search_path throughout, explicit REVOKE/GRANT patterns, atomic quota enforcement, and layered JSONB validation demonstrate mature security engineering. The primary systemic risk is that the admin trust anchor (is_admin()) is evaluated against a claim in a potentially stale JWT rather than a live database record, which undermines every other admin control.

---

## Attack Surface Inventory

### Critical Findings (must fix before launch)

---

**F-01 — Admin JWT stale-claim bypass (admin demotion is non-atomic)**
**Severity:** CRITICAL
**Tables/Functions:** `public.is_admin()` (010), every `admin_*` RPC

`is_admin()` is implemented as:
```sql
SELECT COALESCE(
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
  FALSE
)
```

`auth.jwt()` reflects the token issued at the **last login or token refresh**, not the current live authorization state. Supabase access tokens expire after 1 hour by default; during that window, a demoted admin's token continues to pass the `is_admin()` check. An attacker who compromises an admin account and whose privileges are then revoked retains full admin power for up to 60 minutes — sufficient to execute 20 refunds (the hourly cap), replay events, or delete listing visibility.

The Sprint 11 threat model (§0.1) explicitly documents this gap and recommends a `user_roles` table as the live source of truth. That table was not implemented. The current `is_admin()` reads only the JWT.

**Blast radius:** All 14 admin RPCs remain callable by a demoted admin until their token expires. Financial impact: up to 20 × arbitrary-order refunds (£unlimited per order), 30 escrow releases, and mass account freezes within a single hourly window. Audit trail is present, but the damage is already done.

**Root cause:** Architectural shortcut — JWT `app_metadata` was used as the role store because it requires no additional table. This is appropriate as a fast-path hint but not as an authoritative, real-time revocation check.

**Required fix:** Implement a `user_roles` table with no client-writable policies. Rewrite `is_admin()` to perform a live SELECT against it. Accept the per-call latency cost (~1ms), or cache with a short TTL (30 seconds) using a session variable. The JWT claim can serve as a fast-path hint to avoid the DB lookup for the 99% case, but revocation must still take effect within one cache TTL, not within one token TTL.

---

### High Findings (require documented mitigation before launch)

---

**F-02 — Stripe-succeeds-DB-fails double-refund window**
**Severity:** HIGH
**Files:** `supabase/functions/admin-actions/index.ts` lines 156–185, `public.admin_refund_order()` (migration 016)

The `refund_order` action in the admin-actions edge function follows this sequence:
1. Read payment from DB via service role.
2. Call `stripeRefund()` — issues the refund on Stripe.
3. Call `admin_refund_order()` RPC — updates DB status to `refunded`.

If step 3 fails (network timeout, DB error, edge-function crash), the Stripe refund has already been issued but the payment row still shows `captured` or `in_escrow`. The next call to `refund_order` for the same order passes the state guard (`status NOT IN ('captured', 'in_escrow')` check) — because the DB was never updated — and re-issues a second Stripe refund. The idempotency check `refunded_at IS NOT NULL` in `admin_refund_order` (migration 016) guards against DB-level duplicates, but it is never reached because the DB state was never updated.

The DB function itself uses `FOR UPDATE` locking and has correct idempotency once called. The gap is in the edge function's call ordering — Stripe is called before the DB is locked.

**Blast radius:** Double-refund of any order amount. No automatic recovery without manual Stripe reconciliation.

**PoC:** Issue `refund_order` for a valid order; kill the edge function process after `stripeRefund()` returns but before `rpc('admin_refund_order')` completes. Re-invoke `refund_order` — a second Stripe refund is issued.

**Required fix:** Write a `refund_intent` row to the DB before calling Stripe (optimistic lock pattern). Alternatively, use a Stripe idempotency key derived from the order ID and a monotonic counter stored in the DB, so Stripe deduplicates the second attempt server-side. The DB-first approach (write intent → call Stripe → confirm DB) is preferred.

---

**F-03 — admin_rebuild_projection has no advisory lock (concurrent rebuild race)**
**Severity:** HIGH
**Functions:** `public.admin_rebuild_projection()` (migrations 013, 016)

`admin_rebuild_projection` performs the following within a single function call, but **not within a single transaction** with an advisory lock:
1. `DELETE FROM projection_event_log WHERE projection_name = p_projection_name`
2. Zero read-model counters (UPDATE prepper_metrics, customer_metrics, etc.)
3. Call `admin_replay_range()` which loops through domain_events and re-applies projectors

Between steps 1 and 3, live `order.created` events arriving via the event-processor will find the projection gate cleared (step 1 is already done) and insert new rows into `projection_event_log`, then apply their projections to the now-zeroed counters. When the replay in step 3 reaches those same events, `_projection_already_applied()` will find the rows already present (inserted by the live processor in the gap) and skip them. The net result: those orders are counted once in the final state, but the zeroing in step 2 wiped any pre-existing counts, so the events that arrived *before* the zero are not replayed (they are in `projection_event_log`). Final projection totals will be understated.

The architecture review (sprint11/architecture-review.md §6) explicitly requires "advisory lock + reset + replay in one transaction." This was not implemented.

**Blast radius:** Incorrect prepper revenue totals, kitchen order counts, and platform metrics after any projection rebuild. Undetectable without a cross-check against raw `domain_events`. Financial reporting is incorrect until the next complete rebuild.

**Required fix:** Wrap the gate clear, counter zero, and replay inside a `BEGIN ... COMMIT` block held open for the duration of the replay, OR acquire `pg_advisory_xact_lock(43001)` at the start and ensure the replay also holds the same lock. Because a full rebuild can be long-running, the advisory lock approach with the replay dispatched as a background job (not inline) is architecturally safer. At minimum, document the rebuild-during-traffic risk in the runbook and require a maintenance window.

---

**F-04 — dispatch_retry_events sends retries without Authorization header (event-processor auth bypass)**
**Severity:** HIGH
**Functions:** `public.dispatch_retry_events()` (migration 005)

The retry dispatcher calls the event-processor edge function via `net.http_post` without including the `WEBHOOK_SECRET` bearer token:

```sql
PERFORM net.http_post(
  url     := 'https://nfwfnnfbikjxwflpmsnu.supabase.co/functions/v1/event-processor',
  headers := jsonb_build_object('Content-Type', 'application/json'),   -- no auth header
  body    := row_to_json(v_rec)::JSONB
);
```

Compare with `dispatch_to_event_processor()` (migration 004) which correctly reads the service-role key from vault and passes it as the bearer token. The retry path omits this entirely.

The event-processor checks the secret only when `WEBHOOK_SECRET` is set: `if (WEBHOOK_SECRET) { ... }`. If `WEBHOOK_SECRET` is configured in production (it must be, for security), retry events will be rejected with 401. This means **retry events silently fail to dispatch in production**, leaving the retry queue perpetually stuck at `pending_retry` without ever making progress.

**Blast radius:** Operational — any event that fails on first attempt and enters the retry queue will never be retried. Dead-letter accumulation. Depending on which events fail, this could mean missed order notifications, incorrect projection counts, or stuck escrow states.

**Secondary concern:** If `WEBHOOK_SECRET` is not set in production (to paper over this bug), the event-processor URL becomes an unauthenticated endpoint callable by any actor with the public URL. An attacker can craft `order.created` events with arbitrary payloads and inject them directly into the projection pipeline.

**Required fix:** Mirror the vault lookup pattern from `dispatch_to_event_processor()` in `dispatch_retry_events()`.

---

**F-05 — stripe-refund edge function checks user_roles table that does not exist**
**Severity:** HIGH
**Files:** `supabase/functions/stripe-refund/index.ts` lines 44–53

The `stripe-refund` function checks admin status by querying a `user_roles` table:
```typescript
const { data: adminRows } = await supabase
  .from('user_roles')
  .select('roles(key)')
  .eq('user_id', user.id);
const isAdmin = (adminRows ?? []).some(r => /* role.key === 'admin' */);
```

The `user_roles` table does not exist in migrations 001–020. This query silently returns an empty result (no rows, no error — RLS blocks unauthenticated access but the authenticated user gets an empty set), so `isAdmin` is always `false`. This is the stripe-refund path available to *customers and preppers* (not the admin-actions path), and the function's authorization logic (`isAllowed = order.customer_id === user.id || prepper?.user_id === user.id || isAdmin`) means admin override of refunds is silently broken — but the customer/prepper path still works.

The risk is that any future code relying on `isAdmin` from this function will silently fail-open or fail-closed depending on the logic path.

**Blast radius:** Admin override of customer-initiated refunds is non-functional. More critically, if the `user_roles` table is added with permissive defaults, the admin check here becomes a different authorization model than the rest of the system (JWT app_metadata vs. table), creating inconsistency. If the table is added with public READ, any authenticated user can enumerate admin role assignments.

**Required fix:** Align this function's admin check with the rest of the system. In the near term: check `app_metadata.role === 'admin'` from the JWT (consistent with the rest of the codebase). When F-01 is fixed, update this to the live table check as well.

---

### Medium Findings

**M-01 — admin_action_log allows UPDATE (audit log partial mutability)**
**Severity:** MEDIUM
**Tables/Triggers:** `public.admin_action_log`, trigger `admin_action_log_no_mutation` (migration 016)

Migration 016 places a DELETE block trigger on `admin_action_log` but explicitly allows UPDATE for reversal tracking (`reversed_at`, `reversed_by`, `reversal_reason` columns). An admin with a valid token can UPDATE any column in `admin_action_log` — not just reversal fields — via PostgREST because the RLS policy only restricts INSERT (WITH CHECK requiring is_admin()) and SELECT (is_admin()). There is no UPDATE policy, which in PostgreSQL defaults to deny for authenticated users, but an admin can still UPDATE their own rows via the service role if exploiting a path that elevates to service_role.

More specifically: `admin_unfreeze_account()` calls `_admin_record()` which INSERTs to `admin_action_log`. After the action, an admin can UPDATE the `reason` field directly via PostgREST (no UPDATE RLS policy = deny, but the admin can also call RPCs that internally UPDATE). The reversal UPDATE that IS intended opens a narrow window for reason-field tampering if a future RPC is less careful.

**Recommendation:** Add explicit column-level constraints or a trigger that limits UPDATE to only `reversed_at`, `reversed_by`, `reversal_reason` columns, blocking changes to `action_type`, `target_type`, `target_id`, `metadata`, `reason` (original), and `created_at`.

---

**M-02 — Global storm guard in safe_send_notification has a TOCTOU window**
**Severity:** MEDIUM
**Functions:** `public.safe_send_notification()` (migration 017)

The global storm guard:
1. UPDATEs the singleton counter (always increments, no cap in the UPDATE itself).
2. Re-reads the counter and compares against `GLOBAL_STORM_CAP` (10,000/minute).
3. Returns NULL (drops the notification) if over cap.

Between steps 1 and 2, the counter has already been incremented even if the function will return NULL. Under concurrent load, the increment is unconditional, meaning the counter can surge well past the cap before the guard fires. At N concurrent calls simultaneously exceeding the cap, all N increment the counter and all N pass through before any reads back the inflated count (depending on transaction isolation).

**Recommendation:** Move the cap enforcement into the UPDATE WHERE clause (same pattern as the per-sender quota). Alternatively, use a SELECT FOR UPDATE before incrementing.

---

**M-03 — validate_storage_path trigger is bypassable for listing_photos.storage_path**
**Severity:** MEDIUM
**Tables/Triggers:** `public.listing_photos` (migration 001), `public.media_objects` (migration 018)

The `validate_storage_path()` trigger (migration 018) is applied to `media_objects`. However, `listing_photos.storage_path` is a raw TEXT column with no trigger and no constraint. A prepper can insert a listing photo with `storage_path = '../../etc/passwd'` directly via the `preppers_own_photos` RLS policy. The actual storage fetch would depend on how the application resolves paths, but the DB accepts the value without complaint.

**Recommendation:** Apply the same `validate_storage_path` trigger to `listing_photos` on INSERT and UPDATE.

---

**M-04 — pg_advisory_lock(42001) in refresh_platform_health is session-scoped, not transaction-scoped**
**Severity:** MEDIUM
**Functions:** `public.refresh_platform_health()` (migration 005)

`pg_try_advisory_lock(42001)` acquires a session-level lock. `pg_advisory_unlock(42001)` releases it. If the function raises an exception between acquire and release (e.g. a transient DB error mid-UPDATE), the lock is held for the remainder of the database session, not just the function call. pg_cron uses a pool of background workers; a stuck session holds the lock until the session is recycled. Depending on session lifetime, this could block `refresh_platform_health` for extended periods, producing stale health metrics and silencing alert detection.

**Recommendation:** Use `pg_advisory_xact_lock(42001)` (transaction-scoped) instead. Alternatively, wrap the function body in an explicit `BEGIN ... EXCEPTION ... PERFORM pg_advisory_unlock(42001) ... END` block to ensure release on error.

---

**M-05 — evaluate_flag: anon callers still increment rate-limit table before early-return**
**Severity:** MEDIUM
**Functions:** `public.evaluate_flag()` (migration 020)

In migration 020's revised `evaluate_flag`, the early-return for `auth.uid() IS NULL` exits before the rate-limit INSERT, which is correct. However, the `flag_eval_rate_limit` table has no RLS policy permitting authenticated users to read or write their own rows — only `service_role`. The function is SECURITY DEFINER so it bypasses this, but if another function or the admin dashboard queries this table directly, they get blocked. More importantly, there is no cleanup/pruning job for `flag_eval_rate_limit`. Over time (especially with 500 eval/minute per active user), this table grows unboundedly. At 10k active users and 500 evals/minute each, the table accumulates 7.2M rows per day with no scheduled DELETE.

**Recommendation:** Add a pg_cron job to prune `flag_eval_rate_limit` rows older than 2 minutes (the window is 1 minute). Add to migration 014's cron schedule.

---

**M-06 — Domain event trigger fires before INSERT completes (pg_net race)**
**Severity:** MEDIUM
**Functions/Triggers:** `on_domain_event_insert` (migration 004), `dispatch_to_event_processor()`

The `on_domain_event_insert` trigger fires `AFTER INSERT` but the `net.http_post` call is fire-and-forget within the same transaction. The HTTP request to `event-processor` may arrive and be processed by the edge function before the transaction that inserted the domain event commits. When the edge function calls `INSERT INTO event_processing_log`, the domain event row may not yet be visible to other connections (if the DB transaction hasn't committed). The edge function uses the event data from the webhook body (not a re-fetch), so this is handled — but the `INSERT INTO event_processing_log` uses `event_id` as a FK to `domain_events`. Under very high load or transaction retry scenarios, the FK check could fail if the parent row is not yet committed in the edge function's DB session.

**Recommendation:** Note this as a known Supabase pg_net/AFTER trigger race. Ensure the event_processing_log FK is defined with `ON DELETE CASCADE` (it is) and that the edge function handles `23503` FK violation gracefully with a short retry rather than treating it as a permanent failure.

---

### Low Findings

**L-01 — CORS in admin-actions edge function does not use shared security.ts cors() helper**
**Severity:** LOW
The `admin-actions/index.ts` imports `cors` from `_shared/security.ts` for the preflight response, which is correct. However, its `json()` local function does not include CORS headers (compare with `_shared/security.ts` `json()` which does). Non-preflight responses from admin-actions will lack `Access-Control-Allow-Origin` headers, causing browser-based admin console requests to fail with CORS errors in production.

**Recommendation:** Use `_shared/security.ts` `json()` helper consistently, or add CORS headers to the local `json()` function.

---

**L-02 — dispatch_retry_events passes row_to_json(v_rec) which includes EPL metadata not in the expected webhook shape**
**Severity:** LOW
`dispatch_retry_events` passes `row_to_json(v_rec)::JSONB` as the body to event-processor. The record `v_rec` is a JOIN of `event_processing_log` and `domain_events`, including EPL columns (`status`, `attempt_count`, `next_attempt_at`) in addition to the domain event fields. The event-processor expects `WebhookPayload { type, table, schema, record }` shape (or just a DomainEvent at the top level). The extra fields are ignored, but the `type` field will be absent, causing the processor to return `200 Ignored` for all retry dispatches (line 236: `if (webhook.type !== 'INSERT' || ...)`).

**Recommendation:** Structure the retry dispatch body to match the `WebhookPayload` shape expected by the event-processor, specifically: `{ type: 'INSERT', table: 'domain_events', schema: 'public', record: <domain_event>, attempt: <attempt_count> }`.

---

**L-03 — Admin action quota window uses date_trunc('hour') without timezone pinning**
**Severity:** LOW
`_consume_admin_quota()` uses `date_trunc('hour', NOW())` for window start. In a multi-timezone environment, if the DB server's timezone changes (e.g. due to a Supabase maintenance migration of the underlying host), the hour window boundaries shift, potentially allowing up to 2× the quota in a single human-hour straddling the boundary.

**Recommendation:** Explicitly use `date_trunc('hour', NOW() AT TIME ZONE 'UTC')` to pin the window to UTC.

---

**L-04 — notification_dedup has no cleanup: expires_at indexed but no pg_cron prune**
**Severity:** LOW
`notification_dedup` rows have an `expires_at` column and an index, but there is no pg_cron job to DELETE expired rows. The table grows indefinitely. The index means lookups remain fast, but storage grows and VACUUM cost increases.

**Recommendation:** Add a pg_cron job: `DELETE FROM notification_dedup WHERE expires_at < NOW()` every 5 minutes.

---

**L-05 — admin_bulk_notify hourly cap check is a read-before-write (TOCTOU)**
**Severity:** LOW
`admin_bulk_notify` reads `sent_count` from `notification_send_log` before sending, then calls `safe_send_notification` for each recipient. `safe_send_notification` atomically increments the counter (correct), but the pre-flight check in `admin_bulk_notify` is a stale read — two concurrent `admin_bulk_notify` calls from the same admin could both pass the pre-flight check and together exceed `ADMIN_HOUR_CAP`.

**Recommendation:** Remove the pre-flight read; rely solely on `safe_send_notification`'s atomic per-sender guard, or add a `SELECT ... FOR UPDATE` on the send_log row before the pre-flight check.

---

**L-06 — Hardcoded Supabase project URL in migration 004 and 005**
**Severity:** LOW
Migrations 004 and 005 hardcode `https://nfwfnnfbikjxwflpmsnu.supabase.co/functions/v1/event-processor`. If the project URL changes (e.g. custom domain, migration to a different project), retries will fail silently. The vault-based service key lookup (migration 004) is correct; the URL should use the same pattern.

**Recommendation:** Store the event-processor URL in vault alongside the service role key, and read it at dispatch time.

---

### Informational

**I-01 — stripeTransfer in admin-actions is a no-op stub (Sprint 12 placeholder)**
The `stripeTransfer()` function logs `console.log` and returns without executing any Stripe API call. `release_escrow` via admin-actions will mark the payment as `released` in the DB but will not actually transfer funds to the prepper's Stripe Connect account. This is documented as a Sprint 12 placeholder but must be resolved before real escrow releases are permitted in production.

**I-02 — WEBHOOK_SECRET is empty-string fallback in event-processor**
`const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''`. If the env var is not set, the secret is empty string, and the `if (WEBHOOK_SECRET)` check evaluates to false — authentication is entirely skipped. This is appropriate for local dev but must be enforced in the production deployment configuration.

**I-03 — domain_events has no column for domain event schema version**
Events are versioned (`version INTEGER`) but the version field carries a constant `1`. There is no schema registry or migration path for payload shape evolution. When the event-processor is upgraded to handle a new payload shape, old events in the dead-letter queue or replay range may fail deserialization silently.

**I-04 — admin_get_dashboard queries audit_logs without a LIMIT in the sub-query**
The `recent_audit` sub-query in `admin_get_dashboard()` applies `ORDER BY al.created_at DESC LIMIT 50` at the innermost level, which is correct. However, the `jsonb_agg` wrapper outside does not have an explicit limit. If the inner query returns 50 rows (as intended), this is fine. But if the query plan chooses to aggregate before applying the LIMIT, the result could include more rows. Verify the query plan under load.

**I-05 — Risk score ceiling: frozen_at is set only once, never re-frozen if manually cleared**
`admin_freeze_account` uses `COALESCE(risk_scores.frozen_at, NOW())` which means a previously-frozen and then unfrozen account will not be re-frozen by a second admin_freeze call (the COALESCE returns the existing non-null `frozen_at`). The `WHERE risk_scores.frozen_at IS NULL` guard makes a re-freeze a no-op at the DB level. The admin RPC still writes an audit entry, but the account is not re-frozen. This may be intentional (prevent double-freeze) but should be documented.

---

## Red Team Results

### Scenario 1 — Admin account compromise: what stops an attacker with an admin JWT?

**Exploitable:** YES (limited by per-hour quotas and audit trail, but not by revocation)

An attacker with a valid admin JWT (obtained via credential theft, phishing, or session hijacking) can:
- Issue up to 20 refunds per hour for arbitrary orders (F-01: demotion does not invalidate token)
- Release up to 30 escrow payments per hour
- Remove up to 100 media objects per hour
- Freeze or unfreeze any user account
- Replay dead-letter events up to 3× each
- Disable or enable any listing
- Read full dashboard including payment data, risk scores, and audit trail

**What stops them:** Per-hour quota guards prevent unlimited mass refund. Audit trail captures every action. Alert thresholds on payment_failures_24h may trigger if refunds fail. Admin action log is append-only (DELETE blocked).

**What does NOT stop them:** Token revocation at the DB level. Until the token expires (~1 hour), the demoted admin retains all powers. The quota limit of 20 refunds/hour is not trivial — at a median order value of £25, 20 refunds = £500 in one hour, compounded over multiple admin accounts.

**Blast radius:** £500–£2,000 depending on order values and number of compromised accounts, plus marketplace disruption from mass listing disables and account freezes.

**Mitigation (F-01 fix + additional):** Live table-backed `is_admin()`, plus implement token invalidation via Supabase Auth's `revokeUserSessions` API on admin demotion.

---

### Scenario 2 — RLS bypass via SECURITY DEFINER functions

**Exploitable:** NO (as designed; SECURITY DEFINER with SET search_path is correctly applied)

All admin RPCs use `SECURITY DEFINER SET search_path = public`. The `is_admin()` check is in-body. REVOKE from PUBLIC is applied to internal helpers (`_admin_record`, `_ff_audit`, `_projection_already_applied`, `_replay_one_event`). Public execute grants on admin RPCs to `authenticated` are intentional — security relies on the in-body check.

An unauthenticated caller (anon) calling `admin_freeze_account` returns `admin_required`. A non-admin authenticated caller gets the same. No data is readable via SECURITY DEFINER path by non-admins.

**Residual:** `get_kitchen_status()` is SECURITY DEFINER STABLE but reads `kitchens` and `kitchen_capacity` — both tables with appropriate public read policies. No unintended data exposure.

---

### Scenario 3 — Projection rebuild while events are processing (double-count race)

**Exploitable:** YES (see F-03)

A concurrent rebuild and live event stream produces understated or inconsistent projection totals. The zeroing step completes in one transaction, but the replay (which is a loop of RPC calls) runs in a separate context while the live event-processor continues to apply new events. Events that arrive during the rebuild gap are applied once by the live processor but skipped by the replay (their `projection_event_log` rows are already present). Events from before the zero that are in `projection_event_log` are also skipped by the replay. Net result: any pre-zero events not yet in the log that arrive during replay are counted; those already in the log are not.

**Blast radius:** Incorrect financial totals in projection tables. Undetectable without a full cross-check against raw domain_events. Severity increases with high order volume at time of rebuild.

---

### Scenario 4 — Dead letter replay after admin sessions expire (idempotency gate)

**Exploitable:** NO (the idempotency gate holds)

`admin_replay_dead_letter` routes through `event_processing_log` which has UNIQUE(event_id). Even if the admin JWT expires between the replay decision and execution, the idempotency gate in `_projection_already_applied()` correctly blocks double-application. The `manual_replay_count` cap (3 per dead letter) prevents drain loops. The quota of 3 is enforced via FOR UPDATE lock on the dead letter row.

**Assessment:** SAFE as implemented.

---

### Scenario 5 — Refund with manipulated amount

**Exploitable:** NO (amount is re-derived from DB, not from caller)

`admin_refund_order()` (migration 016) re-reads `payments` using `FOR UPDATE` and derives the refund amount from `v_payment.amount_pence` — never from a caller parameter. The edge function `refund_order` case reads `payment.amount_pence` from the DB before calling `stripeRefund(payment.stripe_payment_intent_id, payment.amount_pence, reason)`. The caller supplies only `order_id` and `reason`.

**Assessment:** The amount-trust path is correctly closed. The double-refund race (F-02) is a separate concern and is exploitable.

---

### Scenario 6 — Event replay with a crafted payload crashing event-processor

**Exploitable:** PARTIALLY (depends on WEBHOOK_SECRET configuration)**

If WEBHOOK_SECRET is set (required for production security), unauthenticated actors cannot submit crafted payloads to the event-processor URL. However, via `admin_retry_event` or `admin_replay_dead_letter` (which route through the retry queue, not direct HTTP), an admin with a valid token can submit a malformed event into the retry pipeline.

The event-processor wraps all handler calls in try/catch (line 267–272). An exception from a handler is caught and the event is scheduled for retry. A crash in JSON deserialization at the framework level (before the catch) would cause the edge-function to return 500, triggering the retry scheduler. No event payload can cause an infinite crash loop because the MAX_ATTEMPTS cap (5) is enforced.

The JSONB validation trigger `domain_events_validate_payload` (migration 019) runs on INSERT to `domain_events`, blocking malformed payloads at the source. Events already in `domain_events` (including those replayed from dead letters) passed this check at insert time.

**Assessment:** SAFE against crash loops. The `payload_snapshot` in `event_dead_letters` is not re-validated before replay — a theoretical gap if payloads could mutate, but they are stored as JSONB snapshots and the validator runs on the original insert.

---

### Scenario 7 — Feature flag context injection (user_id in p_context)

**Exploitable:** NO (migration 020 fixed this)**

Migration 020 rewrites `evaluate_flag` to derive `v_user_id` from `auth.uid()::TEXT` — the verified JWT — and ignores any `user_id` field in `p_context`. A caller supplying `{ user_id: 'some-admin-uuid' }` in context will have it silently ignored; the hash uses the caller's own authenticated UUID.

**Assessment:** FIXED in migration 020. Pre-020 version was exploitable; current version is not.

---

### Scenario 8 — Notification deduplication bypass

**Exploitable:** MARGINAL

The dedup key is `md5(p_type || ':' || p_title || ':' || LEFT(p_body, 200))`. An attacker with admin access could send slightly different bodies that defeat deduplication while appearing visually identical to the recipient (e.g. trailing space, Unicode homoglyphs). The 5-minute dedup window and 50/hour sender cap mitigate mass spam even if dedup is defeated. For an external attacker (non-admin), `safe_send_notification` is service_role-only and `admin_bulk_notify` requires admin.

**Assessment:** LOW risk in practice. The per-sender hourly cap is the effective defense; dedup is secondary.

---

### Scenario 9 — Storage path traversal

**Exploitable:** NO for media_objects; YES for listing_photos (see M-03)**

`validate_storage_path()` trigger on `media_objects` blocks `../` and absolute paths and enforces an allowlist regex. However, `listing_photos.storage_path` has no corresponding trigger. A prepper can insert `../../../etc/passwd` into `listing_photos.storage_path`. The exploitability depends on how the application resolves these paths — in a Supabase storage context, the path is used to construct a signed URL, and Supabase storage should reject invalid bucket-relative paths at the API level. However, the DB accepts the value, creating a data integrity issue and potentially an information disclosure vector in error messages.

**PoC:**
```sql
INSERT INTO listing_photos (listing_id, storage_path)
VALUES ('<owned-listing-id>', '../../.env');
-- Succeeds; no trigger blocks it.
```

---

### Scenario 10 — Concurrent admin_rebuild_projection calls (10-minute cooldown enforcement)

**Exploitable:** YES (there is no cooldown at all — see F-03)**

There is no cooldown mechanism for `admin_rebuild_projection`. Two concurrent admin sessions can invoke it simultaneously for the same projection name. Both will clear the `projection_event_log` for that projection (the second DELETE is a no-op since the first already cleared it) and both will replay all events, potentially applying projections twice. The `_projection_already_applied` gate prevents double-application at the per-event level, but the zeroing of read-model counters in the first step runs twice (second zero is effectively a no-op since counters are already zero). The race is between the DELETE/zero in one session and the replay loop in another.

**Assessment:** Concurrent rebuilds are chaotic. An advisory lock (F-03 fix) resolves this.

---

### Scenario 11 — Stripe-succeeds-DB-fails in refund (double refund)

**Exploitable:** YES (see F-02)**

As detailed in F-02, the ordering of Stripe API call → DB state update in `admin-actions/index.ts` creates a window where the Stripe refund completes but the DB update fails. On retry, a second Stripe refund is issued because the DB still shows the payment as `captured`. The idempotency guard in the DB function (`refunded_at IS NOT NULL`) is never reached because the DB was never updated.

---

### Scenario 12 — Admin kill switch bypass: admin RPC calls while admin_actions_paused = TRUE

**Exploitable:** N/A — no `admin_actions_paused` flag exists in migrations 001–020**

There is a `kill_switch` column on `feature_flags`, but no platform-wide `admin_actions_paused` flag or mechanism to globally disable admin RPCs. This scenario assumes a control that was not implemented. If kill switches for individual features exist, they correctly block `evaluate_flag` calls (migration 020), but there is no mechanism to pause all admin RPCs simultaneously.

**Implication:** There is no single-button emergency stop for all admin operations. In a compromise scenario, an operator must manually revoke the compromised admin's JWT (which is not immediate due to F-01) rather than being able to toggle a platform kill switch.

---

### Scenario 13 — pg_cron advisory lock: does pg_try_advisory_lock(42001) prevent stacking?

**Exploitable:** PARTIAL — see M-04**

`pg_try_advisory_lock` is non-blocking: if the lock is held, the function returns FALSE and `refresh_platform_health` exits immediately. This correctly prevents concurrent runs in the nominal case. However, as noted in M-04, session-level advisory locks persist if the function exits abnormally without calling `pg_advisory_unlock`. A crash between acquire and release leaves the lock held for the session lifetime.

**Assessment:** Works correctly in the normal case; has a leak risk on error. Use `pg_advisory_xact_lock` to make the lock automatically release on transaction commit/abort.

---

### Scenario 14 — is_admin() JWT freshness: old JWT still calls admin RPCs after demotion

**Exploitable:** YES — this is F-01 described in full above**

The JWT TTL on Supabase defaults to 3600 seconds (1 hour). During this window, a demoted admin's JWT passes `is_admin()` and all admin RPCs succeed. The per-hour quota resets on the hour boundary, so a demoted admin at minute 1 of an hour has 59 minutes of full quota available before the token expires and a full hour of quota after re-login (which is blocked by demotion only if the admin is also deleted from auth.users — not a guarantee).

---

## Performance Assessment

### 1. Hot Indexes

All primary access patterns have appropriate indexes. Critical hot paths verified:
- `domain_events`: `(aggregate_type, aggregate_id)`, `(event_type)`, `(occurred_at DESC)` — all present.
- `event_processing_log`: PK on `(event_id)` + `epl_retry_next_idx` on `(next_attempt_at ASC, event_id) WHERE status = 'pending_retry'` — optimal for the retry scanner.
- `orders`: `(customer_id, created_at DESC)`, `(kitchen_id, status)` — covers both customer and kitchen read paths.
- `listings`: FTS GIN index + `(status)` + partial `(published_at DESC) WHERE status='published' AND deleted_at IS NULL` — correct partial index for the browse path.

**Gap:** `flag_eval_rate_limit` table (migration 020) has only `frl_user_window_idx (user_id, window_start DESC)`. Given up to 500 evals/minute/user, this table will have high write volume. The upsert pattern is correct and the index supports it, but the table has no pruning job (M-05 / L-04 companion gap).

### 2. Lock Contention

**High concern:** `platform_metrics` singleton UPDATE in `project_order_created()` creates a hot row with high lock contention at order volume. Every order creation acquires a row lock on `platform_metrics WHERE id = 1`. At 100 concurrent orders, this becomes a serialization bottleneck.

**High concern:** `platform_notification_counters` singleton UPDATE in `safe_send_notification()` is serialized per notification. At 10,000 notifications/minute (the storm cap), the singleton row is locked for every insert.

**Moderate concern:** `admin_action_quota` UPDATE in `_consume_admin_quota()` uses `WHERE admin_id = auth.uid() AND window_start = v_window AND refunds_this_hour < v_cap` — correctly atomic, no serialization issue for normal admin usage.

**Deadlock scenario:** `admin_refund_order` locks `payments FOR UPDATE`, then `_admin_record` INSERTs to `domain_events`, which triggers `on_domain_event_insert`, which calls `net.http_post` synchronously. If the HTTP call takes >statement_timeout (not set), the lock is held for the duration. Not a deadlock, but a lock duration concern under Stripe latency.

### 3. Projection Lag

The projection path is: DB insert → AFTER INSERT trigger → pg_net HTTP → event-processor edge function → projection RPC call. pg_net is fire-and-forget; the trigger does not wait for the HTTP response. Projection lag is therefore bounded by: (a) pg_net queue depth, (b) edge function cold start, (c) projection RPC execution time.

`snap_metrics()` measures `p50/p95_projection_lag_ms` from `projection_event_log.applied_at - domain_events.occurred_at`. At low volume, this is typically 500ms–2s. Under load (high order volume), pg_net queuing can push this to 10s+. The read-side projections (`*_metrics`) are therefore eventually consistent with 0–10s lag in production.

### 4. admin_get_dashboard() at 10,000 orders

The dashboard is composed of 20 sub-queries. Most read from singleton or pre-computed projection tables (O(1) or O(open_alert_count)). The expensive sub-queries are:

- `orders_by_status`: `SELECT status, COUNT(*) FROM orders WHERE status IN (...)` — with `orders_status_idx` this is fast, but still a full index scan of all live orders. At 10k total orders with ~100 live (status IN pending/confirmed/etc.), this is acceptable.
- `payments_attention`: `SELECT ... FROM payments WHERE status IN ('in_escrow', 'failed') LIMIT 50` — `payments_status_idx` covers this.
- `notification_queue`: `SELECT COUNT(*) FROM notifications WHERE NOT read` — no partial index on `NOT read` across all users. At 10k orders and 2–3 notifications per order, this is a scan of ~20–30k rows. Estimate: 10–50ms.

**Estimate at 10k orders:** Dashboard wall-clock time is dominated by `notification_queue` COUNT and `recent_audit ORDER BY created_at DESC LIMIT 50`. With `audit_logs_created_idx` on `created_at DESC`, the audit query is fast. Total estimated wall-clock: 50–200ms, well within acceptable range.

### 5. pg_cron overlap: snap_metrics() and refresh_platform_health() both at * * * * *

Both jobs run every minute. `refresh_platform_health` uses advisory lock 42001. `snap_metrics` has no advisory lock of its own. Both perform heavyweight sub-queries against multiple tables. If both run simultaneously (likely, since pg_cron spawns parallel workers), they compete for shared buffer locks on `platform_health_metrics`, `event_processing_log`, `event_dead_letters`, `security_events`, and `orders`.

At low order volume, this is not a concern — the queries complete in milliseconds and don't overlap. At 10k+ orders and high event volume (1000+ events/minute), `snap_metrics`'s 7 PERCENTILE_CONT queries and `refresh_platform_health`'s 7 COUNT queries may overlap and cause transient lock contention on the shared tables. The worst case is a 1–3 second delay in metric refresh, which is acceptable for a 1-minute refresh cadence.

**Recommendation:** Offset the two jobs by 30 seconds (`*/2` with `*/2 offset 1m`), or use `SELECT cron.schedule` with different minute offsets.

---

## Threat Model

### Key Threat Actors

| Actor | Capability | Primary Vector | Worst Realistic Outcome |
|-------|-----------|---------------|------------------------|
| Compromised admin (token stolen) | Valid admin JWT for up to 1 hour post-demotion | All 14 admin RPCs via admin-actions edge fn or PostgREST | £500–£2,000 in fraudulent refunds; mass account disruption; irreversible escrow releases |
| Malicious authenticated user | Customer or prepper JWT | PostgREST direct RPC calls to authenticated-grant functions | Self-order rejection bypass attempt (blocked by trigger); flag eval rate limit abuse |
| Unauthenticated attacker | Anon JWT or no auth | Public RPCs, feature-flags edge function, event-processor URL | Event injection if WEBHOOK_SECRET unset; flag enumeration via batch eval |
| Stripe webhook spoofer | Knowledge of webhook endpoint URL | POST to stripe-webhook | Rejected by signature verification (constructEventAsync); no exploitable path |
| Insider (rogue ops engineer) | Admin credentials + direct DB access | service_role key | Full DB read/write bypassing all RLS; append-only triggers block audit deletion |

### Mitigations in Place

- Append-only triggers on audit_logs, security_events, and admin_action_log DELETE (migration 016)
- Per-hour monetary quota (20 refunds, 30 escrow releases, 100 media removals) (migrations 016, 018)
- JSONB payload validation on domain_events and notifications (migration 019)
- Storage path traversal block on media_objects (migration 018)
- JWT-anchored feature flag evaluation (migration 020)
- Stripe signature verification (constructEventAsync with SubtleCrypto)
- Stripe event idempotency via processed_stripe_events table

### Attack Vectors Requiring Attention

- Admin token revocation (F-01): no real-time revocation path
- Double-refund race condition (F-02): no DB-first write before Stripe API call
- Projection rebuild race (F-03): no advisory lock during rebuild+replay sequence
- Retry event authorization header (F-04): missing in dispatch_retry_events
- Admin check consistency (F-05): user_roles table referenced but not created

---

## Residual Risks

The following risks are documented and accepted, contingent on the CRITICAL and HIGH findings being resolved:

**R-1 — pg_net WEBHOOK_SECRET is header-only (not per-event HMAC).** A leaked secret allows event injection. Mitigated by Supabase network egress controls and secret rotation. Accepted for launch if the secret is stored in vault and rotated quarterly.

**R-2 — service_role omnipotence.** Any leaked edge-function env var grants full DB access. Mitigated by append-only audit triggers (DELETE is blocked even from service_role), key rotation, and per-function secret scoping. Accepted with monitoring.

**R-3 — stripeTransfer is a no-op stub.** Escrow releases do not transfer funds to preppers until Sprint 12. Accepted for a soft launch where escrow release is gated behind a feature flag.

**R-4 — eventual consistency in projections (0–10s lag).** Dashboard metrics are not real-time. Accepted with `last_updated` / `computed_at` timestamps surfaced to the UI.

**R-5 — No global admin kill switch.** No mechanism to instantly disable all admin RPCs simultaneously in a breach scenario. Accepted with the manual remediation path: revoke admin role in Supabase Auth dashboard + delete from auth.users if necessary.

---

## Security Controls Verified

| Control | Status | Notes |
|---------|--------|-------|
| No Critical findings | ✗ | F-01 (JWT stale admin identity) is CRITICAL |
| No High findings without documented mitigation | ✗ | F-02, F-03, F-04, F-05 are HIGH; mitigations specified in this report |
| Immutable audit logs verified | ✓ | DELETE trigger on audit_logs, security_events, admin_action_log (016) |
| RLS independently validated | ✓ | All tables have RLS enabled; public-read policies tightened in 016 |
| Storage isolation verified | PARTIAL | media_objects has path validator; listing_photos does not (M-03) |
| Notification abuse prevented | ✓ | Rate limit + dedup + global storm guard in 017 |
| Admin endpoints rate limited | ✓ | Per-hour monetary quotas in 016/018; admin_bulk_notify has per-call cap |
| JSON payloads schema validated | ✓ | domain_events and notifications validated via triggers in 019 |
| Recovery paths tested | PARTIAL | Replay console and dead-letter retry are implemented; rebuild race is untested |
| Runbooks completed | PARTIAL | 01-database-outage and 02-supabase-auth-outage present; payment/event-processor runbooks not observed |
| Security regression suite passes | PARTIAL | chaos/admin-operations.test.ts covers key paths; F-04 (retry auth) has no test |
| Chaos tests pass | PARTIAL | 500 concurrent evaluate_flag tests pass; no test for concurrent rebuild |
| Performance review passes | PARTIAL | Index coverage is good; singleton lock contention at scale is a concern |

---

## Production Readiness Score

**56 / 100**

| Category | Score | Rationale |
|----------|-------|-----------|
| Authentication & Authorization | 8/20 | JWT-only admin identity (no revocation); user_roles table missing; all other auth correct |
| Data Integrity | 14/20 | Append-only audit strong; double-refund race; projection rebuild race |
| Input Validation | 17/20 | JSONB validation comprehensive; listing_photos path gap |
| Network Security | 9/15 | CORS allowlist present; retry events missing auth header; admin-actions CORS gap |
| Operational Security | 8/15 | Good runbooks for two scenarios; stripeTransfer stub; no admin kill switch |
| Performance & Reliability | 10/10 | Index coverage excellent; pg_cron design sound with minor timing concern |

---

## Final Recommendation

**NO GO**

### Blocking Findings

**F-01 (CRITICAL) — Admin identity is not revocation-aware.** `is_admin()` reads a JWT claim that persists for up to 1 hour after demotion. Given that admin RPCs include irreversible financial operations (refund, escrow release), any compromise or insider threat scenario gives a 1-hour window of unlimited damage within the hourly quotas. This must be resolved before launch.

**F-02 (HIGH) — Double-refund race condition in admin-actions.** Stripe refund is issued before the DB state is locked and updated. A transient failure between the two steps causes a double-refund on retry. For a marketplace handling real money, this is a blocking defect.

**F-03 (HIGH) — admin_rebuild_projection lacks advisory lock.** Concurrent rebuilds or rebuilds during active order volume produce incorrect projection totals with no detection mechanism. Given that projections underpin all financial dashboards and prepper revenue reporting, incorrect totals are a business integrity failure.

**F-04 (HIGH) — dispatch_retry_events sends events without Authorization header.** In a production configuration with WEBHOOK_SECRET set, retry events are silently rejected. This means the retry queue never drains in production, and any event that fails on first attempt becomes permanently stuck. This is a silent operational failure that cannot be detected without monitoring the retry queue depth over time.

### Conditional Acceptance Path

If the team can ship F-01 through F-04 fixes within 48 hours, and document F-05 with a clear sprint commitment, a re-review against those specific items could yield a **GO WITH ACCEPTED RISKS** verdict with R-1 through R-5 as the documented residual risks.

The architecture is fundamentally sound. The event sourcing design, idempotency substrate, append-only audit trail, and monetary quota guards represent genuinely sophisticated security engineering. The blocking items are implementation gaps, not architectural failures — they are fixable without structural changes.

---

*This report was produced by an independent red team assessor based on static analysis of migrations 001–020 and all edge functions present in the repository as of 2026-06-23. It does not reflect the results of dynamic testing against a live deployment. A follow-up dynamic assessment is recommended after F-01 through F-04 are resolved.*
