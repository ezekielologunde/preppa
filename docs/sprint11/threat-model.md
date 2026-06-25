# Threat Model — Sprint 11: Operations Control Plane

**Author:** Principal Security Engineer / Red Team Lead
**Date:** 2026-06-22
**Classification:** Internal + External Auditor
**Scope:** The greenfield admin infrastructure introduced in Sprint 11 — Feature Flag Service, Admin Actions (freeze/unfreeze, verify prepper, disable listing, refund order, release escrow, retry event, replay dead letter, rebuild projection), Replay Console, Observability pipeline, and the Admin Dashboard (reads from projection tables).

**Grounded against current migrations:** `001_listing_core`, `002_marketplace_core`, `003_event_orchestration`, `004_event_processor_webhook`, `005_reliability_layer`, `006_cqrs_projections`, `007_notification_abuse`, `008_storage_hardening`, `009_security_hardening`; edge functions `event-processor`, `stripe-refund`, `_shared/security.ts`.

---

## 0. The Central Risk: There Is No Admin Trust Model Yet

The admin schema was wiped on 2026-06-21 with the public-schema reset. As of this writing the codebase contains:

- **No `profiles` / `user_roles` table.** No place to store `is_admin`.
- **No `is_admin()` / `has_role()` SQL helper.** Every existing privileged path keys on `auth.uid()` for *ownership* (`prepper_id = auth.uid()`), never on *role*.
- **No admin policy on `audit_logs`.** Migration 002 creates only `CREATE POLICY service_role_audit ON public.audit_logs TO service_role USING (true)` — no INSERT/UPDATE/DELETE restriction, no append-only enforcement, no integrity chain.
- **No admin RPCs.** `admin_refund_order`, `admin_release_escrow`, `admin_freeze_account`, etc. do not exist. They are about to be written.
- **Service role bypasses all RLS.** Every edge function holds `SUPABASE_SERVICE_ROLE_KEY`; a single leaked key or one over-broad admin RPC = full cross-tenant compromise.

**Consequence:** Sprint 11 is not "add features to a hardened admin plane." It is "build the admin trust boundary from zero." Every authorization decision in this document is a *new* control that must be designed correctly the first time. The most dangerous failure mode is shipping admin RPCs that rely on `GRANT EXECUTE TO authenticated` with an *in-body* role check that is missing, fail-open, or bypassable.

### 0.1 Canonical admin-authorization design (referenced throughout)

All Sprint 11 admin controls assume this layered model. Findings reference it by name.

```sql
-- (1) Role storage — NOT a client-writable column.
CREATE TABLE public.user_roles (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin','ops','support','readonly_admin')),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- No authenticated INSERT/UPDATE/DELETE policy. Writes only via SECURITY DEFINER
-- grant_role() RPC that itself requires an existing admin + writes audit_logs.

-- (2) Authoritative, fail-CLOSED role check. NULL must never match-all.
CREATE OR REPLACE FUNCTION public.is_admin(p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT TRUE FROM public.user_roles
      WHERE user_id = p_user AND role IN ('admin','ops')
      LIMIT 1),
    FALSE);  -- p_user NULL → no row → FALSE. Fails closed.
$$;

-- (3) Every admin RPC re-asserts at the top, BEFORE any side effect:
--   IF NOT public.is_admin() THEN
--     PERFORM emit_security_event('admin_denied', auth.uid(), NULL, 'warn', ...);
--     RAISE EXCEPTION 'forbidden';
--   END IF;
```

**Why a table, not a JWT claim, is the source of truth:** Supabase JWTs carry `app_metadata`, but `auth.jwt()` reflects whatever was minted at the last token refresh. A revoked admin keeps a valid admin claim until their token expires (see §10, S-11). The DB table is the live source of truth; the JWT is at most a fast-path hint that the RPC must *re-verify* against the table.

---

## 1. Trust Boundaries

