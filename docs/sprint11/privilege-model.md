# Sprint 11 — Privilege Model: Admin OS

> Pre-implementation. The public schema was wiped 2026-06-21; admin infra is rebuilt from scratch.
> This document defines who can do what, how admin identity is proven, and how privilege escalation is prevented.

## 1. Role Hierarchy

Postgres/Supabase ships four runtime roles. Sprint 11 introduces **admin as a capability on top of `authenticated`**, not as a fifth Postgres role.

| Role | JWT origin | Bypasses RLS? | Trust level | Sprint 11 usage |
|---|---|---|---|---|
| `anon` | no JWT | no | untrusted | public listing reads only |
| `authenticated` | Supabase Auth login | no | user-scoped | preppers, customers, **and admins** all authenticate here |
| `admin` | `authenticated` + `app_metadata.role = 'admin'` | no (RLS still applies) | privileged operator | calls `admin_*` RPCs |
| `service_role` | server-side secret key | **yes** (RLS bypassed) | system / machine | event-processor, pg_cron, edge functions only |

```
service_role ─────────── machine trust, RLS-exempt (NEVER reaches a browser)
      ▲
      │  (admin RPCs run SECURITY DEFINER, effectively borrowing elevated rights
      │   for a single, audited operation — but the *caller* is never service_role)
      │
   admin ──── authenticated + app_metadata.role='admin'  (RLS-bound)
      ▲
authenticated ──── logged-in prepper/customer  (RLS-bound, owner-scoped)
      ▲
   anon ──── public, read-only published data
```

**Key stance:** an admin user is a normal `authenticated` JWT whose `app_metadata` carries the admin claim. The admin *never* receives a `service_role` key. Elevation happens only inside `SECURITY DEFINER` RPCs, for the duration of one call, after `is_admin()` passes.

---

## 2. How Admin Identity Is Established

### Decision: JWT `app_metadata` is the **source of truth**; a table mirrors it for management.

| Option | Verdict | Reasoning |
|---|---|---|
| JWT `app_metadata.role` | **PRIMARY** | `app_metadata` is server-controlled — a user cannot self-set it (unlike `user_metadata`). It is signed into the JWT, so `is_admin()` needs no table read on the hot path. |
| Separate `admin_users` table | **SECONDARY (mirror)** | Used to *manage* the roster (grant/revoke, audit, list) and as a defence-in-depth fallback. The claim is the gate; the table is the registry. |
| RLS function only | rejected as sole source | A pure function still needs a fact to check; `app_metadata` is that fact. |

### Why `app_metadata`, not `user_metadata`
`user_metadata` is writable by the user via the client SDK. `app_metadata` is writable only by `service_role` / the Auth admin API. Granting admin therefore requires a privileged server action — exactly what we want.

### Granting admin (migration 010)
- `admin_users` table: `user_id` (PK, FK auth.users), `granted_by`, `granted_at`, `revoked_at`, `note`.
- Grant is a two-step, both performed by an existing admin (or bootstrap service_role for the first admin):
  1. `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'` (via Auth admin API / `service_role`).
  2. `INSERT INTO admin_users` for the registry + audit.
- Revoke reverses both. `is_admin()` checks the claim first, then falls back to the table for the rare case where a claim has not yet propagated into a freshly minted JWT.

