# Abuse Scenarios & Red Team Attack Plan — Sprint 11

**Author:** Principal Security Engineer / Red Team Lead
**Date:** 2026-06-22
**Companion to:** `threat-model.md` (same directory)
**Scope:** 14 concrete attacks against the Sprint 11 Operations Control Plane, with PoC, detection, fix, and regression test for each.

**Reading note:** "Grounded" references point at real code in the current migrations (`002_marketplace_core`, `003_event_orchestration`, `005_reliability_layer`, `006_cqrs_projections`, `009_security_hardening`) and `event-processor/index.ts`. RPCs prefixed `admin_*` do **not exist yet** — these scenarios define how they must be built so the attack fails.

**Severity legend:** Critical = funds loss / full admin takeover / mass data destruction. High = privilege escalation or cross-tenant impact. Medium = abuse/DoS/integrity. Low = info leak / hardening.

---

## S-1 — Admin privilege escalation via JWT claim forgery

**Severity:** Critical

**Root cause:** Two distinct sub-causes, both live risks because the admin model is greenfield:
1. An admin RPC trusts a JWT claim (`auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`) instead of the live `user_roles` table. Claims are only as fresh as the last token mint and reflect what was set when the token was issued.
2. An admin RPC is `GRANT EXECUTE TO authenticated` with no in-body `is_admin()` check, so PostgREST exposes it to every logged-in user.

**Attack steps (PoC):**
```bash
# Sub-cause 2 — RPC reachable by any authenticated user, no role check.
# Attacker uses their ordinary customer access token against PostgREST:
curl -s "$SUPABASE_URL/rest/v1/rpc/admin_freeze_account" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"p_user_id":"<victim-uuid>","p_reason":"x"}'
# If the function lacks an is_admin() guard → 200, victim frozen.
```
```sql
-- Sub-cause 1 — trusting a claim. If app_metadata.role was ever 'admin' and
-- later revoked in the table but the token not yet expired, this passes:
-- (the RPC body wrongly does)
IF auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' THEN ... -- WRONG
```

**Detection:**
- `security_events` spike of `admin_*` actions from an `actor_id` that has **no row** in `user_roles` (join check in the observability query).
- Alert: any `admin_*` audit_logs entry whose `actor_id NOT IN (SELECT user_id FROM user_roles)`.
- `pg_stat_statements` showing `admin_*` RPC calls far exceeding the known-admin count.

**Mitigation:** Canonical fail-closed model (threat-model §0.1). Every admin RPC:
```sql
CREATE OR REPLACE FUNCTION public.admin_freeze_account(p_user_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN          -- table-backed, fail-closed, re-checked here
    PERFORM public.emit_security_event('admin_denied', auth.uid(), p_user_id, 'critical',
      jsonb_build_object('rpc','admin_freeze_account'));
    RAISE EXCEPTION 'forbidden';
  END IF;
  -- ... action + audit_logs insert ...
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_freeze_account(UUID,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_freeze_account(UUID,TEXT) TO authenticated;
-- grant to authenticated is safe ONLY because is_admin() gates the body.
```
`is_admin()` reads `user_roles`, never a JWT claim. JWT may be a fast-path hint but the table is authoritative.

**Regression test:**
- Call every `admin_*` RPC with a non-admin JWT → assert `forbidden` and a `security_event('admin_denied')` row.
- Grant admin in table, mint token, revoke in table (token still valid) → assert next admin call is denied (proves table, not claim, is consulted).
- **Static gate:** CI greps every `CREATE FUNCTION public.admin_*` and asserts the body contains `is_admin()` and the migration contains a matching `REVOKE ... FROM PUBLIC`. Fail the build otherwise.

---

## S-2 — Feature flag bypass by direct DB read / client-side evaluation

**Severity:** High

**Root cause:** A flag that gates authorization (e.g. `escrow_auto_release_enabled`, `admin_refund_enabled`) is evaluated on the client, or the client reads the flag value and the server trusts the client's assertion of it. Flags are config, not authorization.

