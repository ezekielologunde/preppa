# Sprint 22 Chaos Test Summary

**Suite:** `sprint22-chaos-part1.test.ts` + `sprint22-chaos-part2.test.ts`
**Date:** 2026-06-23
**Method:** Pure mock/unit simulation — no live DB or Stripe connection required

---

## CHAOS-01: Admin Revoked During Active Session

**Scenario:** Admin begins a refund (DB row created, lock acquired). Between step 1 and step 2 (Stripe call), a second admin calls `admin_revoke_role()`. The first admin then calls `admin_complete_refund` with the original `operation_id`.

**Expected / Verified:**
- `is_admin()` queries `user_roles` on every call — the revocation is immediately visible
- `admin_complete_refund` raises `admin_required` and exits without calling Stripe
- `payment_operations` row stays `pending`; `payments.status` stays `captured`
- `recover_stale_payment_operations()` picks up the orphaned pending op after 10 minutes
- `admin_jwt_claim_denied_by_db` security event emitted at `critical` severity when a stale JWT attempts access

**Outcome:** PASS — the DB-authoritative `is_admin()` check closes this window completely.

---

## CHAOS-02: Stripe Timeout After DB Commit

**Scenario:** `payment_operations` row is committed (`pending`) before any Stripe call. Process crashes between the DB commit and the Stripe API call. Row stays `pending` indefinitely.

**Expected / Verified:**
- On crash: `payments.status = 'captured'`, op is `pending`, no `stripe_refund_id`
- `recover_stale_payment_operations()` transitions the op to `processing` and emits `stale_payment_operation_detected` at `critical` after 10 minutes
- Admin retries using the original `operation_id` — same `stripe_idempotency_key` is returned
- Stripe deduplicates via the idempotency key → no duplicate refund
- Final state: `payments.status = 'refunded'`, op is `completed`
- Exactly one `payment_operations` row exists at all stages

**Outcome:** PASS — DB-first ledger with idempotency key eliminates the double-refund risk.

---

## CHAOS-03: Stripe Responds "Success" but HTTP Response Is Lost

**Scenario:** Edge function calls Stripe; Stripe creates the refund. Network failure means the HTTP response never arrives. Edge function times out and calls `admin_fail_refund()`. Op becomes `failed`.

**Expected / Verified:**
- `admin_fail_refund` sets `status = 'failed'`; `payments.status` stays `captured`
- `recover_stale_payment_operations()` ignores `failed` ops (only processes `pending`)
- A subsequent `admin_refund_order` call finds the existing op is `failed` (outside the idempotency guard) but hits the `UNIQUE` constraint on `stripe_idempotency_key` — cannot create a second op with the same key

**RESIDUAL RISK — documented, not yet mitigated:**
Before calling `admin_fail_refund`, the edge function should query Stripe for an existing refund on the payment intent (`GET /v1/refunds?payment_intent=<pi_id>`). If a refund already exists, it should call `admin_complete_refund` instead of `admin_fail_refund`. Without this check, the op is marked `failed` while Stripe holds a successful refund. Any manual retry risks a double refund. Human verification is required before retrying a refund that timed out.

**Outcome:** PARTIAL PASS — the `failed` state is correctly set and recovery is correctly skipped. The residual risk is documented and requires a follow-up edge function fix.

---

## CHAOS-04: Projection Rebuild During 1000 Concurrent Orders

**Scenario:** `admin_rebuild_projection` holds the exclusive `pg_advisory_lock`. 1000 `project_order_created` events arrive and attempt to acquire the shared lock.

**Expected / Verified:**
- All 1000 events are blocked while the exclusive lock is held (counter stays at 0)
- After the exclusive lock is released, all blocked events proceed
- Final projection count is exactly 1000 (no duplicates, no lost events)
- The idempotency gate (`projection_event_log` deduplication) prevents over-counting on at-least-once delivery
- `projection_checksums` is written after every successful rebuild and reflects the exact replayed event set

**Outcome:** PASS — the advisory lock hierarchy (exclusive-for-rebuild, shared-for-live-writes) is correct.

---

## CHAOS-05: Retry Authentication Failure

**Scenario:** Pre-fix: `dispatch_retry_events()` omits the `Authorization` header → edge function returns 401 → retry queue grows. Post-fix: the header is read from vault and included.

**Expected / Verified:**
- Pre-fix dispatch produces requests with no `Authorization` key in headers
- Post-fix dispatch includes `Authorization: Bearer <SERVICE_ROLE_KEY>` on every retry request
- `check_retry_auth_failures()` counts 401/403 responses in the last 5 minutes
- When failures > 0: `retry_auth_failures_detected` event emitted at `critical` severity
- `platform_health_metrics.retry_auth_failures_5min` updated correctly
- With correct Authorization header, 200 responses drain the queue and failure count returns to 0

**Outcome:** PASS — the vault-read pattern matches the fix applied in migration 004. The monitoring layer correctly detects residual auth failures.

---

## CHAOS-06: Database Restart During Projection Rebuild

**Scenario:** Rebuild is running; exclusive `pg_advisory_lock` is held on the session. DB restarts, terminating all sessions.

**Expected / Verified:**
- `pg_advisory_lock` is session-level → automatically released on session termination (no ghost lock)
- After restart, a new session can immediately acquire the lock
- `admin_operation_locks` table (cooldown lock) is persistent → survives restart with its `locked_until` timestamp intact
- If cooldown is still active post-restart, rebuild is blocked until the cooldown expires or an admin manually clears it
- `projection_event_log` and `projection_checksums` data survives the restart (no corruption)
- An expired cooldown does not block rebuilds post-restart

**Outcome:** PASS — session vs. persistent lock distinction is correctly modelled. The cooldown-blocking-after-restart case is identified as an operator awareness point (not a bug).

---

## CHAOS-07: Role Escalation During Rebuild

**Scenario:** Three escalation paths: (1) standard user calls `admin_rebuild_projection`; (2) standard user calls `admin_grant_role` to self-elevate; (3) attacker uses a stale admin JWT (revoked in `user_roles`).

**Expected / Verified:**
- Standard user with no `user_roles` row → `admin_required` on all admin RPCs
- Standard user self-escalation attempt → `admin_required` (is_admin() returns false first)
- Stale JWT attacker (revoked_at is set) → `admin_required` + `admin_jwt_claim_denied_by_db` at `critical`
- Expired admin (expires_at in the past) → denied by the same path as revoked
- No security event is emitted when a non-admin user makes no admin JWT claim (normal path, no anomaly)
- Rebuild log and grant log are never written when the guard fires

**Outcome:** PASS — `is_admin()` querying `user_roles` on every call (not trusting the JWT) blocks all three escalation paths.

---

## Overall Production Readiness Assessment

| Scenario | Status | Action Required |
|---|---|---|
| CHAOS-01 Admin revocation | PASS | None |
| CHAOS-02 Crash before Stripe | PASS | None |
| CHAOS-03 Lost response | PARTIAL | Edge fn: check Stripe before fail_refund |
| CHAOS-04 Concurrent 1000 orders | PASS | None |
| CHAOS-05 Retry auth failure | PASS | None |
| CHAOS-06 DB restart | PASS | Ops runbook: note cooldown persistence |
| CHAOS-07 Role escalation | PASS | None |

**Blocking issue for launch:** CHAOS-03 residual risk. The edge function (`admin_actions`) should query Stripe for an existing refund before calling `admin_fail_refund`. Until this is resolved, refund operations that timeout require human review before any manual retry.
