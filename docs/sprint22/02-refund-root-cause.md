# F-02: Refund Race Condition — Root Cause & Fix

## The Broken Sequence

```
Admin → edge fn → [fetch payment] → [call Stripe refunds API]
                                          ↕ CRASH WINDOW
                                    [update payments.status = 'refunded']
```

The edge function calls Stripe *before* writing any DB state. If the Deno
process is killed (OOM, timeout, cold-start eviction, network partition) after
Stripe issues the refund but before the `admin_refund_order` RPC commits, the
payment row remains `status = 'captured'`. The next admin retry hits the same
code path: no DB evidence of the first refund → Stripe is called again →
**double refund issued**.

The `already_refunded` guard in migration 016 only checks `payments.refunded_at
IS NOT NULL`. That column is never set if the process crashes after Stripe but
before the DB write. The guard therefore offers zero protection against the most
likely crash scenario.

## Correct Sequence: DB-First State Machine

```
Admin → edge fn
  1. CALL admin_refund_order()          ← DB write FIRST (commits immediately)
        ├── acquires FOR UPDATE lock on payments row
        ├── checks payment status (guard)
        ├── checks for existing pending/completed op (idempotency)
        └── INSERTs payment_operations row  status='pending'
           returns {operation_id, idempotency_key, amount_pence, status}

  ── process may crash here — DB has a durable 'pending' record ──

  2. CALL Stripe refunds API            ← Stripe call AFTER DB commit
        header: Idempotency-Key: <idempotency_key from step 1>

  ── process may crash here — Stripe has issued the refund ──
  ── recovery worker detects pending op > 10 min, re-emits event ──

  3a. Stripe success → CALL admin_complete_refund()
        ├── sets payment_operations.status = 'completed'
        ├── sets payments.status = 'refunded'
        └── sets orders.status = 'refunded'

  3b. Stripe failure → CALL admin_fail_refund()
        └── sets payment_operations.status = 'failed'
           payments row unchanged — retry is safe
```

The DB is now always ahead of Stripe. Every crash window has a durable record
that either shows the operation is pending (retry it) or completed (skip it).

## Idempotency Strategy

Every refund operation gets a deterministic `stripe_idempotency_key`:

```
refund_<order_id>
```

This key is stored in `payment_operations.stripe_idempotency_key` (UNIQUE
constraint) before the Stripe call. When passed as the `Idempotency-Key` header
to `POST /v1/refunds`, Stripe guarantees that re-submitting the same key within
24 hours returns the *original* response rather than issuing a new charge.

This closes the double-refund window in all crash scenarios:
- Crash before Stripe call → pending op exists in DB → retry sends same key →
  Stripe issues refund once.
- Crash after Stripe call, before DB completion → pending op in DB → retry
  sends same idempotency key → Stripe returns the original refund object →
  `admin_complete_refund` marks it done.
- Second admin triggers refund for same order → `_begin_refund_operation` finds
  existing pending/completed op → returns it, no new Stripe call.

## Recovery Strategy

`pg_cron` runs `recover_stale_payment_operations()` every 5 minutes. It finds
`payment_operations` rows where:

```sql
operation_type = 'refund'
AND status = 'pending'
AND initiated_at < NOW() - INTERVAL '10 minutes'
```

For each stale operation it:
1. Transitions status to `'processing'` (so it appears in monitoring).
2. Emits a `stale_payment_operation_detected` security event with severity
   `'critical'`.

The edge function is designed to accept an `operation_id` on retry (the
`p_operation_id` parameter to `admin_refund_order`). The admin console or an
automated webhook consumes the security event and retries with that ID.
Because the Stripe idempotency key is preserved, Stripe will de-duplicate
correctly regardless of how many retries occur within 24 hours.

## How `payment_operations` Makes This Replayable and Auditable

`payment_operations` is an **immutable append-only ledger**:
- DELETE is blocked at the trigger level (`payment_operations_no_delete`).
- Every state transition (pending → processing → completed/failed) is recorded
  with a timestamp.
- `stripe_refund_id` is populated only after Stripe confirms, making the record
  the single source of truth for reconciliation against Stripe's dashboard.
- `stripe_idempotency_key` (UNIQUE) makes it impossible to create two pending
  refund operations for the same order — the DB enforces idempotency at the
  storage layer, not just in application logic.
- The full operation history is queryable by `payment_id`, making forensic
  analysis of any disputed charge a single indexed lookup.