| # | Boundary | Direction | Trust assumption | Enforcement point |
|---|----------|-----------|------------------|-------------------|
| TB-1 | Admin browser → admin edge fn / RPC | Untrusted client → privileged action | JWT proves *identity*; client is fully attacker-controllable (DevTools, forged body). Admin status must be re-derived server-side | `is_admin()` re-check inside every RPC + `verify_jwt=true` on admin edge fns |
| TB-2 | Client → Feature Flag evaluation | Untrusted → authorization decision | Client must **never** decide a flag that gates authorization. Client may read flag *values*, but enforcement is server-side | Server-side `evaluate_flag()`; flags that gate auth are checked in the RPC, not the client |
| TB-3 | Admin RPC (SECURITY DEFINER) → orders/payments/listings | Privileged DB execution | DEFINER runs as owner, bypasses RLS. A missing in-body role check = anyone with the RPC grant gets admin power | In-body `is_admin()` + `SET search_path` + explicit row targeting |
| TB-4 | Replay Console → `event-processor` / projectors | Operator-triggered re-execution | A human/automation can fire the same replay N times; handlers must be idempotent on `event_id` | `projection_event_log` PK gate + `event_processing_log` UNIQUE(event_id) |
| TB-5 | `pg_net` / `pg_cron` → `event-processor` (`verify_jwt=false`) | Internal | Only triggers/scheduler should call it; URL is network-reachable | Shared `WEBHOOK_SECRET` bearer (header only, not per-message HMAC) |
| TB-6 | Observability pipeline → log sinks | Internal → external sink | Logs may contain PII/secrets if not scrubbed; sink is a new egress path | Field allowlist + scrubbing before emit; sink auth |
| TB-7 | `audit_logs` / `security_events` writer → table | Append-only intent | Today nothing prevents service_role / a buggy admin RPC from DELETEing audit rows | Append-only trigger (block UPDATE/DELETE) + optional hash chain |
| TB-8 | Admin dashboard → projection tables | Read | Dashboard reads `*_metrics`, `platform_metrics`. These are `public_read` today — cross-tenant aggregate leakage if PII lands in them | Keep projections aggregate-only; gate per-tenant reads |

**Key insight:** TB-1, TB-2, and TB-3 collapse into one question — *"is the admin check performed server-side, in the privileged execution context, against a live source of truth, and does it fail closed?"* Every critical finding below is an instance where that question is answered "no" by default.

---

## 2. Attack Surface Inventory

| Entry point | Auth (target design) | Primary protection | Residual gap |
|-------------|----------------------|--------------------|--------------|
| `evaluate_flag(flag_key)` RPC / edge fn | `authenticated` | Server-side eval, value-only | Flooding (no rate limit); flag used client-side for auth (design error) |
| `admin_freeze_account(user_id, reason)` | admin-only RPC | `is_admin()` + audit | Mass-freeze loop; parameter tampering |
| `admin_verify_prepper(prepper_id)` | admin-only RPC | `is_admin()` + audit | Self-verify; reputation tampering |
| `admin_disable_listing(listing_id)` | admin-only RPC | `is_admin()` + audit | Cross-tenant disable (any listing_id), censorship |
| `admin_refund_order(order_id, amount?)` | admin-only RPC → `stripe-refund` | `is_admin()` + idempotency + cap | Mass refund loop; double refund; amount tampering |
| `admin_release_escrow(payment_id)` | admin-only RPC | `is_admin()` + state machine | Mass payout; release-before-delivery; double release |
| `admin_retry_event(event_id)` | admin-only RPC | `is_admin()` + EPL gate | Re-fires through processor — must hit idempotency lock |
| `admin_replay_dead_letter(dl_id)` | admin-only RPC | `is_admin()` + `projection_event_log` gate | Drain loop = duplicate side-effects if gate bypassed |
| `admin_rebuild_projection(name)` | admin-only RPC | `is_admin()` | Double-count if rebuild doesn't reset+replay atomically |
| `admin_resend_notification(...)` | admin-only RPC | `is_admin()` + cap | Bulk spam (push/email) |
| `admin_remove_media(media_id)` | admin-only RPC | `is_admin()` + audit | Bulk destruction; cross-tenant deletion |
| Admin dashboard reads | `authenticated` + `is_admin()` | RLS on read-models | `public_read` projections leak aggregates broadly |
| `event-processor` URL | `WEBHOOK_SECRET` | Bearer check | `verify_jwt=false`; secret in header only |

---

## 3. Subsystem Threat Analysis (STRIDE)

### 3.1 Feature Flag Service

**Assets at risk:** Authorization gates that depend on flags (kill-switches, gated admin actions, rollout of risky ops like escrow release); flag config integrity.

**Threat actors:** External attacker (force-enable a gated capability), malicious customer/prepper (flip a flag that unlocks pricing/discount logic), compromised admin (silently disable security controls).

