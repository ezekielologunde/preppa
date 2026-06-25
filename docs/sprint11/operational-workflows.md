# Sprint 11 — Operational Workflows: Admin Actions

> Pre-implementation. Step-by-step DB-state / event / audit behaviour for every admin action,
> with rollback, failure modes, and recovery. Grounded in the applied schema (migrations 001–009).

## Conventions Used by Every Admin Action

Every `admin_*` write RPC runs as a single transaction with this skeleton:

```
BEGIN
  ASSERT is_admin()                         -- else RAISE 'not_admin'
  SELECT ... FOR UPDATE  (load + lock target row → "before" state)
  validate precondition  (else RAISE typed error, nothing written)
  UPDATE/INSERT target table
  INSERT audit_logs (actor_id=auth.uid(), action, before_state, after_state)
  INSERT domain_events (aggregate event)    -- fires pg_net → event-processor
  RETURN { ok, before, after, event_id }
COMMIT
```

Because audit + event inserts share the transaction with the mutation, **an action is either fully recorded or fully absent.** There is no "mutated but unaudited" state.

### Reversibility legend
- **R** = reversible by a paired admin RPC.
- **I** = irreversible (money moved or external side effect).
- **N** = naturally idempotent (re-running converges to the same state).

| Action | Class |
|---|---|
| freeze / unfreeze account | R |
| verify / unverify prepper | R |
| disable / enable listing | R |
| refund order | **I** |
| release escrow | **I** |
| retry event | N |
| replay dead letter | N |
| resend notification | N (duplicate is benign) |
| clear abuse review | R |
| rebuild projection | N (idempotent via PEL) |

---

## 1. Freeze Account — `admin_freeze_account(p_user_id, p_reason)` · R

| Phase | Detail |
|---|---|
| DB change | `UPDATE risk_scores SET frozen_at = NOW() WHERE user_id = p_user_id AND frozen_at IS NULL`. If no `risk_scores` row exists, INSERT one with `frozen_at = NOW()`. |
| Event | `domain_events`: `event_type='account.frozen'`, `aggregate_type='account'`, `aggregate_id=p_user_id`, `actor_id=admin`, `payload={reason}`. |
| Audit | `action='freeze_account'`, `resource_type='account'`, `resource_id=p_user_id`, `before={frozen_at:null}`, `after={frozen_at:...}`, `metadata={reason}`. |
| Side effects | Downstream: event-processor may emit a `notification` ("account under review") and flip RLS-visible state. Account-status enforcement reads `frozen_at`. |

**Rollback:** `admin_unfreeze_account(p_user_id, p_reason)` → `frozen_at = NULL`, emits `account.unfrozen`, audits the reverse.

**Failure modes:**
- `is_admin()` false → `not_admin`, nothing written.
- Target row locked by concurrent freeze → second caller waits, then sees `frozen_at` already set, returns idempotent `{ok, already_frozen:true}` (the `frozen_at IS NULL` guard makes double-freeze a no-op).
- pg_net dispatch failure after commit → event row exists; `event-processor` will be retried by the retry queue. Freeze itself is durable regardless of downstream notification.

**Recovery:** if the notification side effect failed, re-run is safe (no-op on the freeze, regenerates the event). Use the Replay Console on the `account.frozen` event id if the downstream projection lagged.

---

## 2. Verify Prepper — `admin_verify_prepper(p_kitchen_id)` · R

| Phase | Detail |
|---|---|
| DB change | `UPDATE kitchens SET verified_at = NOW(), verified_by = auth.uid() WHERE id = p_kitchen_id AND verified_at IS NULL`. (`verified_at`/`verified_by` added in migration 011.) |
| Event | `prepper.verified`, `aggregate_type='prepper'`, `aggregate_id=kitchen.prepper_id`. |
| Audit | `action='verify_prepper'`, before/after `verified_at`. |

**Rollback:** `admin_unverify_prepper(p_kitchen_id, p_reason)` → null the columns, emit `prepper.unverified`.