### Bootstrap (first admin)
After a wipe there are zero admins, so no admin can grant the first one. Bootstrap is a one-time `service_role` migration step (`010_seed_admin.sql`, run manually with the operator's `user_id`) that performs both steps above. This is the only time `service_role` touches the admin roster directly.

---

## 3. `is_admin()` Implementation

```sql
-- migration 010_admin_identity.sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE                       -- result is constant within a statement
SECURITY DEFINER             -- may read auth.users / admin_users
SET search_path = public, auth
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_claim  TEXT;
BEGIN
  -- No session → not an admin. Fail closed.
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1) PRIMARY: signed app_metadata claim from the JWT.
  --    request.jwt.claims is set by Supabase on every authenticated request.
  v_claim := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'role',
    ''
  );
  IF v_claim = 'admin' THEN
    -- Defence-in-depth: the claim must also have an un-revoked registry row.
    RETURN EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = v_uid AND revoked_at IS NULL
    );
  END IF;

  -- 2) FALLBACK: registry row alone (covers claim-not-yet-propagated edge case).
  --    Still requires the row to be active. No row → not admin.
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = v_uid AND revoked_at IS NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
```

### Properties
- **Fail closed:** null session, malformed claims, or missing registry row → `FALSE`.
- **AND, not OR, for the claim path:** a forged/stale `app_metadata` claim is useless unless a matching *active* `admin_users` row exists. Revoking admin = setting `revoked_at`, which instantly defeats the claim even before the JWT expires.
- **`STABLE`** so the planner caches it within a statement (RLS uses it heavily).
- **`SET search_path`** pinned to prevent search-path injection (matches the migration 001–009 convention).

---

## 4. RPC Privilege Matrix

Convention: every Sprint 11 RPC asserts its requirement on the first line and raises a typed error (`not_admin`, `forbidden`) before any read/write.

| RPC | Required privilege | Surface |
|---|---|---|
| `is_admin()` | authenticated | internal gate |
| **Dashboard** | | |
| `admin_get_dashboard()` | `is_admin()` | read |
| `admin_get_observability(window)` | `is_admin()` | read |
| **Actions** | | |
| `admin_freeze_account(user_id, reason)` | `is_admin()` | write |
| `admin_unfreeze_account(user_id, reason)` | `is_admin()` | write |
| `admin_verify_prepper(kitchen_id)` | `is_admin()` | write |
| `admin_unverify_prepper(kitchen_id, reason)` | `is_admin()` | write |
| `admin_disable_listing(listing_id, reason)` | `is_admin()` | write |
| `admin_enable_listing(listing_id)` | `is_admin()` | write |
| `admin_refund_order(order_id, reason)` | `is_admin()` | write (irreversible) |
| `admin_release_escrow(order_id)` | `is_admin()` | write (irreversible) |
| `admin_retry_event(event_id)` | `is_admin()` | write |
| `admin_replay_dead_letter(dead_letter_id, dry_run)` | `is_admin()` | write |
| `admin_resend_notification(notification_id)` | `is_admin()` | write |
| `admin_clear_abuse_review(user_id, note)` | `is_admin()` | write |
| `admin_rebuild_projection(name, dry_run)` | `is_admin()` | write |
| **Feature flags** | | |
| `flag_enabled(key, ctx)` | **public** (any role) | read — evaluated everywhere |
| `admin_set_flag(key, ...)` | `is_admin()` | write |
| `admin_set_flag_rule(key, scope, ...)` | `is_admin()` | write |
| `admin_kill_switch(key, on)` | `is_admin()` | write |
| **Replay** | | |
| `admin_replay_event(id, dry_run)` | `is_admin()` | write |
| `admin_replay_range(from, to, type, dry_run)` | `is_admin()` | write |
| **System (no human caller)** | | |
| `refresh_admin_dashboard()` | `service_role` only | cron |
| `ops_record_latency(kind, ms)` | `service_role` only | edge fns |
| `ops_rollup()` | `service_role` only | cron |
| `_admin_emit_event(...)` (internal helper) | `service_role` only | internal |

### GRANT discipline (migration 017, mirrors migration 009)
```sql
-- All admin_* RPCs: callable by authenticated (gate is is_admin() inside), never anon.
REVOKE EXECUTE ON FUNCTION public.admin_freeze_account(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_freeze_account(uuid, text) TO authenticated;
-- ... repeat per admin_* RPC ...

-- System RPCs: service_role only.
REVOKE EXECUTE ON FUNCTION public.refresh_admin_dashboard() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.refresh_admin_dashboard() TO service_role;
REVOKE EXECUTE ON FUNCTION public.ops_record_latency(text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ops_record_latency(text, integer) TO service_role;

-- flag_enabled stays public.
GRANT  EXECUTE ON FUNCTION public.flag_enabled(text, jsonb) TO anon, authenticated, service_role;
```

---

## 5. Principle of Least Privilege — per RPC

| RPC | Minimal scope it is allowed to touch | What it is explicitly NOT allowed to do |
|---|---|---|
| `admin_get_dashboard` | SELECT on snapshot + health singletons | no transactional reads, no row-level PII beyond aggregates |
| `admin_get_observability` | SELECT on `ops_*` rollups | cannot read raw request bodies |
| `admin_freeze_account` | UPDATE `risk_scores.frozen_at` for one `user_id` | cannot delete user, cannot touch `auth.users`, cannot change automated thresholds |
| `admin_verify_prepper` | UPDATE `kitchens.verified_at/by` for one kitchen | cannot edit listings, payouts, or bio |
| `admin_disable_listing` | UPDATE `listings.status → 'paused'` for one listing | cannot set `deleted`, cannot edit price/content |
| `admin_refund_order` | UPDATE `payments.status → 'refunded'` for one order's payment | cannot alter `amount_pence`; refund amount = recorded amount only |
| `admin_release_escrow` | UPDATE `payments.status → 'released'` for one order | cannot change payout split; uses recorded `prepper_payout_pence` |
| `admin_retry_event` | UPDATE one `event_processing_log` row → `pending_retry` | cannot edit `domain_events` payload (events are immutable) |
| `admin_replay_dead_letter` | re-dispatch one `event_dead_letters` row | cannot rewrite the original event |
| `admin_resend_notification` | INSERT one `notifications` row mirroring an existing one | cannot edit other users' notifications |
| `admin_clear_abuse_review` | UPDATE `risk_scores.review_required_at = NULL` | cannot zero the risk `score`, cannot unfreeze |
| `admin_rebuild_projection` | DELETE+replay `projection_event_log` for one `projection_name` | cannot touch `domain_events` (read-only source of truth) |
| `admin_set_flag*` | UPSERT `feature_flags` / `feature_flag_rules` | cannot affect business data or escrow |

**Pattern:** each action takes the *minimum* identifying argument (one id) and mutates the *minimum* set of columns. No `admin_*` RPC accepts a free-form SQL fragment, a table name to update, or an amount/split override. Monetary values are always read from the existing row, never supplied by the caller — this is the core anti-fraud control.

---

## 6. Preventing Privilege Escalation

| Vector | Control |
|---|---|
| User self-grants admin | `app_metadata` is server-only; `user_metadata` is never consulted by `is_admin()`. |
| Forged/stale JWT claim | `is_admin()` requires an active `admin_users` row in addition to the claim (AND logic). Revoke is instant via `revoked_at`, independent of JWT expiry. |
| `SECURITY DEFINER` abuse | Every definer RPC pins `SET search_path = public[, auth]` (no path injection) and asserts `is_admin()` on line 1 before any side effect. |
| Refund/payout amount tampering | Monetary RPCs never accept amounts; they read `payments.amount_pence` / `prepper_payout_pence` from the row. Caller controls *which* order, never *how much*. |
| Admin mutating `auth.users` | No admin RPC writes `auth.users` except the dedicated grant/revoke flow, which itself requires `is_admin()` and is fully audited. An admin cannot grant admin to themselves without already being one. |
| Replay/rebuild data corruption | Replay is idempotent via `projection_event_log`; rebuild runs under advisory lock in a single transaction; `domain_events` is read-only (immutable log). |
| Lateral table writes | `REVOKE EXECUTE ... FROM PUBLIC` on every privileged RPC; `anon` can call nothing but `flag_enabled` and public reads. |
| service_role key leakage to client | `service_role` is used only by edge functions / cron. The admin dashboard authenticates as `authenticated` and never holds the key. Enforced by code review + the GRANT matrix above. |
| Audit gap | Every `admin_*` write inserts an `audit_logs` row (`actor_id = auth.uid()`) *and* emits a `domain_events` row before returning. An action that cannot be audited must not run (audit insert is in the same transaction as the mutation). |

### Escalation invariant
> An `authenticated` user with no active `admin_users` row can invoke any `admin_*` RPC, but every one returns `not_admin` before touching state. The only privileged surface is the set of `is_admin()`-gated RPCs, and none of them can be used to grant admin, move money beyond a recorded amount, or mutate the immutable event log.