**Attack steps (PoC):**
```sql
-- If feature_flags has a permissive read policy, any user reads server-only flags:
SELECT * FROM public.feature_flags;   -- leaks 'kill_switch_*', rollout posture
```
```javascript
// Client-side bypass: app gates a sensitive action on a locally-read flag.
const { data } = await supabase.from('feature_flags').select('enabled').eq('key','beta_pricing');
if (data.enabled) callPrivilegedPath();   // attacker flips it in DevTools / forged response
```

**Detection:**
- Audit any code path where a flag value flows into an authorization decision (code review + grep for flag keys near `allow`/`grant`/admin calls).
- `security_events` for actions whose precondition flag is OFF server-side but the action still arrived.

**Mitigation:**
- Server-side evaluation only. Flag enforcement lives inside the RPC:
```sql
CREATE OR REPLACE FUNCTION public.evaluate_flag(p_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled FROM public.feature_flags
                   WHERE key = p_key AND client_visible), FALSE);
$$;  -- non-visible flags return FALSE to clients, never their real value
```
- `feature_flags` RLS: `SELECT` to `authenticated` **only** `WHERE client_visible = TRUE`; writes via `admin_set_flag()` (admin-gated) + audit.
- Invariant: a flag may *further restrict* but never *grant* a privilege a role check denies. Sensitive RPCs check `is_admin()` first, then optionally `evaluate_flag()` as a kill-switch.

**Regression test:**
- Set a server-only flag ON in DB; assert `evaluate_flag` returns FALSE for a non-admin and the row is not selectable via PostgREST.
- Attempt the gated action with the client asserting the flag is ON while DB says OFF → assert server denies.

---

## S-3 — Audit log deletion / tampering

**Severity:** Critical

**Root cause:** `audit_logs` (migration 002) and `security_events` (migration 005) have only `service_role` policies and **no append-only enforcement**. Any service-role caller — including a compromised edge function or an over-broad admin RPC — can `DELETE`/`UPDATE` audit history to erase evidence.

**Attack steps (PoC):**
```sql
-- With a leaked service-role key (or inside a rogue edge fn):
DELETE FROM public.audit_logs   WHERE actor_id = '<attacker-admin>';
UPDATE public.security_events SET severity = 'info' WHERE event_type = 'admin_denied';
-- No trigger blocks this today.
```

**Detection:**
- Row-count monotonicity monitor: `audit_logs` / `security_events` counts must be non-decreasing between snapshots; any decrease alerts.
- Optional hash-chain break detection (below) flagged by the verifier job.
- Postgres logical-replication / WAL audit showing DELETE on these tables.

**Mitigation:** Append-only trigger + optional tamper-evident hash chain.
```sql
CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% blocked)', TG_OP;
END; $$;

CREATE TRIGGER audit_logs_no_update  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();
CREATE TRIGGER security_events_no_update BEFORE UPDATE OR DELETE ON public.security_events
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- Tamper-evidence: prev_hash chain
ALTER TABLE public.audit_logs ADD COLUMN prev_hash TEXT, ADD COLUMN row_hash TEXT;
-- BEFORE INSERT trigger sets row_hash = sha256(prev_hash || actor||action||resource||created_at)
```
Note: triggers do not constrain a literal superuser, but they stop the service-role API path and every RPC. Retention/export to an append-only external sink (TB-6) is defence-in-depth.

**Regression test:**
- As service_role, attempt `DELETE`/`UPDATE` on both tables → assert exception, row count unchanged.
- Insert N rows, recompute the hash chain end-to-end → assert continuity; manually corrupt one row's stored fields in a fixture and assert the verifier reports a break.

---

## S-4 — Projection replay producing duplicate order revenue

**Severity:** Critical

**Root cause:** `project_order_created` (migration 006) is idempotent **only** because it calls `_projection_already_applied(event_id, 'project_order_created')` first. A replay/rebuild path that (a) bypasses that gate, (b) calls the projector directly with a *fresh* event_id, or (c) rebuilds the read-model without first clearing the matching `projection_event_log` rows, will double-count `total_revenue_pence`.