**Failure modes:** kitchen not found → `kitchen_not_found`, nothing written. Already verified → idempotent no-op. Concurrent verify → row lock serialises; second sees `verified_at` set.

**Recovery:** safe to re-run; no money or external system involved.

---

## 3. Disable Listing — `admin_disable_listing(p_listing_id, p_reason)` · R

| Phase | Detail |
|---|---|
| DB change | `UPDATE listings SET status = 'paused' WHERE id = p_listing_id AND status NOT IN ('deleted','archived')`. (Reuses existing `listing_status` enum — no new status.) |
| Event | The existing `listing_domain_events` trigger fires on the status change and emits `listing.updated`/`listing.archived` per its logic; the RPC *also* emits an explicit `listing.disabled_by_admin` for audit clarity. |
| Audit | `action='disable_listing'`, before/after `status`, `metadata={reason}`. |

**Rollback:** `admin_enable_listing(p_listing_id)` → set status back to `published` (only if it was published before; the `before_state` in audit records the prior status to restore accurately). Emits `listing.published`.

**Failure modes:** listing deleted/archived → `listing_not_disableable`. Concurrent prepper edit → row lock serialises; admin write wins within its transaction.

**Recovery:** re-enable reads the audited prior status. If the prior status is unknown (no audit), default-restore to `draft` (safe: not publicly visible) and notify prepper.

---

## 4. Refund Order — `admin_refund_order(p_order_id, p_reason)` · **I**

| Phase | Detail |
|---|---|
| Precondition | Payment must be in `captured`, `in_escrow`, or `released` — never `refunded`/`failed`/`pending`. Else `refund_not_permitted`. |
| External | Call Stripe refund via the payments edge function **before** marking DB (see failure modes). |
| DB change | `UPDATE payments SET status = 'refunded', refunded_at = NOW() WHERE order_id = p_order_id`. `UPDATE orders SET status = 'refunded'`. Amount = existing `payments.amount_pence` (caller cannot override). |
| Event | `payment.refunded`, `aggregate_type='payment'`, `aggregate_id=payment.id`, `payload={amount_pence, reason}`. |
| Audit | `action='refund_order'`, before/after `payment.status`, `metadata={reason, stripe_refund_id}`. |

**Reversibility:** **IRREVERSIBLE** at the money layer. There is no `un-refund`. A wrongful refund is corrected only by a *new* forward charge (a separate, out-of-scope flow), recorded as a compensating event — never by mutating the refund record.

**Failure modes (ordering matters):**
- Stripe call fails → DB untouched, RPC raises `stripe_refund_failed`. Safe: no half-state.
- Stripe succeeds, then DB commit fails → **money moved but DB says captured.** This is the dangerous window. Mitigation: store the Stripe refund id in `audit_logs.metadata` *and* make the payments edge function idempotent on `stripe_payment_intent_id`. A reconciliation job compares Stripe refund state to `payments.status` and replays the DB-side update.
- pg_net dispatch fails post-commit → retry queue handles the `payment.refunded` projection.

**Recovery:** the daily Stripe reconciliation runbook detects refunded-in-Stripe-but-not-in-DB and applies the missing `payments`/`orders` update via `admin_replay_event` on the recorded refund event. Never issue a second Stripe refund (idempotency key prevents double-refund).

---

## 5. Release Escrow — `admin_release_escrow(p_order_id)` · **I**

| Phase | Detail |
|---|---|
| Precondition | `payments.status = 'in_escrow'` and `orders.status = 'delivered'`. Else `escrow_not_releasable`. |
| External | Stripe transfer/payout to prepper Connect account using recorded `prepper_payout_pence`. |
| DB change | `UPDATE payments SET status = 'released', released_at = NOW()`. |
| Event | `payment.released`, payload `{prepper_payout_pence}`. Drives `prepper_metrics` revenue projection. |
| Audit | `action='release_escrow'`, before/after status, `metadata={stripe_transfer_id, payout_pence}`. |

