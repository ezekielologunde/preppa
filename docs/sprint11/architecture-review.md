# Sprint 11 — Architecture Review: Operations Control Plane (Admin OS)

> Pre-implementation. Author: Principal Backend + Staff SRE. Date: 2026-06-22.
> Migrations 001–009 are applied. Sprint 11 introduces migrations **010–017** (admin layer rebuilt from scratch after the 2026-06-21 wipe).

## 0. Guiding Principles

1. **Reads come from projections, never live transactional tables.** The dashboard reads `*_metrics`, `platform_health_metrics`, `listing_stats`, and new Sprint 11 admin projections — never `SELECT ... FROM orders` directly.
2. **Every admin mutation flows through the event log.** Admin actions are commands; they write the source table *and* emit a `domain_events` row so downstream projections, audit, and replay stay consistent with the rest of the CQRS pipeline.
3. **Idempotency is reused, not reinvented.** Replay and projection rebuild use the existing `projection_event_log` gate (`_projection_already_applied`). No new idempotency mechanism.
4. **Additive only.** Sprint 11 adds tables, RPCs, and policies. It does not alter the shape of any existing table or change any existing trigger/projector behaviour. See §8.

---

## 1. Part 1 — Admin Dashboard (read side)

### Decisions
| Decision | Choice | Rationale |
|---|---|---|
| Data source | Existing projection tables + new `admin_*` projections | Live queries on `orders`/`payments` would couple the control plane to write-side load and bypass RLS guarantees. |
| Query surface | `SECURITY DEFINER` RPCs prefixed `admin_get_*`, gated by `is_admin()` | Dashboard never holds `service_role`; it runs as an authenticated admin user. RPC is the only privileged surface. |
| Aggregation | Pre-computed singletons (`platform_metrics`, `platform_health_metrics`) refreshed by `pg_cron` | O(1) dashboard reads; no fan-out scans on render. |
| Freshness | Eventual; `computed_at` / `last_updated` surfaced to UI | Honest staleness display; matches CQRS read-side contract. |

### New objects (migration 010)
- `admin_dashboard_snapshot` (singleton, `id = 1`) — denormalised top-line tile (orders today, GMV today, active preppers, frozen accounts, open dead letters, retry depth, p95 latencies). Refreshed by `refresh_admin_dashboard()` via `pg_cron` every 60s.
- `admin_get_dashboard()` RPC — single round-trip read of the snapshot + health metrics, gated by `is_admin()`.

### Integration
```
pg_cron(60s) ─► refresh_admin_dashboard() ─► admin_dashboard_snapshot (singleton)
                       │  reads: platform_metrics, platform_health_metrics,
                       │         risk_scores, event_dead_letters, event_processing_log
admin UI ─► admin_get_dashboard() [is_admin gate] ─► snapshot row (single read)
```

---

## 2. Part 2 — Admin Actions (write side)

### Decisions
Each admin action is a `SECURITY DEFINER` RPC, `admin_<verb>_<noun>`, that:
1. Asserts `is_admin()` (raises `not_admin` otherwise).
2. Mutates the target table.
3. Writes an `audit_logs` row (`actor_id = auth.uid()`, before/after state).
4. Emits a `domain_events` row with `aggregate_type = 'admin'` or the affected aggregate, so the existing pg_net → event-processor pipeline picks it up.
5. Returns a structured result (`{ ok, before, after, event_id }`).

| Action | Target table | Emitted event | Reversible |
|---|---|---|---|
| freeze account | `risk_scores.frozen_at` | `account.frozen` | yes (unfreeze) |
| unfreeze account | `risk_scores.frozen_at = NULL` | `account.unfrozen` | yes (freeze) |
| verify prepper | `kitchens` (new `verified_at`) | `prepper.verified` | yes (unverify) |
| disable listing | `listings.status = 'paused'` | `listing.disabled_by_admin` | yes (re-enable) |
| refund | `payments.status = 'refunded'` | `payment.refunded` | **no** (money moved) |
| release escrow | `payments.status = 'released'` | `payment.released` | **no** (money moved) |
| retry event | `event_processing_log` → `pending_retry` | `event.retry_requested` | yes (idempotent) |
| replay dead letter | re-dispatch from `event_dead_letters` | `deadletter.replayed` | yes (idempotent) |
| resend notification | `notifications` insert | `notification.resent` | yes (no-op duplicate) |
| clear abuse review | `risk_scores.review_required_at = NULL` | `abuse.review_cleared` | yes (re-flag) |
| rebuild projection | replay window → projectors | `projection.rebuild_requested` | yes (idempotent) |

### `verified_at` note
Migration 011 adds `kitchens.verified_at TIMESTAMPTZ` and `kitchens.verified_by UUID`. This is an **additive nullable column** — does not change existing kitchen RLS or triggers (§8).