| STRIDE | Vector | Existing mitigation | Residual / recommended |
|--------|--------|---------------------|------------------------|
| **S** Spoofing | Client claims a flag is ON to unlock a path | None yet | **Server-side evaluation is the only authority.** Any flag that gates authorization must be re-checked inside the privileged RPC, not trusted from the client (S-2). |
| **T** Tampering | Direct write to `feature_flags` table | Will need RLS | Flags table: `public`/`authenticated` SELECT for non-secret flags only; **no** authenticated INSERT/UPDATE; writes via `admin_set_flag()` (admin-only) + audit_logs. |
| **R** Repudiation | Admin flips a flag, denies it | None | Every flag mutation → `audit_logs` (before/after) + `security_events`. |
| **I** Info disclosure | Client reads a flag that reveals an unreleased feature or a security posture (e.g. `escrow_auto_release_enabled`) | None | Mark flags `client_visible BOOLEAN`; evaluation endpoint returns only client-visible flags to non-admins. Server-only flags never serialized to clients. |
| **D** DoS | Flood `evaluate_flag` to exhaust DB connections | None | Cache evaluations (short TTL); rate-limit per user/IP; flag table is tiny and cacheable in-process (S-14). |
| **E** EoP | Flag mis-modeled *as* the authorization decision rather than a *modifier* of it | Design risk | Flags toggle features; **roles** authorize. Never `IF flag_enabled THEN allow_admin_action`. |

**Residual risk:** A flag is the wrong primitive for authorization. The recommended invariant: *a flag can only ever make an action more restricted, never grant privilege a role check already denied.*

### 3.2 Admin Actions (state-changing RPCs)

**Assets at risk:** Customer funds (refund/escrow), prepper payouts, account availability (freeze), marketplace integrity (verify/disable), media.

**Threat actors:** Compromised admin (stolen session/credential), insider (rogue ops), external attacker who reaches an admin RPC with a missing/fail-open role check, rogue edge function (leaked service key).

| STRIDE | Vector | Existing mitigation | Residual / recommended |
|--------|--------|---------------------|------------------------|
| **S** Spoofing | Non-admin calls `admin_*` RPC directly via PostgREST | None — RPCs don't exist yet | **Default-deny:** `REVOKE EXECUTE ... FROM PUBLIC`; grant to a dedicated role; in-body `is_admin()` re-check (canonical §0.1). |
| **T** Tampering | Parameter tampering — pass arbitrary `order_id`/`amount`/`payment_id` | None | Re-derive amounts from DB state (never trust caller `amount`); validate target ownership/state machine; cap per-action and per-window (S-6, S-7, S-13). |
| **R** Repudiation | Admin denies a destructive bulk action | `audit_logs` table exists | Append-only `audit_logs` + `security_events`; record actor, target, before/after, IP, reason. **Block UPDATE/DELETE on audit tables** (TB-7, S-3). |
| **I** Info disclosure | Admin RPC returns full PII / other tenants' rows in error or result | None | Minimal return shape; structured errors; no raw row dumps in exceptions. |
| **D** DoS | Mass refund / mass freeze loop drains funds or locks out users | None | Per-action idempotency keys; per-window quotas; "bulk" actions require an explicit batch RPC with a hard cap + second-approval for > N targets (S-6, S-7, S-8, S-9). |
| **E** EoP | `GRANT EXECUTE TO authenticated` with no/weak in-body check; SECURITY DEFINER without `SET search_path`; `is_admin()` returns NULL → treated as truthy | Pattern exists in codebase (`my_prepper_id` NULL-bypass note) | Fail-closed `is_admin()`; pinned `search_path`; explicit grants; static check that every `admin_*` RPC contains an `is_admin()` guard (S-1). |

### 3.3 Replay Console + Retry/Dead-Letter

**Assets at risk:** Financial counters (`prepper_metrics.total_revenue_pence`, `kitchen_metrics`, `platform_metrics`), notification side-effects, escrow/payout side-effects triggered by re-processed events.

**Threat actors:** Compromised/clumsy admin (double-fire), external attacker reaching the replay path, rogue edge fn re-dispatching.