**Reversibility:** **IRREVERSIBLE.** Once funds leave escrow to the prepper, recovery is a clawback/chargeback (manual, out-of-band), not a DB toggle.

**Failure modes:** identical hazard profile to refund — Stripe-first ordering, idempotent transfer keyed on order id, reconciliation for the commit-after-transfer window. Precondition guard (`delivered` + `in_escrow`) prevents premature release.

**Recovery:** reconciliation job + `admin_replay_event` on the `payment.released` event to converge `prepper_metrics`. Double-release prevented by the `in_escrow` precondition (a released payment can't release again) and the Stripe idempotency key.

---

## 6. Retry Event — `admin_retry_event(p_event_id)` · N

| Phase | Detail |
|---|---|
| DB change | `UPDATE event_processing_log SET status='pending_retry', next_attempt_at=NOW(), error=NULL WHERE event_id=p_event_id`. The existing `dispatch_retry_events()` cron picks it up. |
| Event | `event.retry_requested` (lightweight, for observability). |
| Audit | `action='retry_event'`, before/after `status`. |
| Immutability | `domain_events` row is **never** modified — only its processing-log status. |

**Rollback:** none needed; retry is idempotent. If the event was actually already processed, the projector's `_projection_already_applied` gate makes the re-run a no-op.

**Failure modes:** event already `success` → RPC still flips it to `pending_retry`; the projector no-ops on replay (safe but wasteful — guard by warning if status was `success`). No EPL row → `event_not_tracked`.

**Recovery:** none required; converges by design.

---

## 7. Replay Dead Letter — `admin_replay_dead_letter(p_dead_letter_id, p_dry_run)` · N

| Phase | Detail |
|---|---|
| Dry run | Returns the `event_dead_letters` row + target event payload; writes nothing. |
| DB change (live) | Re-dispatch the original `domain_events` row to `event-processor` via `net.http_post`. On success the processor will set EPL `success`; the RPC marks `event_dead_letters.resolved_at=NOW(), resolved_by=auth.uid()`. |
| Event | `deadletter.replayed`, payload `{dead_letter_id, event_id}`. |
| Audit | `action='replay_dead_letter'`, before/after `resolved_at`. |
| Idempotency | Projector gated by `projection_event_log` — replaying an already-applied event is a no-op. |

**Rollback:** none; idempotent.

**Failure modes:** event-processor fails again → the event re-enters the retry/dead-letter cycle; `resolved_at` is set only on a successful dispatch ack (not on enqueue). Dead letter already resolved → `already_resolved` warning, no re-dispatch.

**Recovery:** if a replay keeps failing, the root cause is in the projector/payload, not the replay — escalate to the dead-letter triage runbook (inspect `final_error`, fix projector, then replay).

---

## 8. Resend Notification — `admin_resend_notification(p_notification_id)` · N

| Phase | Detail |
|---|---|
| DB change | `INSERT INTO notifications` cloning `type/title/body/data/user_id` of the source row, new id, `read=false`. The source row is left untouched. |
| Event | `notification.resent`, payload `{source_notification_id, user_id}`. |
| Audit | `action='resend_notification'`, `resource_id=source_id`, `after={new_notification_id}`. |

**Rollback:** delete the cloned notification if sent in error (`admin` may issue a follow-up; a duplicate is low-harm).

**Failure modes:** source not found → `notification_not_found`. Duplicate delivery is benign (idempotent from the user's perspective — they just see the message again).

**Recovery:** none required.

---

## 9. Clear Abuse Review — `admin_clear_abuse_review(p_user_id, p_note)` · R

| Phase | Detail |
|---|---|
| DB change | `UPDATE risk_scores SET review_required_at = NULL WHERE user_id = p_user_id`. **Does not** change `score` or `frozen_at`. |
| Event | `abuse.review_cleared`, payload `{note}`. |
| Audit | `action='clear_abuse_review'`, before/after `review_required_at`, `metadata={note}`. |

**Rollback:** re-flag by `UPDATE risk_scores SET review_required_at = NOW()` (a future `admin_flag_for_review` RPC, or re-run of the automated threshold). The score history in `abuse_signals` is immutable and preserved.

**Failure modes:** no risk row → `no_risk_record` (nothing to clear). Concurrent abuse signal raising the score re-sets `review_required_at` via `emit_abuse_signal` thresholds — that is correct, not a conflict (clearing reviews the *current* state; new signals legitimately re-flag).

**Recovery:** none required; clearing is non-destructive (signals retained).

---

## 10. Rebuild Projection — `admin_rebuild_projection(p_projection_name, p_dry_run)` · N

The most sensitive operation. Reuses `projection_event_log` for idempotency and runs under an advisory lock distinct from `refresh_platform_health` (42001) and the dashboard refresh.

| Phase | Detail |
|---|---|
| Dry run | Count events to replay for `p_projection_name`; list affected read rows. No writes. |
| Lock | `pg_advisory_xact_lock(43001)` — blocks concurrent rebuild and serialises against live application of the same projection. |
| Reset | Reset the projection's read rows to baseline (e.g. zero the affected `*_metrics` rows for the scope being rebuilt). |
| Clear gate | `DELETE FROM projection_event_log WHERE projection_name = p_projection_name` (scoped to the rebuild window). This is the **only** place the gate is deleted. |
| Replay | Re-dispatch the relevant `domain_events` in `occurred_at` order to the projector RPCs, which re-populate read rows; the freshly-cleared gate allows re-application exactly once. |
| Event | `projection.rebuild_requested`, payload `{projection_name, event_count}`. |
| Audit | `action='rebuild_projection'`, `metadata={projection_name, dry_run, event_count}`. |
| Immutability | `domain_events` is read-only throughout — it is the source of truth being replayed from. |

**Rollback:** a rebuild is convergent — re-running it produces the identical read model. There is no "undo," because the read model is fully derivable from the immutable event log. The safety net is: events are never lost (source of truth intact).

**Failure modes:**
- Crash after gate DELETE, before replay completes → projection rows partially populated, gate partially empty. Because the whole rebuild runs in one transaction under the advisory lock, a crash **rolls back the entire rebuild** (gate deletes and read resets included). The projection returns to its pre-rebuild state. Re-run cleanly.
- Lock contention → second rebuild blocks until the first commits/rolls back (no interleaving).
- Live events arriving mid-rebuild → serialised by the advisory lock; they apply after the rebuild transaction completes, against the rebuilt gate.

**Recovery:** because rebuild is transactional and idempotent, the recovery procedure is simply "run it again." Verify post-rebuild by comparing a spot-check aggregate (e.g. `SUM(prepper_metrics.total_revenue_pence)`) against an independent count from `domain_events`.

---

## 11. Cross-Cutting Failure & Recovery Summary

| Failure point | Effect | Recovery |
|---|---|---|
| `is_admin()` returns false | RPC aborts pre-mutation | none needed (nothing written) |
| Mutation succeeds, audit insert fails | impossible — same transaction; both roll back | — |
| Commit succeeds, pg_net dispatch fails | event row exists, downstream projection lags | retry queue (`dispatch_retry_events`) or `admin_replay_event` |
| External (Stripe) succeeds, DB commit fails | money moved, DB stale (refund/escrow only) | Stripe reconciliation runbook + `admin_replay_event`; idempotency keys prevent double-charge |
| Concurrent admin actions on same row | serialised by `SELECT ... FOR UPDATE` | last writer's before/after audited correctly |
| Projection drift detected | read model diverges from event log | `admin_rebuild_projection` (idempotent, transactional) |

### Irreversible-action policy
Refund and release-escrow are the only irreversible actions. Both:
1. Require an explicit precondition check (status guard) before any external call.
2. Call the external system **first**, DB **second**, with an idempotency key on the external call.
3. Record the external reference id in `audit_logs.metadata` so reconciliation can converge the DB without re-touching the external system.
4. Have no paired "undo" RPC — corrections are new, separately-audited compensating operations, consistent with the append-only event-sourcing model.