**Attack steps (PoC):**
```sql
-- Naive admin_rebuild_projection that re-runs projectors WITHOUT clearing the log:
-- projection_event_log already has the (event_id,'project_order_created') rows,
-- so a correct rebuild is a no-op — operator "fixes" it by deleting the gate first:
DELETE FROM public.projection_event_log WHERE projection_name='project_order_created';
-- then replays every order.created event → every revenue figure now counted TWICE
-- if the read-model rows were NOT reset to zero in the same step.
```

**Detection:**
- Reconciliation check: `SUM(prepper_metrics.total_revenue_pence)` vs authoritative `SUM(orders.total_pence)` for non-cancelled orders. Divergence = double count.
- Alert on `admin_rebuild_projection` invocations; compare metric deltas pre/post.

**Mitigation:** Rebuild is reset + replay in **one transaction**, gate cleared and read-model zeroed together:
```sql
CREATE OR REPLACE FUNCTION public.admin_rebuild_projection(p_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  -- single tx: clear gate + zero read-model + replay deterministically
  DELETE FROM public.projection_event_log WHERE projection_name = p_name;
  -- truncate/zero ONLY the read-model rows this projection owns, then
  -- replay events in occurred_at order through the SAME projector RPC
  -- (which re-inserts the gate row as it goes).
  PERFORM public.emit_security_event('projection_rebuild', auth.uid(), NULL, 'warn',
    jsonb_build_object('projection', p_name));
END; $$;
```
Replay console for individual events re-fetches `domain_events.payload` by `event_id` (never an operator-supplied payload) and routes through the normal projector so the gate re-inserts.

**Regression test:**
- Seed 100 `order.created` events; run projection; record totals. Run `admin_rebuild_projection` → assert totals **identical** (idempotent, not doubled).
- Replay the same single event 10× via the console → assert revenue increments by exactly 0 after the first apply.

---

## S-5 — Dead-letter queue drain attack (replay same dead letter 1000×)

**Severity:** High

**Root cause:** If `admin_replay_dead_letter` calls the handler/projector **directly** instead of routing through the `event_processing_log` INSERT-lock and `projection_event_log` gate, each replay re-applies side-effects. Non-idempotent effects (notifications, any future escrow/payout side-effect) fire once per replay.

**Attack steps (PoC):**
```bash
# Compromised admin scripts the replay endpoint in a loop:
for i in $(seq 1 1000); do
  curl -s "$SUPABASE_URL/rest/v1/rpc/admin_replay_dead_letter" \
    -H "Authorization: Bearer $ADMIN_JWT" -H "apikey: $ANON_KEY" \
    -d '{"p_dead_letter_id":"<dl-uuid>"}'
done
# If replay bypasses the gate: 1000 duplicate notifications / counter bumps.
```

**Detection:**
- `notifications` table: many rows with identical `data.order_id` within seconds.
- `security_events`: repeated `dead_letter_replay` for the same `event_id`.
- The `projection_event_log` gate would normally absorb repeats — its absence in the call path is itself the smell.

**Mitigation:** Replay re-dispatches through the **same entrypoint** as live events. Reuse `event-processor`'s lock pattern (`event_processing_log.insert` → `23505` ⇒ "Already processing", lines 246–260 of `event-processor/index.ts`). For a dead letter, replay resets the EPL row to `pending_retry` and lets `dispatch_retry_events` re-fire — it cannot double-apply gated projectors. Plus per-dead-letter replay quota (e.g. ≤ 3 manual replays) and mark `resolved_at` to remove it from the queue.
```sql
-- replay flips EPL back to pending_retry exactly once; gate absorbs duplicates
UPDATE public.event_processing_log SET status='pending_retry', next_attempt_at=NOW()
WHERE event_id = (SELECT event_id FROM public.event_dead_letters WHERE id = p_dead_letter_id)
  AND status = 'dead_letter';   -- 0 rows if already replayed → idempotent
```

**Regression test:**
- Replay one dead letter 1000× → assert: gated projectors applied once; notification side-effects bounded (ideally 0 net new because the original already produced them); `event_processing_log` shows a single success.
- Assert replay quota rejects the 4th attempt with a `security_event`.

---

## S-6 — Mass refund via `admin_refund_order` called in loop