| STRIDE | Vector | Existing mitigation | Residual / recommended |
|--------|--------|---------------------|------------------------|
| **S** Spoofing | Forged call to `event-processor` to replay an event | `WEBHOOK_SECRET` bearer (TB-5) | Header-only secret; if leaked, events can be forged. Recommend per-message HMAC + network egress controls (accepted residual for now). |
| **T** Tampering | Replay with a mutated `payload_snapshot` (e.g. higher `total_pence`) | None | Replay must re-fetch the *original* `domain_events.payload` by `event_id`, never trust an operator-supplied payload (S-4, S-13). |
| **R** Repudiation | Operator drains the dead-letter queue, denies it | `event_dead_letters.resolved_by` column exists | Record `resolved_by`/`resolution_note` + `audit_logs`; replay action emits `security_event`. |
| **I** Info disclosure | Replay console lists other tenants' event payloads | `domain_events` is service_role-only | Console reads via admin RPC; never expose raw `payload` to non-admins. |
| **D** DoS | Replay the same dead letter 1000× (drain attack) | `projection_event_log` PK + `event_processing_log` UNIQUE(event_id) | **Replay MUST route through the same idempotency entrypoint.** If it calls handlers directly, the gate is bypassed and counters double-apply (S-5). |
| **E** EoP | `admin_replay_dead_letter` lacks role check, or `rebuild_projection` runs as service_role with no `is_admin()` | None yet | Canonical guard; rebuild must be `TRUNCATE read-model + reset projection_event_log rows for that projection + replay` in one transaction, else duplicates (S-4). |

**The single most important replay invariant:** *Idempotency is keyed on `(event_id, projection_name)` in `projection_event_log`. Any replay/retry/rebuild that does not pass through `_projection_already_applied()` (or the EPL INSERT-lock) will double-apply non-idempotent effects.* `project_order_created` and `increment_kitchen_orders` are correctly gated today (migrations 006/009); a direct-handler replay bypasses both.

### 3.4 Observability Pipeline

**Assets at risk:** PII (delivery addresses in `orders.delivery_address`, customer identifiers), secrets (service keys, Stripe IDs, JWTs), `security_events` integrity.

| STRIDE | Vector | Existing mitigation | Residual / recommended |
|--------|--------|---------------------|------------------------|
| **S** | Forged log injection (CRLF/control chars to fake entries) | None | Structured (JSON) logging only; escape/strip control chars; never string-concatenate user input into log lines. |
| **T** | Tamper with `security_events` rows | service_role-only RLS | Add append-only trigger (block UPDATE/DELETE) — mirror audit_logs hardening (S-3). |
| **R** | Missing logs for admin actions | partial | Mandatory `security_event` on every admin action, login, role change, denied admin attempt. |
| **I** | PII/secret leakage into logs or error responses | None | Field allowlist + scrubber before sink; never log JWTs, service keys, `delivery_address`, Stripe PII; redact in error responses. |
| **D** | Log-volume amplification (attacker triggers high-severity events to flood) | None | Sample/aggregate repeated events; bound per-actor event emission. |
| **E** | Log sink credentials grant pivot | None | Scope sink token to write-only append; rotate; never embed in client builds. |

### 3.5 Admin Dashboard (reads)

**Assets at risk:** Cross-tenant business metrics, individual prepper/customer revenue/LTV.

The projection tables today: `prepper_metrics` and `customer_metrics` are owner-scoped SELECT (`prepper_id = auth.uid()` / `customer_id = auth.uid()`), but `kitchen_metrics`, `platform_metrics`, `listing_stats`, and `platform_health_metrics` are `public_read USING (true)`. A non-admin authenticated user can already read **every kitchen's order count and revenue** and full platform totals.

| STRIDE | Vector | Existing mitigation | Residual / recommended |
|--------|--------|---------------------|------------------------|
| **I** Info disclosure | Any logged-in user queries `kitchen_metrics` / `platform_metrics` directly via PostgREST | `public_read` policy = **leak by default** | Decide intent: if these power a public leaderboard, keep but ensure they contain **no PII** and only already-public aggregates. If admin-only, replace `public_read` with `is_admin()` SELECT (S-10 cross-ref / dashboard finding below). |
| **E** EoP | Dashboard "read" RPC reused to mutate | n/a | Dashboard RPCs are `STABLE`/read-only; no write path. |

---

## 4. Threat Actor Capability Matrix

| Actor | Auth they hold | Can reach | Worst case if a control fails |
|-------|----------------|-----------|-------------------------------|
| External attacker | none / anon JWT | public RPCs, flag eval, `event-processor` URL | Forge events (if secret leaks); flood flag eval; hit any `admin_*` RPC missing a role check |
| Malicious customer | valid customer JWT | own orders, flag eval, any RPC granted to `authenticated` | Self-refund / parameter-tamper if admin RPCs are `authenticated`-callable; read `public_read` metrics |
| Malicious prepper | valid prepper JWT | own kitchen/listings, flag eval | Self-verify, cross-tenant listing disable if target not ownership-checked; reputation tampering |
| Compromised admin | valid admin JWT/session | every admin RPC | Mass refund/payout, mass freeze, audit deletion, flag kill-switch of security controls |
| Insider (rogue ops) | legitimate admin | every admin RPC | Same as compromised admin, plus knows where the gaps are |
| Rogue / compromised edge fn | `SUPABASE_SERVICE_ROLE_KEY` | all tables, RLS bypassed | Full cross-tenant read/write; can delete audit_logs unless append-only trigger blocks it |

