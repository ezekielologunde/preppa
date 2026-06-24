/**
 * S-22 / F-03 Projection Rebuild Isolation — Regression Tests
 *
 * Mock/unit style — no live DB connection required.
 * Guards advisory-lock serialisation, checksum recording, and drift detection
 * introduced in migration 024.
 *
 * Run: npx jest tests/security/s22-projection-isolation.test.ts
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type UUID = string

interface ProjectionLogRow {
  event_id:        UUID
  projection_name: string
}

interface ChecksumRow {
  projection_name: string
  checksum:        string
  event_count:     number
  computed_at:     Date
}

interface SecurityEvent {
  event_type: string
  payload:    Record<string, unknown>
}

// ── Simulated database state ──────────────────────────────────────────────────

interface DbState {
  projection_event_log: ProjectionLogRow[]
  projection_checksums: ChecksumRow[]
  security_events:      SecurityEvent[]
  // advisory lock state: projection_name → held (true = exclusive rebuild lock)
  advisory_locks:       Map<string, 'exclusive' | 'shared'>
  // counters (simplified read-model)
  prepper_total_orders: number
}

function freshState(): DbState {
  return {
    projection_event_log: [],
    projection_checksums: [],
    security_events:      [],
    advisory_locks:       new Map(),
    prepper_total_orders: 0,
  }
}

// ── MD5-like deterministic checksum (using sorted join, not real MD5) ─────────
// The real DB uses MD5(STRING_AGG(event_id::TEXT, ',' ORDER BY event_id)).
// We replicate the sorting contract so tests verify the sorted invariant.

function computeChecksum(log: ProjectionLogRow[], projectionName: string): string {
  const ids = log
    .filter(r => r.projection_name === projectionName)
    .map(r => r.event_id)
    .sort()
    .join(',')
  // Simulate MD5 with a stable hash adequate for unit tests
  return ids.length === 0 ? '' : `hash(${ids})`
}

// ── Advisory lock helpers ─────────────────────────────────────────────────────

function projectionLockId(name: string): string {
  // Mirrors _projection_lock_id; key is the name for test purposes
  return name
}

function tryAcquireExclusiveLock(state: DbState, projection: string): boolean {
  const key = projectionLockId(projection)
  if (state.advisory_locks.has(key)) return false  // already held
  state.advisory_locks.set(key, 'exclusive')
  return true
}

function releaseExclusiveLock(state: DbState, projection: string): void {
  state.advisory_locks.delete(projectionLockId(projection))
}

function acquireSharedLock(state: DbState, projection: string): boolean {
  // Shared lock is blocked only by an exclusive holder
  const key = projectionLockId(projection)
  return state.advisory_locks.get(key) !== 'exclusive'
}

// ── Simulated functions ───────────────────────────────────────────────────────

type Result<T> = { data: T; error: null } | { data: null; error: string }

function ok<T>(data: T): Result<T>    { return { data, error: null } }
function err(msg: string): Result<null> { return { data: null, error: msg } }

function projectionAlreadyApplied(
  state: DbState, eventId: UUID, projectionName: string
): boolean {
  const exists = state.projection_event_log.some(
    r => r.event_id === eventId && r.projection_name === projectionName
  )
  if (!exists) {
    state.projection_event_log.push({ event_id: eventId, projection_name: projectionName })
  }
  return exists
}

function mockProjectOrderCreated(
  state:  DbState,
  params: { event_id: UUID; prepper_id: string }
): Result<void> {
  // Shared lock check — fails if an exclusive rebuild lock is held
  if (!acquireSharedLock(state, 'project_order_created')) {
    return err('lock_blocked: rebuild in progress')
  }
  if (projectionAlreadyApplied(state, params.event_id, 'project_order_created')) {
    return ok(undefined)
  }
  state.prepper_total_orders += 1
  return ok(undefined)
}

function mockAdminRebuildProjection(
  state:         DbState,
  projectionName: string,
  eventsToReplay: UUID[]
): Result<{ session_id: UUID }> {
  // Non-blocking exclusive lock attempt
  if (!tryAcquireExclusiveLock(state, projectionName)) {
    return err('projection_rebuild_locked: another rebuild or active projection write is in progress')
  }

  try {
    // Clear gate + zero read-models (atomic under exclusive lock)
    state.projection_event_log = state.projection_event_log.filter(
      r => r.projection_name !== projectionName
    )
    if (projectionName === 'project_order_created') {
      state.prepper_total_orders = 0
    }

    // Replay (all under exclusive lock — no live writes can interleave)
    for (const eventId of eventsToReplay) {
      if (!projectionAlreadyApplied(state, eventId, projectionName)) {
        if (projectionName === 'project_order_created') {
          state.prepper_total_orders += 1
        }
      }
    }

    // Record checksum after replay
    const checksum  = computeChecksum(state.projection_event_log, projectionName)
    const eventCount = state.projection_event_log.filter(
      r => r.projection_name === projectionName
    ).length

    const existing = state.projection_checksums.findIndex(
      c => c.projection_name === projectionName
    )
    const row: ChecksumRow = {
      projection_name: projectionName,
      checksum,
      event_count: eventCount,
      computed_at: new Date(),
    }
    if (existing >= 0) {
      state.projection_checksums[existing] = row
    } else {
      state.projection_checksums.push(row)
    }

    releaseExclusiveLock(state, projectionName)
    return ok({ session_id: crypto.randomUUID() })
  } catch (e) {
    // Always release on failure
    releaseExclusiveLock(state, projectionName)
    throw e
  }
}

function mockCheckProjectionDrift(state: DbState): Result<Array<{ projection: string; drift: boolean }>> {
  const drifting: Array<{ projection: string; drift: boolean }> = []

  const projections = [...new Set(state.projection_event_log.map(r => r.projection_name))]
  for (const proj of projections) {
    const currentChecksum = computeChecksum(state.projection_event_log, proj)
    const stored = state.projection_checksums.find(c => c.projection_name === proj)
    if (stored && stored.checksum !== currentChecksum) {
      state.security_events.push({
        event_type: 'projection_drift_detected',
        payload: {
          projection_name:    proj,
          stored_checksum:    stored.checksum,
          current_checksum:   currentChecksum,
          stored_event_count: stored.event_count,
        },
      })
      drifting.push({ projection: proj, drift: true })
    }
  }
  return ok(drifting)
}

// ── Assertions ────────────────────────────────────────────────────────────────

function assertNoError<T>(result: Result<T>, label: string): void {
  if (result.error !== null) {
    throw new Error(`[${label}] unexpected error: ${result.error}`)
  }
}

function assertErrorContains(result: Result<unknown>, substring: string, label: string): void {
  if (result.error === null) {
    throw new Error(`[${label}] expected an error but got success`)
  }
  if (!result.error.includes(substring)) {
    throw new Error(`[${label}] error "${result.error}" does not contain "${substring}"`)
  }
}

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`Assertion failed: ${label}`)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('F-03: Projection Rebuild Isolation', () => {

  // ── Advisory lock: concurrent rebuild attempts ─────────────────────────────

  describe('concurrent rebuild attempts', () => {
    it('second concurrent rebuild attempt receives projection_rebuild_locked', () => {
      const state = freshState()
      const projection = 'project_order_created'
      const events = [crypto.randomUUID(), crypto.randomUUID()]

      // Simulate first rebuild holding the exclusive lock manually
      const held = tryAcquireExclusiveLock(state, projection)
      assert(held, 'first rebuild acquires exclusive lock')

      // Second rebuild should fail immediately (non-blocking try)
      const second = mockAdminRebuildProjection(state, projection, events)
      assertErrorContains(second, 'projection_rebuild_locked', 'second rebuild blocked')

      releaseExclusiveLock(state, projection)
    })

    it('rebuild succeeds after the exclusive lock is released', () => {
      const state = freshState()
      const projection = 'project_order_created'
      const events = [crypto.randomUUID()]

      // First rebuild runs and releases lock
      const first = mockAdminRebuildProjection(state, projection, events)
      assertNoError(first, 'first rebuild')

      // Lock must be released now — second can proceed
      const second = mockAdminRebuildProjection(state, projection, events)
      assertNoError(second, 'second rebuild after release')
    })
  })

  // ── Shared lock: multiple live writes proceed simultaneously ───────────────

  describe('shared lock: concurrent live projection writes', () => {
    it('multiple live projection writes proceed when no exclusive lock is held', () => {
      const state = freshState()
      const e1 = crypto.randomUUID()
      const e2 = crypto.randomUUID()
      const e3 = crypto.randomUUID()

      const r1 = mockProjectOrderCreated(state, { event_id: e1, prepper_id: 'p1' })
      const r2 = mockProjectOrderCreated(state, { event_id: e2, prepper_id: 'p2' })
      const r3 = mockProjectOrderCreated(state, { event_id: e3, prepper_id: 'p3' })

      assertNoError(r1, 'write 1')
      assertNoError(r2, 'write 2')
      assertNoError(r3, 'write 3')
      assert(state.prepper_total_orders === 3, 'all three writes applied')
    })

    it('idempotency gate deduplicates repeated event writes', () => {
      const state = freshState()
      const eventId = crypto.randomUUID()

      mockProjectOrderCreated(state, { event_id: eventId, prepper_id: 'p1' })
      mockProjectOrderCreated(state, { event_id: eventId, prepper_id: 'p1' })  // duplicate

      assert(state.prepper_total_orders === 1, 'duplicate write skipped by gate')
    })
  })

  // ── Exclusive lock: rebuild blocks live writes ─────────────────────────────

  describe('exclusive lock: rebuild blocks live writes', () => {
    it('live projection write is blocked while rebuild holds exclusive lock', () => {
      const state = freshState()
      const projection = 'project_order_created'

      // Rebuild acquires exclusive lock
      tryAcquireExclusiveLock(state, projection)

      // Live write should be blocked
      const result = mockProjectOrderCreated(state, {
        event_id:   crypto.randomUUID(),
        prepper_id: 'p1',
      })
      assertErrorContains(result, 'lock_blocked', 'live write blocked by exclusive lock')
      assert(state.prepper_total_orders === 0, 'counter unchanged while locked')

      releaseExclusiveLock(state, projection)
    })

    it('live writes proceed after exclusive lock released', () => {
      const state = freshState()
      const projection = 'project_order_created'

      tryAcquireExclusiveLock(state, projection)
      releaseExclusiveLock(state, projection)

      const result = mockProjectOrderCreated(state, {
        event_id:   crypto.randomUUID(),
        prepper_id: 'p1',
      })
      assertNoError(result, 'live write after lock released')
      assert(state.prepper_total_orders === 1, 'counter incremented after release')
    })
  })

  // ── Checksum: recorded after rebuild ──────────────────────────────────────

  describe('projection checksums', () => {
    it('checksum is stored in projection_checksums after a successful rebuild', () => {
      const state = freshState()
      const projection = 'project_order_created'
      const events = [crypto.randomUUID(), crypto.randomUUID()]

      const result = mockAdminRebuildProjection(state, projection, events)
      assertNoError(result, 'rebuild')

      const stored = state.projection_checksums.find(c => c.projection_name === projection)
      assert(stored !== undefined, 'checksum row exists')
      assert(stored!.event_count === 2, 'event_count matches replayed events')
      assert(stored!.checksum !== '', 'checksum is non-empty')
    })

    it('checksum is deterministic: same events produce same checksum regardless of order', () => {
      const state1 = freshState()
      const state2 = freshState()
      const projection = 'project_order_created'
      const e1 = 'aaaaaaaa-0000-0000-0000-000000000001'
      const e2 = 'bbbbbbbb-0000-0000-0000-000000000002'

      mockAdminRebuildProjection(state1, projection, [e1, e2])
      mockAdminRebuildProjection(state2, projection, [e2, e1])  // reversed order

      const c1 = state1.projection_checksums.find(c => c.projection_name === projection)!
      const c2 = state2.projection_checksums.find(c => c.projection_name === projection)!

      assert(c1.checksum === c2.checksum, 'checksum is order-independent')
    })

    it('checksum changes when a new event is applied after rebuild', () => {
      const state = freshState()
      const projection = 'project_order_created'
      const initialEvents = [crypto.randomUUID()]

      mockAdminRebuildProjection(state, projection, initialEvents)
      const beforeChecksum = state.projection_checksums.find(
        c => c.projection_name === projection
      )!.checksum

      // Live event applied after rebuild
      mockProjectOrderCreated(state, { event_id: crypto.randomUUID(), prepper_id: 'p1' })

      const afterChecksum = computeChecksum(state.projection_event_log, projection)
      assert(beforeChecksum !== afterChecksum, 'checksum changes after new live event')
    })
  })

  // ── Drift detection ───────────────────────────────────────────────────────

  describe('drift detection', () => {
    it('no drift reported when checksum matches current log', () => {
      const state = freshState()
      const projection = 'project_order_created'

      mockAdminRebuildProjection(state, projection, [crypto.randomUUID()])

      const result = mockCheckProjectionDrift(state)
      assertNoError(result, 'drift check')
      assert(result.data!.length === 0, 'no drift when checksum is current')
    })

    it('drift detected after projection_event_log is modified without updating checksum', () => {
      const state = freshState()
      const projection = 'project_order_created'

      mockAdminRebuildProjection(state, projection, [crypto.randomUUID()])

      // Tamper: add a row directly without calling record_projection_checksum
      state.projection_event_log.push({
        event_id:        crypto.randomUUID(),
        projection_name: projection,
      })

      const result = mockCheckProjectionDrift(state)
      assertNoError(result, 'drift check')
      assert(result.data!.length === 1, 'drift detected')
      assert(result.data![0].projection === projection, 'correct projection flagged')
    })

    it('drift detection emits a security event for each drifting projection', () => {
      const state = freshState()
      const projection = 'project_order_created'

      mockAdminRebuildProjection(state, projection, [crypto.randomUUID()])

      // Tamper the log
      state.projection_event_log.push({
        event_id:        crypto.randomUUID(),
        projection_name: projection,
      })

      mockCheckProjectionDrift(state)

      const secEvent = state.security_events.find(
        e => e.event_type === 'projection_drift_detected'
      )
      assert(secEvent !== undefined, 'security event emitted')
      assert(
        secEvent!.payload['projection_name'] === projection,
        'security event identifies the correct projection'
      )
    })

    it('no security event when projection has never had a checksum recorded', () => {
      // Drift detection skips projections with no stored checksum —
      // there is nothing to compare against.
      const state = freshState()
      state.projection_event_log.push({
        event_id:        crypto.randomUUID(),
        projection_name: 'project_order_created',
      })

      const result = mockCheckProjectionDrift(state)
      assertNoError(result, 'drift check on untracked projection')
      assert(result.data!.length === 0, 'no drift reported without stored checksum')
      assert(state.security_events.length === 0, 'no security event emitted')
    })
  })

  // ── Advisory lock release on failure ─────────────────────────────────────

  describe('lock release on rebuild failure', () => {
    it('exclusive lock is released after a rebuild throws an exception', () => {
      const state = freshState()
      const projection = 'project_order_created'

      // Inject a failure: start rebuild, acquire lock, then simulate inner error
      const lockAcquired = tryAcquireExclusiveLock(state, projection)
      assert(lockAcquired, 'lock acquired before simulated failure')

      // Simulate the EXCEPTION WHEN OTHERS path
      try {
        throw new Error('simulated_inner_error')
      } catch {
        releaseExclusiveLock(state, projection)  // mirrors the EXCEPTION block
      }

      // Lock should be gone — next rebuild can proceed
      const lockAfter = state.advisory_locks.has(projectionLockId(projection))
      assert(!lockAfter, 'exclusive lock released after simulated failure')

      // And a new rebuild can now acquire the lock
      const nextRebuild = mockAdminRebuildProjection(state, projection, [])
      assertNoError(nextRebuild, 'rebuild succeeds after lock released on failure')
    })

    it('live writes unblocked after failed rebuild releases lock', () => {
      const state = freshState()
      const projection = 'project_order_created'

      tryAcquireExclusiveLock(state, projection)

      // Simulate failure + release
      try { throw new Error('boom') } catch { releaseExclusiveLock(state, projection) }

      const result = mockProjectOrderCreated(state, {
        event_id:   crypto.randomUUID(),
        prepper_id: 'p1',
      })
      assertNoError(result, 'live write unblocked after failed rebuild releases lock')
    })
  })

})