**Severity:** Critical

**Root cause:** No per-window cap, no idempotency key, and `amount` trusted from the caller. A compromised admin (or a refund RPC missing the role check, see S-1) drains escrow/Stripe balance. `stripe-refund` edge fn exists but has no aggregate guardrail.

**Attack steps (PoC):**
```bash
# Refund every captured order, full amount, as fast as the API allows:
for oid in $(psql -t -c "SELECT order_id FROM payments WHERE status='captured'"); do
  curl -s "$SUPABASE_URL/rest/v1/rpc/admin_refund_order" \
    -H "Authorization: Bearer $ADMIN_JWT" -H "apikey: $ANON_KEY" \
    -d "{\"p_order_id\":\"$oid\"}"
done
# Plus amount tampering on a single order:
-d '{"p_order_id":"<oid>","p_amount_pence":999999}'   # > original captured amount
```

**Detection:**
- Velocity alert: > N refunds per admin per hour, or aggregate refund value over a threshold in any window.
- `payments.refunded_at` set on many rows in a short window.
- Reconciliation: refunded total per admin vs a manually-approved ceiling.

**Mitigation:**
1. **Re-derive amount from DB**, never trust caller:
```sql
SELECT amount_pence INTO v_amt FROM public.payments WHERE order_id = p_order_id
  AND status IN ('captured','in_escrow','released') FOR UPDATE;
-- refund v_amt (or a partial ≤ v_amt); reject p_amount > v_amt
```
2. **Idempotency:** unique `refund_idempotency_key = order_id`; second call is a no-op. Pass the same key to Stripe so the provider dedupes.
3. **Per-window quota** via atomic counter (not `checkRateLimit`, which has a TOCTOU — threat-model R-3):
```sql
UPDATE public.admin_action_quota
   SET refunds_this_hour = refunds_this_hour + 1
 WHERE admin_id = auth.uid() AND window_start = date_trunc('hour',NOW())
   AND refunds_this_hour < 20 RETURNING 1;   -- 0 rows ⇒ over cap, reject
```
4. **Step-up for bulk:** a refund batch > N targets requires a second admin approval row.
5. State guard: only refund payments in a refundable status; block double refund via `status='refunded'` check + `FOR UPDATE`.

**Regression test:**
- Loop 50 refunds in an hour with cap 20 → assert exactly 20 succeed, 30 rejected + `security_event`.
- Call refund twice on one order → assert one Stripe refund, `refunded_at` set once.
- Pass `p_amount_pence` > captured → assert reject.

---

## S-7 — Mass payout via `admin_release_escrow` called in loop

**Severity:** Critical

**Root cause:** Same shape as S-6 but on the payout side. No cap, no state-machine guard, no double-release protection. Escrow release moves funds to preppers; a loop empties escrow and/or releases funds for orders not yet delivered.

**Attack steps (PoC):**
```bash
for pid in $(psql -t -c "SELECT id FROM payments WHERE status='in_escrow'"); do
  curl -s "$SUPABASE_URL/rest/v1/rpc/admin_release_escrow" \
    -H "Authorization: Bearer $ADMIN_JWT" -H "apikey: $ANON_KEY" \
    -d "{\"p_payment_id\":\"$pid\"}"
done
# Also: release escrow for an order still 'preparing' (premature payout).
```

**Detection:**
- Velocity alert on `payments.released_at` set in bulk; aggregate released value over threshold.
- Invariant monitor: a `released` payment whose order `status NOT IN ('delivered')` = policy violation.

**Mitigation:**
```sql
CREATE OR REPLACE FUNCTION public.admin_release_escrow(p_payment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pay public.payments%ROWTYPE; v_ord_status public.order_status;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE; -- lock
  IF v_pay.status <> 'in_escrow' THEN RAISE EXCEPTION 'not_in_escrow'; END IF;  -- no double release
  SELECT status INTO v_ord_status FROM public.orders WHERE id = v_pay.order_id;
  IF v_ord_status <> 'delivered' THEN RAISE EXCEPTION 'order_not_delivered'; END IF; -- state guard
  -- per-window quota (atomic, as S-6); then release + audit + security_event
  UPDATE public.payments SET status='released', released_at=NOW() WHERE id=p_payment_id;
  INSERT INTO public.audit_logs(actor_id,action,resource_type,resource_id,before_state,after_state)
    VALUES(auth.uid(),'release_escrow','payment',p_payment_id,
           jsonb_build_object('status','in_escrow'),jsonb_build_object('status','released'));
END; $$;
```
Bulk release > N requires second-approval. `FOR UPDATE` lock makes double-release impossible under concurrency.

