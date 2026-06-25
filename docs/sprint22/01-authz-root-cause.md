# Sprint 22 — Authorization Root Cause & Migration Strategy

## Root Cause: JWT-Only Admin Authorization

`is_admin()` (migration 010) reads `auth.jwt() -> 'app_metadata' ->> 'role'`. The JWT is
issued at login and carries a 60-minute TTL. The database is never consulted.

When an admin is demoted in the Supabase Auth dashboard the change propagates to
`app_metadata` in the identity store immediately, but the already-issued JWT is not
invalidated. Every request that arrives before token expiry still passes `is_admin()` and
therefore bypasses every RLS policy and every `IF NOT is_admin() THEN RAISE` guard in the
codebase.

There is no revocation path. Short of resetting the user's password (which forces a new
session) there is no mechanism to terminate an active admin session before the token expires.

## Why the 60-Minute Window Is Critical

Every admin RPC in this system has real-world consequences that cannot be undone quickly:

| RPC | Consequence of unauthorized call |
|---|---|
| `admin_refund_order` | Money leaves the platform via Stripe — irreversible once Stripe confirms |
| `admin_release_escrow` | Payout triggered to prepper's bank — irreversible |
| `admin_freeze_account` | User cannot transact — customer harm |
| `admin_rebuild_projection` | Read-model zeroed and replayed — brief data outage |
| `admin_disable_listing` | Prepper's income halted |
| `admin_toggle_flag` / `admin_kill_flag` | Feature flags changed platform-wide |

A demoted admin who retains a live JWT can exercise any of these for up to 60 minutes after
their demotion — long enough to cause irreversible financial harm.

The stripe-refund edge function references a `user_roles` table that was flagged as required
in Sprint 11 but never created, meaning any refactor that adds a DB-authoritative check
against that table would fail at runtime.

## Migration Strategy: Dual-Check (JWT Advisory + DB Authoritative)

The new `is_admin()` function checks both layers on every call:

1. **JWT claim (advisory):** Read `app_metadata.role` from the JWT. This is free (no DB
   round-trip) and covers the 99.9 % case where the JWT and DB agree. The result is used
   only to emit a security event when the JWT and DB diverge — it is never used to grant
   access.

2. **DB check (authoritative):** Query `public.user_roles` for an active (non-revoked,
   non-expired) admin row. If the row is absent or revoked, access is denied — regardless
   of what the JWT says. Role changes take effect on the very next RPC call because
   `user_roles` is queried fresh every time (STABLE function, no caching, no session-level
   variables).

Denial path: if DB says no but JWT says admin, a `critical` security event
`admin_jwt_claim_denied_by_db` is emitted. This is the primary signal that a revocation has
succeeded and that the ex-admin attempted to use their still-valid token.

## Rollback Strategy

If `user_roles` is corrupted or unreachable, the live authorization path will deny all
admin access. The rollback procedure is:

1. Identify the break: `admin_jwt_claim_denied_by_db` events spiking for legitimate admins,
   or admin RPCs failing with `admin_required` for known-good users.

2. Emergency revert of `is_admin()` to JWT-only:
   ```sql
   CREATE OR REPLACE FUNCTION public.is_admin()
   RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
     SELECT COALESCE(
       (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', FALSE
     )
   $$;
   ```
   This can be applied via Supabase SQL editor without a migration (no schema change, just a
   function replace). It does not require a deploy.

3. Fix `user_roles` data / migration bug in a branch, apply, then re-deploy the dual-check
   version from migration 022.

4. Re-seed admin rows via `admin_grant_role` for every active admin.

The revert script should be kept in `docs/sprint22/rollback-is-admin.sql` and referenced in
the on-call runbook.

## Concurrency: Role Changes Are Immediately Visible

`is_admin()` and `is_role()` are declared `STABLE`, which in PostgreSQL means the planner
may cache the result within a single query but **not** across statements. Each RPC call
executes as its own statement inside its own transaction, so every call re-reads
`user_roles`. There is no session-level cache.

`user_roles` rows are updated with a plain `UPDATE` (not deferred). The change is visible
to concurrent readers the moment the updating transaction commits (standard PostgreSQL
read-committed isolation). A revocation committed by one connection is visible to all
subsequent `is_admin()` calls in other connections immediately — no wait, no async flush.

The only residual window is a request already in-flight when the revocation commits. That
request will complete with the pre-revocation authorization result. This is bounded by the
maximum RPC execution time (typically < 500 ms) rather than the 60-minute JWT TTL.
