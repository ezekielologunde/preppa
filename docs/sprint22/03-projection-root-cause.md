# F-03: Projection Rebuild Race Condition — Root Cause Analysis

## The Exact Race Condition

`admin_rebuild_projection` clears `projection_event_log` for a projection, then replays
all domain events through `admin_replay_range`. Between those two steps, live projection
writes keep arriving. The idempotency gate cannot protect against this because the gate
itself was cleared.

### Step-by-Step Timeline

```
T0   admin_rebuild_projection acquires cooldown lock in admin_operation_locks
T1   DELETE FROM projection_event_log WHERE projection_name = 'project_order_created'
     → gate is now empty for this projection
T2   UPDATE prepper_metrics SET total_orders = 0 ...  (read-models zeroed)

T3   [Live event E-99 arrives] → order.created fires project_order_created(E-99, ...)
     → _projection_already_applied('E-99', 'project_order_created')
       → INSERT INTO projection_event_log (E-99, ...) ON CONFLICT DO NOTHING
       → ROW_COUNT = 1 (succeeds — gate was cleared at T1, not a duplicate)
     → prepper_metrics.total_orders += 1   ← first application of E-99

T4   admin_replay_range begins iterating domain_events ORDER BY occurred_at ASC
T5   Replay reaches E-99:
     → _projection_already_applied('E-99', 'project_order_created')
       → INSERT INTO projection_event_log (E-99, ...) ON CONFLICT DO NOTHING
       → ROW_COUNT = 0 (E-99 was inserted at T3 — idempotency fires, skips)
                                             ← CORRECT for E-99 specifically

     BUT for any event E-50 that arrived BEFORE T1 (already in the log at T0),
     was cleared at T1, and then had no live re-arrival before replay reached it:
     → replay inserts E-50 and increments counters once — that is correct.

     THE ACTUAL DOUBLE-COUNT PATH:
     → For events that fire BETWEEN T1 and the moment replay reaches them in
       the ordered scan, the live write (T3) wins the projection_event_log
       insert, and the replay's attempt is blocked by ON CONFLICT. So replay
       SKIPS the increment. But if the read-model was zeroed at T2, the live
       write at T3 added +1. Replay skips. Final count = 1. This is CORRECT.

     HOWEVER — the window where the race actually causes double-counts is:
     → An event E-77 that arrived AFTER T1 (gate cleared) AND BEFORE T2
       (read-models zeroed):
       Live write: projection_event_log(E-77) inserted, prepper_metrics += 1
       Then T2 zeros prepper_metrics.
       Then replay reaches E-77: ON CONFLICT skips.
       Final count = 0. E-77's contribution is LOST (under-count).

     → An event E-88 that arrives AFTER T2 AND replayed before replay reaches it:
       Same as T3 above — live write wins the gate, replay skips. Count = 1.
       This is correct by accident: the gate serialises per-event.

     THE GENUINE DOUBLE-COUNT:
     pg_advisory_lock is absent, so two concurrent calls to project_order_created
     for DIFFERENT events can interleave with the rebuild as follows:
     1. Rebuild clears the gate (T1).
     2. Rebuild zeros read-models (T2).
     3. Live event E-99 processed: gate insert OK, metrics += 1.
     4. Replay event E-77 (older): gate insert OK (cleared), metrics += 1.
     5. Live event E-77 arrives AGAIN (e.g. retry / at-least-once delivery):
        → gate: ON CONFLICT DO NOTHING → 0 rows → skips. Safe.
     But if the event processor runs E-77 live AND the rebuilder replays E-77
     CONCURRENTLY (both before either commits), both see the gate as empty and
     both INSERT — PostgreSQL serialises the inserts via the PRIMARY KEY
     constraint, so only one wins. Safe at the gate level.

     THE REAL UNFIXABLE SCENARIO WITHOUT EXCLUSIVE LOCK:
     Without a serialisation point, there is a window [T1, replay-cursor] during
     which any live event can write to projection_event_log legitimately (gate
     was cleared). If that event also occurred BEFORE the oldest domain_events
     entry being replayed, the replay will attempt to process it again. The gate
     prevents replay duplication for that specific event. BUT the read-model
     counters are zeroed at T2, so events processed live between T1 and T2 that
     the replay then skips leave no trace in the read-model. The metrics are
     understated for those events.

     Summary: the race produces UNDER-COUNTS (lost events) not over-counts when
     the zeroing (T2) happens after some live events have already written through
     the cleared gate. With concurrent rebuild attempts it can also produce
     OVER-COUNTS if two rebuilds overlap without exclusive serialisation.
```

### Simplified Two-Sentence Statement

After the gate is cleared (T1) and before read-models are zeroed (T2), live events
write through the gate legitimately. When the rebuild then zeros the read-models at T2,
those live writes are erased and the replay skips them via the gate — producing
permanent under-counts for every event in that window.