**Regression test:**
- Concurrent double-release of one payment → assert exactly one `released`, second errors.
- Release on a `preparing` order → assert `order_not_delivered`.
- 50-in-an-hour loop with cap → assert cap enforced.

---

## S-8 — Bulk notification spam via `admin_resend_notification`

**Severity:** Medium

**Root cause:** No per-window cap or dedup. Admin (or a missing role check) blasts push/email to all users — reputational damage, provider rate-limit/ban, phishing vector. `notifications` insert path in `event-processor` shows notifications fan out to real users.

**Attack steps (PoC):**
```bash
for uid in $(psql -t -c "SELECT id FROM auth.users"); do
  curl -s "$SUPABASE_URL/rest/v1/rpc/admin_resend_notification" \
    -H "Authorization: Bearer $ADMIN_JWT" -H "apikey: $ANON_KEY" \
    -d "{\"p_user_id\":\"$uid\",\"p_type\":\"promo\",\"p_body\":\"clickme\"}"
done
```

**Detection:**
- Spike in `notifications` inserts per minute; many identical bodies across distinct `user_id`.
- Email/push provider bounce/complaint rate alert.

**Mitigation:**
- `is_admin()` guard + per-admin per-window send quota (atomic counter, S-6 pattern).
- Honor `notification_preferences` opt-out (the `isNotificationEnabled` check already exists in `event-processor`) — admin resends must respect it too.
- Broadcast (> N recipients) is a separate, explicitly-named RPC requiring second-approval and a campaign id; per-recipient dedup on `(user_id, campaign_id)`.
- Template allowlist — no free-text body that could carry a phishing link.

**Regression test:**
- Send beyond the per-window cap → assert throttled + `security_event`.
- Resend same campaign to same user twice → assert one notification.
- Send to an opted-out user → assert suppressed.

---

## S-9 — Bulk media deletion via `admin_remove_media`

**Severity:** High

**Root cause:** No cap and no cross-tenant guard; a destructive action that is irreversible (storage bytes gone). Loop deletes every prepper's listing photos → marketplace defacement / data loss.

**Attack steps (PoC):**
```bash
for mid in $(psql -t -c "SELECT id FROM media_objects"); do
  curl -s "$SUPABASE_URL/rest/v1/rpc/admin_remove_media" \
    -H "Authorization: Bearer $ADMIN_JWT" -H "apikey: $ANON_KEY" \
    -d "{\"p_media_id\":\"$mid\"}"
done
```

**Detection:**
- Velocity alert on media deletions per admin per window.
- `audit_logs` action=`remove_media` count spike.

**Mitigation:**
- `is_admin()` + per-window quota.
- **Soft-delete first:** flag `media_objects.removed_at` + reason; hard storage purge deferred to a delayed reconciliation job (gives a recovery window and a tripwire).
- Bulk (> N) requires second-approval + explicit reason.
- Record `before_state` (storage_path, owner) in `audit_logs` so deletions are reconstructable.

**Regression test:**
- Loop beyond cap → assert capped.
- Single removal → assert soft-delete (row flagged, bytes retained until purge job), audit row with before_state.
- Bulk request without second approval → assert rejected.

---

## S-10 — Cross-tenant listing access via `admin_disable_listing`

**Severity:** High

**Root cause:** Admin RPCs legitimately operate across tenants — that is the *point* of admin. The risk is (a) a non-admin reaching the RPC (S-1), and (b) no validation that the `listing_id` exists / is in a disableable state, enabling censorship-by-enumeration or operating on already-deleted rows. Existing listing RLS (`preppers_own_listings USING prepper_id = auth.uid()`) is bypassed by a SECURITY DEFINER admin RPC, so the *only* gate is `is_admin()` plus input validation.