### Integration
```
admin UI ─► admin_<action>() [is_admin gate, SECURITY DEFINER]
              ├─► UPDATE target table  (orders/payments/listings/risk_scores/...)
              ├─► INSERT audit_logs    (before/after, actor=admin)
              └─► INSERT domain_events (aggregate event)
                        │
                        └─► on_domain_event_insert ─► pg_net ─► event-processor
                                                                   └─► projection RPCs
```

---

## 3. Part 3 — Feature Flag Service

### Decisions
| Decision | Choice | Rationale |
|---|---|---|
| Storage | `feature_flags` (definition) + `feature_flag_rules` (scoped overrides) | Separates the flag identity from its many targeting rules. |
| Scopes | global, country, city, user, prepper, percentage, min_version | Ordered precedence; most-specific wins. |
| Kill switch | `feature_flags.kill_switch BOOLEAN` | Single-write disable that short-circuits all rules. |
| Evaluation | `SECURITY DEFINER` function `flag_enabled(p_key, p_ctx JSONB)` | Centralised precedence logic; callable from RLS, RPCs, and edge functions. |
| Percentage | Deterministic `hashtext(key || user_id) % 100 < pct` | Stable bucketing — a user does not flip between renders. |
| Caching | Edge function reads a materialised `feature_flag_state` JSON blob; DB is source of truth | Avoids per-request rule scans on the hot path. |

### Precedence (highest → lowest)
`kill_switch` → user rule → prepper rule → city rule → country rule → percentage → version gate → global default.

### Integration
```
admin UI ─► admin_set_flag() / admin_set_flag_rule() [is_admin]
              └─► feature_flags / feature_flag_rules
                        └─► emit domain_events 'flag.changed'
                                  └─► refresh feature_flag_state blob (projector)

client/edge ─► flag_enabled(key, ctx) ─► precedence eval ─► bool
```
Feature flags are evaluated **read-side**; they never block the event pipeline. Writing a flag emits a `flag.changed` event purely for audit/observability, not for projection of business metrics.

---

## 4. Part 4 — Operational Runbooks

Documentation artefact, not schema. Lives in `docs/sprint11/operational-workflows.md`. Each runbook references the exact RPC, the audit signature it writes, and the rollback RPC. The DB contribution is that **every** admin RPC writes a structured `audit_logs` row whose `action` matches the runbook name, so a runbook can be reconstructed from the audit trail.

---

## 5. Part 5 — Observability

### Decisions
| Signal | Source | New object |
|---|---|---|
| API latency | edge function timing → `ops_latency_samples` | migration 014 |
| DB latency | `pg_stat_statements` rollup | view `ops_db_latency` |
| Projection latency | `processed_at - created_at` on `event_processing_log` | already present; rolled into snapshot |
| Notification latency | `notifications.created_at` vs delivery callback | `ops_latency_samples(kind='notification')` |
| Event throughput | count of `domain_events` per minute | `ops_event_throughput` (rollup table) |
| Dead letters | `event_dead_letters` unresolved count | already present |
| Retry depth | `event_processing_log` where `pending_retry` | already present |

### Decisions
- **Sampling, not tracing.** `ops_latency_samples` stores p50/p95/p99 buckets per minute, not every request. Cheap, bounded growth, `pg_cron` rolls up and prunes >14 days.
- **One read RPC:** `admin_get_observability(p_window)` returns all signals in one call.
- Alerting thresholds live in `ops_alert_thresholds` (admin-editable) so SRE can tune without a deploy.

### Integration
```
edge fns ─► ops_record_latency(kind, ms)  [service_role]
pg_cron  ─► ops_rollup()  ─► ops_latency_samples (p50/p95/p99) + ops_event_throughput
admin UI ─► admin_get_observability(window) [is_admin] ─► all signals, one read
```

---

## 6. Part 6 — Replay Console

### Decisions
| Decision | Choice | Rationale |
|---|---|---|
| Idempotency | Reuse `projection_event_log` + `_projection_already_applied` | A replayed event that was already applied is a guaranteed no-op. This is the single most important safety property. |
| Single replay | `admin_replay_event(p_event_id, p_dry_run)` | Re-dispatches one `domain_events` row to the event-processor. |
| Range replay | `admin_replay_range(p_from, p_to, p_event_type, p_dry_run)` | Bounded by time window + optional type filter; capped batch size. |
| Rebuild | `admin_rebuild_projection(p_projection_name, p_dry_run)` | Deletes that projection's `projection_event_log` rows for the target window, resets the projection rows, then replays. |
| Dry-run | Counts/lists what *would* be replayed; touches nothing | Mandatory pre-flight for range/rebuild. |