---

## 5. Existing Mitigations (what we can build on)

- **Idempotency substrate:** `projection_event_log (PK event_id, projection_name)` + `_projection_already_applied()` + `event_processing_log.event_id UNIQUE`. Replay safety is *achievable* if every admin replay routes through these.
- **SECURITY DEFINER + `SET search_path = public`** is consistently applied across existing RPCs (001–009) — the pattern to follow for admin RPCs.
- **Privilege revocation pattern** demonstrated in migration 009 (`REVOKE EXECUTE ... FROM PUBLIC` then explicit `GRANT ... TO service_role`) — reuse verbatim for admin RPCs but grant to an `admin`-bearing path, not `authenticated`.
- **`emit_security_event()`** (migration 005, SECURITY DEFINER) — ready-made audit sink for admin actions and denied attempts.
- **`audit_logs`** table with before/after JSONB + actor — schema is ready; needs append-only enforcement and an admin INSERT path.
- **`event_dead_letters.resolved_by / resolved_at / resolution_note`** — replay accountability columns already present.
- **CORS allowlist + `readBody` size cap + `checkRateLimit`** in `_shared/security.ts` — reuse for admin edge fns (note: `checkRateLimit` has a count-then-insert TOCTOU; do not rely on it for hard financial limits).

---

## 6. Residual Risks (accept + document)

- **R-1 Shared `WEBHOOK_SECRET`, `verify_jwt=false` on `event-processor`.** Header-secret, not per-event HMAC. Leak ⇒ event forgery / unauthorized replay. *Mitigated by network egress + rotation; full HMAC is future hardening. Accepted for Sprint 11 if egress is locked down.*
- **R-2 Service-role omnipotence.** Any leaked edge-fn key bypasses all RLS including (without the TB-7 trigger) audit deletion. *Mitigated by append-only trigger, key rotation, per-fn secret scoping, and keeping admin mutations behind SECURITY DEFINER RPCs that the edge fn calls with a verified actor id — never raw service-role writes.*
- **R-3 `checkRateLimit` TOCTOU.** Count-then-insert races under concurrency. *Do not use it as the sole guard on mass-refund/mass-payout; back it with a DB-level per-window quota counter using atomic `UPDATE ... WHERE count < cap RETURNING`.*
- **R-4 `public_read` on platform/kitchen aggregates.** Accepted **only** if confirmed PII-free and intended public; otherwise a finding (dashboard).
- **R-5 Stripe idempotency depends on the provider.** Mass-refund protection includes a Stripe idempotency key, but a partial failure between DB state and Stripe must reconcile. *Accepted with reconciliation job.*

---

## 7. Production Readiness Gates

| Gate | Status | Rationale |
|------|--------|-----------|
| G1 — Admin trust model exists (role table + fail-closed `is_admin()`) | **FAIL** | Nothing exists yet; §0 is the blocker for the whole sprint. |
| G2 — Every `admin_*` RPC re-checks `is_admin()` in-body, fails closed, pins `search_path`, REVOKEs PUBLIC | **FAIL** | Must be enforced by static check (S-1). |
| G3 — Feature flags never authorize; server-side eval only | **PENDING** | Design invariant (S-2); enforce in review. |
| G4 — `audit_logs` / `security_events` append-only | **FAIL** | No UPDATE/DELETE block today (S-3, TB-7). |
| G5 — Replay/retry/rebuild idempotent on `(event_id, projection_name)` | **PARTIAL** | Substrate exists; replay path must route through it (S-4, S-5). |
| G6 — Financial admin actions capped + idempotent + amount re-derived | **FAIL** | Mass refund/payout/notification guards required (S-6/7/8). |
| G7 — Cross-tenant targeting blocked (ownership/state validation in admin RPCs) | **FAIL** | S-10 (listing), parameter validation. |
| G8 — Flag eval rate-limited / cached | **FAIL** | S-14. |
| G9 — Observability scrubs PII/secrets | **FAIL** | TB-6. |

**Overall: NOT PRODUCTION READY.** Ship-blockers: G1, G2, G4, G6, G7. The companion `abuse-scenarios.md` enumerates the 14 concrete attacks and their fixes.