**Attack steps (PoC):**
```bash
# A non-admin (if S-1 unfixed) disables a competitor's listing by guessing/enumerating ids:
curl -s "$SUPABASE_URL/rest/v1/rpc/admin_disable_listing" \
  -H "Authorization: Bearer $PREPPER_JWT" -H "apikey: $ANON_KEY" \
  -d '{"p_listing_id":"<competitor-listing-uuid>"}'
```

**Detection:**
- `admin_disable_listing` calls from a non-admin actor (join `user_roles`).
- Multiple disables targeting one prepper's listings from a single actor in a short window (targeted takedown pattern).

**Mitigation:**
- `is_admin()` guard (S-1) is the primary control.
- Validate target: `SELECT ... FOR UPDATE`, ensure listing exists and `status NOT IN ('deleted')`; reject otherwise.
- Record `before_state` (prior status, prepper_id) + reason in `audit_logs`; emit `security_event` so targeted-takedown patterns are detectable.
- Rate-limit per admin to bound a rogue insider's blast radius.

**Regression test:**
- Non-admin → `forbidden`.
- Admin disables a non-existent / already-deleted listing → assert validation error, no state change.
- Disable a valid listing → assert status flips, audit row captures prepper_id + prior status.

---

## S-11 — Replay attack with expired admin JWT

**Severity:** High

**Root cause:** Admin authorization that trusts the JWT alone, or an edge fn that does not re-validate token freshness, lets a captured/expired-but-replayed admin token drive admin actions. Compounds S-1 sub-cause 1: a revoked admin's still-unexpired token, or a sniffed token replayed after the admin logged out.

**Attack steps (PoC):**
```bash
# Captured admin Bearer token, replayed after expiry / after the admin's role was revoked:
curl -s "$SUPABASE_URL/rest/v1/rpc/admin_refund_order" \
  -H "Authorization: Bearer $CAPTURED_ADMIN_JWT" -H "apikey: $ANON_KEY" \
  -d '{"p_order_id":"<oid>"}'
```

**Detection:**
- `security_events` showing admin actions from a token whose `actor_id` is no longer in `user_roles`.
- Auth logs: use of a token after a logout/revocation event for that user.

**Mitigation:**
- Edge fns use `supabase.auth.getUser(token)` (as `_shared/security.ts getUser` does) which validates signature **and expiry** server-side — reject expired tokens (`error` ⇒ null user).
- `is_admin()` re-checks the **live** `user_roles` table on every call, so a revoked admin is denied even within token TTL.
- Short admin token TTL + refresh; on role revocation or logout, invalidate refresh tokens (Supabase `auth.admin.signOut` / session revocation).
- Bind sensitive admin actions to step-up re-auth (recent-login assertion) so a stale token cannot perform refunds/payouts.

**Regression test:**
- Replay an expired token → assert 401 (getUser rejects).
- Revoke admin role in table, replay a still-valid token → assert `forbidden` (live table consulted).
- Logout then replay → assert session invalid.

---

## S-12 — Administrator impersonation via session fixation

**Severity:** High

**Root cause:** If the admin console accepts a session/token supplied or pre-seeded by the attacker (URL-embedded token, fixated cookie, OAuth state reuse), the attacker fixes a session that the admin then authenticates into, and the attacker rides it. Also CSRF-adjacent: a cross-site request driving the admin's authenticated session against an admin endpoint.

**Attack steps (PoC):**
```
1. Attacker obtains/sets a session identifier and tricks admin into using it
   (e.g. magic link / token in a URL the attacker controls, or a non-rotated cookie).
2. Admin logs in; the session is NOT rotated on privilege elevation.
3. Attacker reuses the same session → acts as admin.
-- CSRF variant: attacker page auto-submits to an admin endpoint using the admin's
-- ambient cookies; if the endpoint is cookie-auth'd with no CSRF token / SameSite,
-- the admin action executes.
```