### Critical rebuild ordering
Rebuild is the only operation that **deletes** from `projection_event_log` (to allow re-application). It must:
1. Run in a single transaction per projection.
2. Take advisory lock (e.g. `pg_advisory_xact_lock(43001)`) so concurrent live events do not interleave with the reset.
3. Reset the projection's read rows to zero/baseline.
4. Delete the `projection_event_log` rows scoped to `projection_name`.
5. Re-emit/re-dispatch the source events in `occurred_at` order.

### Integration
```
admin UI ─► admin_replay_event(id, dry_run) [is_admin]
              ├─ dry_run=true  ─► return preview (no writes)
              └─ dry_run=false ─► net.http_post ─► event-processor
                                       └─► projector ─► _projection_already_applied()
                                                              ├─ already applied → NO-OP
                                                              └─ new → apply
```

---

## 7. Build Dependency Order

```
            ┌──────────────────────────────────────────────┐
            │ 010 admin_identity (is_admin, admin_users)   │  ← FOUNDATION, build first
            └───────────────┬──────────────────────────────┘
                            │ (every other RPC depends on is_admin())
        ┌───────────────────┼───────────────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼
 011 admin_actions   012 feature_flags   014 observability   016 replay_console
 (freeze/verify/      (flags+rules+        (samples+rollups)   (replay/rebuild)
  refund/escrow…)      flag_enabled)             │                   │
        │                   │                    │                   │
        ▼                   ▼                    ▼                   ▼
 013 admin_dashboard ◄──── reads from all of the above (snapshot projector)
        │
        ▼
 015 runbooks (docs)  ── 017 admin RLS hardening / GRANT revocation pass (LAST)
```

| Order | Migration | Must precede | Why |
|---|---|---|---|
| 1 | 010 admin_identity | everything | `is_admin()` is the gate for every Sprint 11 RPC |
| 2 | 011 admin_actions | 013 dashboard | dashboard surfaces action results/counts |
| 3 | 012 feature_flags | 013, edge fns | flags gate rollout of the rest |
| 4 | 014 observability | 013 dashboard | dashboard tiles read observability rollups |
| 5 | 016 replay_console | — | depends only on 010 + existing event tables |
| 6 | 013 admin_dashboard | — | aggregates 011/012/014 |
| 7 | 017 hardening pass | — | revoke PUBLIC execute, final GRANTs (mirrors migration 009 pattern) |

**Rule:** 010 first, 017 last. 013 after 011/012/014. 016 is independent and can be built in parallel after 010.

---

## 8. What NOT to Change in the Existing Schema

| Object | Why it is frozen |
|---|---|
| `domain_events` shape (envelope columns) | The pg_net dispatch body in `dispatch_to_event_processor` and the event-processor edge function are coupled to exactly these columns. Adding admin events uses the same shape — do not add columns. |
| `on_domain_event_insert` trigger | Fires the webhook. Admin events must flow through it unchanged; do not add WHEN clauses that could skip admin events. |
| `projection_event_log` PK `(event_id, projection_name)` | The idempotency contract for the entire CQRS layer and the Replay Console. Changing it breaks every projector. |
| `_projection_already_applied()` | Shared by all projectors and `increment_kitchen_orders`. Do not alter its insert-then-check semantics. |
| `emit_order_event` / `emit_listing_event` triggers | Admin actions emit their *own* events; they must not piggyback on or modify these business triggers. |
| `payment_status` / `order_status` enums | Refund/release use existing enum values (`refunded`, `released`). Do not add admin-only statuses — that fragments the state machine. |
| `risk_scores` freeze thresholds (800/500 in `emit_abuse_signal`) | Admin freeze sets `frozen_at` directly; it must not change the automated thresholds. |
| Existing RLS policies | Sprint 11 *adds* admin SELECT policies; it must not weaken `service_role` or owner-scoped policies. |
| `refresh_platform_health` advisory lock (42001) | Admin dashboard refresh must use a *different* lock id (e.g. 42002) to avoid contention. |

### Data flow — full system after Sprint 11
```
                         ┌─────────────── WRITE SIDE ───────────────┐
 business writes ──► orders/listings/payments ──► emit_*_event ──┐  │
 admin writes ────► admin_<action>() ──► table + audit_logs ─────┤  │
                                                                 ▼  │
                                                          domain_events
                                                                 │
                                                   on_domain_event_insert
                                                                 │ pg_net
                                                                 ▼
                                                         event-processor (edge)
                                                                 │
                                            ┌────────────────────┴───────────────┐
                                            ▼                                     ▼
                                   projection RPCs                       event_processing_log
                                   (idempotent via PEL)                  / event_dead_letters
                                            │                                     │
                         ┌──── READ SIDE ───┴──────────────┐                      │
                         ▼                                 ▼                      ▼
              *_metrics / *_stats              admin_dashboard_snapshot   Replay Console
                         │                                 │              (re-dispatch, idempotent)
                         └─────────► admin_get_dashboard() / admin_get_observability() [is_admin]
```