---

## Why Idempotency Alone Does Not Solve It

`_projection_already_applied` works by inserting a `(event_id, projection_name)` row
with `ON CONFLICT DO NOTHING`. If the row is already there, the event is skipped.

During a rebuild, step 1 is:

```sql
DELETE FROM projection_event_log WHERE projection_name = p_projection_name;
```

After that DELETE, no rows exist for this projection. Every subsequent call to
`_projection_already_applied` for this projection will see an empty gate and insert
successfully — including live events that should only be counted once.

The gate cannot distinguish between:
- A live event arriving after the clear (legitimately first-time)
- A replayed historical event being re-processed

Both get `ROW_COUNT = 1` and proceed to update the metrics. The gate was designed to
prevent processing the same event twice within a stable system. It cannot protect
against a cleared-and-replaying system where live writes interleave with the replay
cursor. This is an ordering and visibility problem, not a uniqueness problem.

---

## Advisory Lock Strategy

PostgreSQL advisory locks provide a lightweight, in-process serialisation primitive
that does not require a table row.

### Lock ID Derivation

Each projection gets a deterministic BIGINT lock key derived from its name:

```sql
SELECT ABS(HASHTEXT('project_order_created'))  -- deterministic per name
```

`HASHTEXT` is a stable PostgreSQL built-in that returns an INT4; wrapping in ABS
avoids negative values that can confuse some client-side tooling.

### Shared vs Exclusive

| Operation | Lock type | Function |
|-----------|-----------|----------|
| Live projection write | `pg_advisory_xact_lock_shared(lock_id)` | Transaction-scoped shared |
| Projection rebuild | `pg_advisory_lock(lock_id)` (exclusive) | Session-scoped exclusive |

**Shared** locks are compatible with each other: many concurrent live projection writes
can proceed simultaneously. An exclusive lock blocks until all shared holders release.

**Exclusive** lock for rebuild uses session-level (`pg_advisory_lock`, not `xact`)
because the rebuild spans multiple internal transactions during the replay loop. It is
released explicitly in a `BEGIN/EXCEPTION` block to guarantee release on failure.

### Why xact-level for live writes

`pg_advisory_xact_lock_shared` auto-releases at transaction end (commit or rollback).
No explicit release is needed, and no leaked locks are possible. This is safe for
short-lived projection functions that commit in a single transaction.

### Serialisation Guarantee

Once a rebuild acquires the exclusive lock, all subsequent calls to live projection
functions block at `pg_advisory_xact_lock_shared` until the rebuild releases. The
replay then processes events in a quiescent window — no interleaving with live writes.

---

## Checksum Strategy

After a rebuild, we record a fingerprint of exactly which events were applied:

```
checksum = MD5(STRING_AGG(event_id::TEXT, ',' ORDER BY event_id))
```

- `event_id` values are UUIDs sorted lexicographically, making the aggregate
  deterministic regardless of insertion order.
- MD5 is sufficient here: we are detecting accidental drift or replay bugs, not
  adversarial collisions. The event IDs are already UUIDs with 122 bits of entropy.
- Stored in `projection_checksums(projection_name PK, checksum, event_count, computed_at)`.

A rebuild always calls `record_projection_checksum` as its last step. Any subsequent
live event that goes through `_projection_already_applied` and updates the log will
cause the live checksum to diverge from the stored one.

---

## Drift Detection

Drift = the stored checksum no longer matches the current log.

This can happen when:
1. A migration accidentally modified `projection_event_log` rows.
2. A partial rebuild failed partway through and left the log in an inconsistent state.
3. A bug in a projection function inserted a duplicate log row (unlikely with PK, but
   possible if the schema were altered).
4. A live event was processed after a rebuild but before the next checksum update
   (expected and not problematic — drift detection distinguishes "stale checksum"
   from "corrupt state" by comparing event counts alongside checksums).

### Detection Mechanism

`check_projection_drift()` (runs every 5 minutes via pg_cron):

1. For each distinct `projection_name` in `projection_event_log`, compute the current
   checksum from live data.
2. Compare against the stored value in `projection_checksums`.
3. If they differ, call `emit_security_event('projection_drift_detected', ...)` at
   `critical` severity and return the drifting projections as JSONB.

### Staleness vs Corruption

A newly processed live event changes the checksum legitimately. The pg_cron job will
fire `projection_drift_detected` between rebuilds — this is expected and the alert
handler should distinguish:

- `current_event_count > stored_event_count` → normal live growth; not an alert.
- `current_event_count < stored_event_count` → rows were deleted; alert.
- `current_event_count = stored_event_count AND checksum differs` → rows were mutated;
  critical alert.

The migration records `event_count` alongside the checksum to enable this triage.
The alert payload includes both counts so the consumer can apply the above logic.