**Detection:**
- Same session/refresh token observed from two distinct IPs/user-agents.
- Admin action with an `Origin`/`Referer` not on the allowlist.
- `security_events` for admin actions whose request origin ∉ `CORS_ALLOWED_ORIGINS`.

**Mitigation:**
- **Rotate the session/token on login and on privilege elevation** — never accept a pre-existing session id; Supabase issues a fresh JWT+refresh on auth, do not allow client-supplied session injection.
- Admin auth via `Authorization: Bearer` header (not ambient cookies) → CSRF-resistant by construction; if any cookie path exists, require `SameSite=Strict` + anti-CSRF token + `Origin` check.
- Enforce the CORS allowlist in production (`CORS_ALLOWED_ORIGINS` is currently optional in `_shared/security.ts`, defaulting to `*` — must be set for admin fns).
- Step-up re-auth + short TTL for sensitive admin actions.

**Regression test:**
- Attempt to reuse a pre-login session id post-login → assert rejected (token rotated).
- POST to an admin endpoint with a foreign `Origin` → assert blocked by CORS/Origin check.
- Verify admin fns reject requests lacking a valid Bearer token even if cookies are present.

---

## S-13 — RPC parameter injection (SQL via JSONB payload)

**Severity:** High

**Root cause:** Admin RPCs accept JSONB (`p_payload`, `p_metadata`, flag `value`) and an unsafe one builds SQL by concatenating extracted JSONB text into `EXECUTE`, or trusts JSONB fields used as identifiers/filters. The replay path is especially exposed if it interpolates `payload_snapshot` fields. Parameterized queries and quote_ident/quote_literal are the defense; the codebase's existing RPCs use bound parameters (good baseline), but new dynamic-SQL admin tooling must not regress.

**Attack steps (PoC):**
```sql
-- Hypothetical unsafe admin RPC doing dynamic SQL from JSONB:
-- EXECUTE 'UPDATE '||(p_payload->>'table')||' SET frozen=true WHERE id='''||(p_payload->>'id')||'''';
-- Attacker payload:
{"table":"user_roles","id":"x'' ; INSERT INTO user_roles(user_id,role) VALUES (auth.uid(),''admin''); --"}
-- → injects an admin grant for themselves.
```

**Detection:**
- Static analysis: grep for `EXECUTE` / `format()` / string concatenation in `admin_*` and replay RPCs; flag any `||` building SQL from `p_*` or `->>`.
- DB error logs showing syntax errors from malformed JSONB-derived SQL (probing).

**Mitigation:**
- **No dynamic SQL from user input.** Use static parameterized statements; pass JSONB values as bound `USING` parameters, never interpolated text.
- If a table/column name must be dynamic, allowlist it (`CASE p_name WHEN 'project_order_created' THEN ...`) — never pass it into the query string raw; if unavoidable use `format('%I', p_ident)` (quote_ident) / `%L` (quote_literal).
- Replay never executes operator-supplied JSONB as SQL; it re-fetches `domain_events.payload` and feeds it as **data** to typed projector params (as `event-processor` does — typed `db.rpc(...)` args).
- Validate JSONB shape at the boundary (`jsonb_typeof`, required keys) before use.

**Regression test:**
- Feed each JSONB-accepting admin RPC a payload containing `'; DROP`, `%I` breakers, and nested quotes → assert the value is stored/handled as inert data, no DDL/DML side-effect, no error leak.
- CI static check: fail build if any `admin_*` RPC concatenates `->>` or `p_` into a SQL string passed to `EXECUTE`.

---

## S-14 — API flooding of the feature-flag evaluation endpoint

**Severity:** Medium

**Root cause:** `evaluate_flag` is called on hot paths and is `authenticated`-reachable with no rate limit or cache. A flood exhausts DB connections / Postgres CPU, degrading the whole platform (the flag table is tiny but each call is a round trip). Also an enumeration oracle for flag keys.

**Attack steps (PoC):**
```bash
# Hammer the eval endpoint from many tokens / IPs:
yes | head -100000 | xargs -P50 -I{} curl -s \
  "$SUPABASE_URL/rest/v1/rpc/evaluate_flag" \
  -H "Authorization: Bearer $JWT" -H "apikey: $ANON_KEY" \
  -d '{"p_key":"any"}' >/dev/null
```

**Detection:**
- `pg_stat_statements`: `evaluate_flag` call count / total time dominating.
- Connection-pool saturation alerts (PgBouncer); 5xx rate from PostgREST.
- Per-actor request-rate anomaly in observability.

**Mitigation:**
- **Cache flags in the edge fn / app layer** with a short TTL (e.g. 30–60s) and bulk-fetch all client-visible flags in one call rather than per-key round trips. Flags change rarely.
- Per-user / per-IP rate limit at the edge (token bucket); reuse a rate-limit table but with an atomic counter (not the racy `checkRateLimit`).
- PgBouncer transaction pooling + statement timeout so a flood cannot pin connections.
- Return only client-visible flags (S-2) so the endpoint isn't a key-enumeration oracle.

**Regression test:**
- Burst N requests/sec from one actor → assert rate limit engages and DB call count stays bounded (cache hit ratio high).
- Load test: sustained eval traffic does not raise order-write p99 beyond budget.
- Assert a single bulk fetch returns all client-visible flags (round-trip reduction verified).

---

## Appendix A — Cross-cutting controls (apply to every admin RPC)

1. **Fail-closed `is_admin()` re-check in-body** (table-backed, not JWT claim). — S-1, S-10, S-11
2. **`REVOKE EXECUTE ... FROM PUBLIC`** + explicit grant; `SECURITY DEFINER SET search_path = public`. — S-1, S-13
3. **Re-derive financial amounts and target state from DB** with `FOR UPDATE`; never trust caller `amount`/`payload`. — S-4, S-6, S-7, S-13
4. **Idempotency key + atomic per-window quota** (not `checkRateLimit`). — S-5, S-6, S-7, S-8, S-9
5. **Append-only `audit_logs` + `security_events`** with before/after, actor, IP, reason; emit on success **and** on denied attempts. — S-3, all
6. **Second-approval for bulk** (> N targets) on refund/payout/notification/media. — S-6, S-7, S-8, S-9
7. **Replay/retry/rebuild routes through the `(event_id, projection_name)` gate / EPL lock** — never call handlers directly. — S-4, S-5
8. **Step-up re-auth + short TTL + CORS allowlist + Bearer (not cookie) auth** for the admin surface. — S-11, S-12

## Appendix B — CI / static gates (block the build)

- Every `CREATE FUNCTION public.admin_*` body contains `is_admin()` **and** a matching `REVOKE ... FROM PUBLIC`.
- Every `SECURITY DEFINER` function has `SET search_path`.
- No `admin_*` / replay RPC builds SQL by concatenating `->>` or `p_` into `EXECUTE`.
- `audit_logs` and `security_events` have append-only triggers present.
- `feature_flags` SELECT policy filters `client_visible`; no `authenticated` write policy.
- `CORS_ALLOWED_ORIGINS` is set (non-wildcard) for admin edge functions.

## Appendix C — Severity rollup

| # | Scenario | Severity |
|---|----------|----------|
| S-1 | Admin privilege escalation via JWT claim forgery | Critical |
| S-2 | Feature flag bypass / client-side evaluation | High |
| S-3 | Audit log deletion / tampering | Critical |
| S-4 | Projection replay duplicate revenue | Critical |
| S-5 | Dead-letter drain attack | High |
| S-6 | Mass refund loop | Critical |
| S-7 | Mass payout (escrow release) loop | Critical |
| S-8 | Bulk notification spam | Medium |
| S-9 | Bulk media deletion | High |
| S-10 | Cross-tenant listing disable | High |
| S-11 | Replay with expired admin JWT | High |
| S-12 | Administrator impersonation / session fixation | High |
| S-13 | RPC parameter injection via JSONB | High |
| S-14 | Feature-flag eval endpoint flooding | Medium |

**Ship-blockers (must fix before enabling the admin plane):** S-1, S-3, S-4, S-6, S-7. **High-priority pre-launch:** S-2, S-5, S-9, S-10, S-11, S-12, S-13. **Hardening:** S-8, S-14.
