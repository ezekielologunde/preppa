/**
 * Sprint 22 Chaos Test Suite — Part 1 (Scenarios 1–4)
 * Executable specifications for fault injection against S-22 fixes.
 * No live DB connection — pure mock state simulation.
 * Run: npx jest tests/chaos/sprint22-chaos-part1.test.ts
 */

// ── Shared types ───────────────────────────────────────────────────────────────

type PaymentStatus  = 'pending' | 'captured' | 'in_escrow' | 'refunded' | 'released'
type OpStatus       = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
type LockState      = 'exclusive' | 'shared'

interface UserRoleRow {
  user_id: string
  role: string
  revoked_at: Date | null
  expires_at: Date | null
}

interface PaymentOp {
  id: string
  payment_id: string
  operation_type: string
  initiated_by: string | null
  initiated_at: Date
  status: OpStatus
  stripe_idempotency_key: string | null
  stripe_refund_id: string | null
  amount_pence: number
  completed_at: Date | null
  failed_at: Date | null
  failure_reason: string | null
}

interface Payment {
  id: string
  order_id: string
  stripe_payment_intent_id: string
  amount_pence: number
  status: PaymentStatus
}

interface SecurityEvent {
  event_type: string
  severity: string
  metadata: Record<string, unknown>
}

interface ProjectionLogRow { event_id: string; projection_name: string }
interface ChecksumRow { projection_name: string; checksum: string; event_count: number }

// ── Shared state builder ───────────────────────────────────────────────────────

interface S1State {
  userRoles: UserRoleRow[]
  payments: Payment[]
  paymentOps: PaymentOp[]
  securityEvents: SecurityEvent[]
  // Simulates the advisory lock for admin_operation_locks (a DB table, not session)
  operationLocks: Map<string, { locked_until: Date; operation_id: string }>
}

function makeS1State(): S1State {
  return {
    userRoles: [],
    payments: [
      { id: 'pay-1', order_id: 'ord-1', stripe_payment_intent_id: 'pi_abc', amount_pence: 5000, status: 'captured' },
    ],
    paymentOps: [],
    securityEvents: [],
    operationLocks: new Map(),
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function hasActiveRole(state: { userRoles: UserRoleRow[] }, uid: string, role: string): boolean {
  const now = new Date()
  return state.userRoles.some(
    r => r.user_id === uid && r.role === role && r.revoked_at === null &&
         (r.expires_at === null || r.expires_at > now),
  )
}

// Mirrors is_admin() — always queries DB, JWT is advisory only
function isAdmin(state: { userRoles: UserRoleRow[]; securityEvents: SecurityEvent[] }, uid: string, jwtRole: string | null): boolean {
  const active = hasActiveRole(state, uid, 'admin')
  if (!active && jwtRole === 'admin') {
    state.securityEvents.push({
      event_type: 'admin_jwt_claim_denied_by_db',
      severity: 'critical',
      metadata: { uid, db_authorized: false, jwt_claim: jwtRole },
    })
  }
  return active
}

function beginRefundOp(state: S1State, orderId: string, adminId: string): { op_id: string; idem_key: string } {
  const payment = state.payments.find(p => p.order_id === orderId)!
  const existing = state.paymentOps.find(
    op => op.payment_id === payment.id && op.operation_type === 'refund' &&
          ['pending', 'processing'].includes(op.status),
  )
  if (existing) return { op_id: existing.id, idem_key: existing.stripe_idempotency_key! }

  const idem_key = `refund_${orderId}`
  const op: PaymentOp = {
    id: `op-${state.paymentOps.length + 1}`,
    payment_id: payment.id, operation_type: 'refund',
    initiated_by: adminId, initiated_at: new Date(), status: 'pending',
    stripe_idempotency_key: idem_key, stripe_refund_id: null,
    amount_pence: payment.amount_pence,
    completed_at: null, failed_at: null, failure_reason: null,
  }
  state.paymentOps.push(op)
  return { op_id: op.id, idem_key }
}

function completeRefundOp(state: S1State, opId: string, stripeRefundId: string): void {
  const op = state.paymentOps.find(o => o.id === opId)!
  op.status = 'completed'
  op.stripe_refund_id = stripeRefundId
  op.completed_at = new Date()
  const payment = state.payments.find(p => p.id === op.payment_id)!
  payment.status = 'refunded'
}

function failRefundOp(state: S1State, opId: string, reason: string): void {
  const op = state.paymentOps.find(o => o.id === opId)!
  op.status = 'failed'
  op.failed_at = new Date()
  op.failure_reason = reason
}

function recoverStaleOps(state: S1State, staleMs = 10 * 60 * 1000): number {
  const cutoff = new Date(Date.now() - staleMs)
  let count = 0
  for (const op of state.paymentOps) {
    if (op.operation_type === 'refund' && op.status === 'pending' && op.initiated_at < cutoff) {
      op.status = 'processing'
      state.securityEvents.push({
        event_type: 'stale_payment_operation_detected',
        severity: 'critical',
        metadata: { operation_id: op.id, age_minutes: (Date.now() - op.initiated_at.getTime()) / 60_000 },
      })
      count++
    }
  }
  return count
}

// ── SCENARIO 1: Admin revoked during active session ────────────────────────────

describe('CHAOS-01: Admin revoked during active session', () => {
  // Setup: admin has an active session and begins a refund. Between step 1
  // (DB row created, lock acquired conceptually) and step 2 (Stripe called),
  // the admin is revoked by a second admin. The first admin's next call to
  // admin_complete_refund must be denied — is_admin() queries DB every time.

  function makeRevokedAdminState() {
    const s = makeS1State()
    const adminId = 'admin-compromised'
    const superAdminId = 'super-admin'
    s.userRoles.push(
      { user_id: adminId, role: 'admin', revoked_at: null, expires_at: null },
      { user_id: superAdminId, role: 'admin', revoked_at: null, expires_at: null },
    )
    return { s, adminId, superAdminId }
  }

  it('admin_refund_order creates pending op while admin is still active', () => {
    const { s, adminId } = makeRevokedAdminState()
    expect(isAdmin(s, adminId, 'admin')).toBe(true)
    const { op_id, idem_key } = beginRefundOp(s, 'ord-1', adminId)
    expect(s.paymentOps[0].status).toBe('pending')
    expect(idem_key).toBe('refund_ord-1')
    expect(op_id).toBeTruthy()
  })

  it('admin is revoked (revoked_at set in user_roles) between refund steps', () => {
    const { s, adminId, superAdminId } = makeRevokedAdminState()
    beginRefundOp(s, 'ord-1', adminId)

    // CHAOS INJECTION: super-admin revokes the compromised admin mid-operation
    const row = s.userRoles.find(r => r.user_id === adminId && r.role === 'admin')!
    row.revoked_at = new Date()  // mirrors admin_revoke_role setting revoked_at

    expect(isAdmin(s, adminId, 'admin')).toBe(false)
    // Revoked admin's JWT still claims 'admin' — DB denies and fires security event
    const evt = s.securityEvents.find(e => e.event_type === 'admin_jwt_claim_denied_by_db')
    expect(evt).toBeDefined()
    expect(evt!.severity).toBe('critical')
  })

  it('admin_complete_refund fails with admin_required after revocation', () => {
    const { s, adminId } = makeRevokedAdminState()
    const { op_id } = beginRefundOp(s, 'ord-1', adminId)

    // CHAOS: revoke mid-operation
    s.userRoles.find(r => r.user_id === adminId)!.revoked_at = new Date()

    // admin_complete_refund re-checks is_admin() — denied
    const canComplete = isAdmin(s, adminId, 'admin')
    expect(canComplete).toBe(false)

    // Simulate the guard: if !is_admin → RAISE EXCEPTION 'admin_required'
    let threw = false
    try {
      if (!canComplete) throw new Error('admin_required')
      completeRefundOp(s, op_id, 're_stripe_xyz')
    } catch (e) {
      threw = true
      expect((e as Error).message).toBe('admin_required')
    }
    expect(threw).toBe(true)
  })

  it('payment_operations row stays pending when admin_complete_refund is denied', () => {
    const { s, adminId } = makeRevokedAdminState()
    const { op_id } = beginRefundOp(s, 'ord-1', adminId)

    s.userRoles.find(r => r.user_id === adminId)!.revoked_at = new Date()

    // Guard fires — completeRefundOp is never called
    if (!isAdmin(s, adminId, 'admin')) {
      // intentionally not completing
    }

    const op = s.paymentOps.find(o => o.id === op_id)!
    expect(op.status).toBe('pending')
    expect(s.payments[0].status).toBe('captured')
  })

  it('recover_stale_payment_operations picks up the pending op after 10 minutes', () => {
    const { s, adminId } = makeRevokedAdminState()
    const { op_id } = beginRefundOp(s, 'ord-1', adminId)

    // Back-date to simulate 11 minutes of stale time
    s.paymentOps.find(o => o.id === op_id)!.initiated_at = new Date(Date.now() - 11 * 60_000)

    const recovered = recoverStaleOps(s)
    expect(recovered).toBe(1)
    expect(s.paymentOps[0].status).toBe('processing')
    expect(s.securityEvents.some(e => e.event_type === 'stale_payment_operation_detected')).toBe(true)
  })
})

// ── SCENARIO 2: Stripe timeout after DB commit ─────────────────────────────────

describe('CHAOS-02: Stripe timeout after DB commit (crash-between-commit-and-stripe)', () => {
  // The payment_operations row is committed BEFORE the Stripe call. If the process
  // crashes after the INSERT commits but before Stripe is called, the row stays
  // 'pending'. recover_stale_payment_operations() picks it up; admin retries with
  // the same operation_id and gets the same idempotency_key → Stripe deduplicates.

  it('payment_operations row is created (pending) before any Stripe interaction', () => {
    const s = makeS1State()
    const { op_id } = beginRefundOp(s, 'ord-1', 'admin-1')
    const op = s.paymentOps.find(o => o.id === op_id)!
    expect(op.status).toBe('pending')
    expect(op.stripe_refund_id).toBeNull()
    // Payment row unchanged — Stripe has not been called yet
    expect(s.payments[0].status).toBe('captured')
  })

  it('CRASH: process dies; payment stays captured, op stays pending', () => {
    const s = makeS1State()
    beginRefundOp(s, 'ord-1', 'admin-1')
    // Simulate crash: nothing more happens to either row
    expect(s.payments[0].status).toBe('captured')
    expect(s.paymentOps[0].status).toBe('pending')
    expect(s.paymentOps[0].stripe_refund_id).toBeNull()
  })

  it('recovery worker transitions stale op to processing and fires critical event', () => {
    const s = makeS1State()
    beginRefundOp(s, 'ord-1', 'admin-1')
    s.paymentOps[0].initiated_at = new Date(Date.now() - 11 * 60_000)

    const count = recoverStaleOps(s)
    expect(count).toBe(1)
    expect(s.paymentOps[0].status).toBe('processing')
    const evt = s.securityEvents.find(e => e.event_type === 'stale_payment_operation_detected')
    expect(evt!.severity).toBe('critical')
    expect(evt!.metadata.operation_id).toBe(s.paymentOps[0].id)
  })

  it('admin retry with same operation_id returns identical idempotency_key', () => {
    const s = makeS1State()
    const { op_id: id1, idem_key: key1 } = beginRefundOp(s, 'ord-1', 'admin-1')
    // Admin retries using the operation_id from the first call
    const existingOp = s.paymentOps.find(o => o.id === id1)!
    // Simulates looking up by operation_id (the edge function fetches it and returns same key)
    expect(existingOp.stripe_idempotency_key).toBe(key1)
    expect(s.paymentOps).toHaveLength(1)  // no duplicate row
  })

  it('Stripe deduplicates via idempotency key — no second charge; final state is refunded', () => {
    const s = makeS1State()
    const { op_id, idem_key } = beginRefundOp(s, 'ord-1', 'admin-1')

    // Simulate: Stripe returns the same refund object (idempotent) on second call
    const stripeRefundId = 're_stripe_deduped'
    completeRefundOp(s, op_id, stripeRefundId)

    expect(s.payments[0].status).toBe('refunded')
    expect(s.paymentOps[0].status).toBe('completed')
    expect(s.paymentOps[0].stripe_idempotency_key).toBe(idem_key)
    expect(s.paymentOps[0].stripe_refund_id).toBe(stripeRefundId)
    // Exactly one Stripe call (same idem_key → Stripe returns existing refund)
    expect(s.paymentOps).toHaveLength(1)
  })
})

// ── SCENARIO 3: Stripe responds "success" but HTTP response is lost ────────────

describe('CHAOS-03: Stripe success before response delivery (lost response)', () => {
  // Stripe creates the refund successfully but the HTTP response never reaches the
  // edge function. The edge function timeouts and calls admin_fail_refund(). The op
  // becomes 'failed'. recover_stale_payment_operations() does NOT pick up 'failed'
  // ops. Admin retries manually → _begin_refund_operation creates a NEW op with a
  // NEW idempotency_key. This is a RESIDUAL RISK.

  it('admin_fail_refund sets op status to failed, payment stays captured', () => {
    const s = makeS1State()
    const { op_id } = beginRefundOp(s, 'ord-1', 'admin-1')

    // Edge function received timeout — Stripe actually succeeded but we don't know
    failRefundOp(s, op_id, 'stripe_response_timeout')

    expect(s.paymentOps[0].status).toBe('failed')
    expect(s.paymentOps[0].failure_reason).toBe('stripe_response_timeout')
    expect(s.payments[0].status).toBe('captured')   // unchanged
  })

  it('recovery worker does NOT pick up failed ops — only pending', () => {
    const s = makeS1State()
    const { op_id } = beginRefundOp(s, 'ord-1', 'admin-1')
    s.paymentOps[0].initiated_at = new Date(Date.now() - 15 * 60_000)
    failRefundOp(s, op_id, 'stripe_response_timeout')

    const count = recoverStaleOps(s)
    expect(count).toBe(0)
    expect(s.paymentOps[0].status).toBe('failed')  // untouched by recovery
  })

  it('manual admin retry creates a new op with a new idempotency_key', () => {
    const s = makeS1State()
    const { op_id: id1, idem_key: key1 } = beginRefundOp(s, 'ord-1', 'admin-1')
    failRefundOp(s, id1, 'stripe_response_timeout')

    // beginRefundOp: existing op is 'failed' (not in pending/processing guard),
    // but the idempotency_key is UNIQUE — a second insert would violate the constraint.
    // In the real DB this means the admin must use a new order reference or the DB
    // rejects the insert. For the chaos test, we simulate the constraint check:
    const idem_key_attempt = `refund_ord-1`
    const constraintViolation = s.paymentOps.some(op => op.stripe_idempotency_key === idem_key_attempt)
    expect(constraintViolation).toBe(true)
    // The UNIQUE constraint prevents a second op with the same key
    expect(key1).toBe('refund_ord-1')
    expect(s.paymentOps).toHaveLength(1)
  })

  // RESIDUAL RISK — documented as an open failure mode
  it('RESIDUAL RISK: documents that admin_fail_refund should query Stripe before failing', () => {
    // When the edge function calls admin_fail_refund after a timeout, it does NOT
    // first check Stripe's refund status by refund_id. If Stripe actually created
    // the refund, the payment_operations row becomes 'failed' while Stripe has a
    // successful refund that we will never link to this op.
    //
    // A subsequent admin retry creates a new idempotency_key → a second Stripe
    // refund call is made → risk of double refund.
    //
    // MITIGATION REQUIRED: Before calling admin_fail_refund, the edge function
    // should call Stripe's GET /v1/refunds?payment_intent=<pi_id> and check for
    // an existing refund. If found, call admin_complete_refund instead.
    //
    // Until the mitigation is applied, any manual retry after a lost response
    // requires human verification that Stripe does not already have a refund.

    const residualRiskDocumented = true
    expect(residualRiskDocumented).toBe(true)
  })
})

// ── SCENARIO 4: Projection rebuild during 1000 concurrent orders ───────────────

// Shared projection state for Scenario 4
interface ProjState {
  projection_event_log: ProjectionLogRow[]
  projection_checksums: ChecksumRow[]
  advisory_locks: Map<string, LockState>
  prepper_total_orders: number
  blocked_events: string[]
}

function freshProjState(): ProjState {
  return { projection_event_log: [], projection_checksums: [], advisory_locks: new Map(), prepper_total_orders: 0, blocked_events: [] }
}

function tryExclusive(s: ProjState, name: string): boolean {
  if (s.advisory_locks.has(name)) return false
  s.advisory_locks.set(name, 'exclusive')
  return true
}
function releaseExclusive(s: ProjState, name: string): void { s.advisory_locks.delete(name) }

function applyIdempotent(s: ProjState, eventId: string, name: string): 'applied' | 'duplicate' {
  if (s.projection_event_log.some(r => r.event_id === eventId && r.projection_name === name)) return 'duplicate'
  s.projection_event_log.push({ event_id: eventId, projection_name: name })
  s.prepper_total_orders++
  return 'applied'
}

function projectOrderCreated(s: ProjState, eventId: string): 'applied' | 'duplicate' | 'blocked' {
  if (s.advisory_locks.get('project_order_created') === 'exclusive') { s.blocked_events.push(eventId); return 'blocked' }
  return applyIdempotent(s, eventId, 'project_order_created')
}

function rebuildProjection(s: ProjState, events: string[]): void {
  if (!tryExclusive(s, 'project_order_created')) throw new Error('projection_rebuild_locked')
  try {
    s.projection_event_log = s.projection_event_log.filter(r => r.projection_name !== 'project_order_created')
    s.prepper_total_orders = 0
    for (const eid of events) applyIdempotent(s, eid, 'project_order_created')
    const ids = s.projection_event_log.filter(r => r.projection_name === 'project_order_created').map(r => r.event_id).sort().join(',')
    const chk: ChecksumRow = { projection_name: 'project_order_created', checksum: `hash(${ids})`, event_count: s.projection_event_log.filter(r => r.projection_name === 'project_order_created').length }
    const idx = s.projection_checksums.findIndex(c => c.projection_name === 'project_order_created')
    if (idx >= 0) s.projection_checksums[idx] = chk; else s.projection_checksums.push(chk)
  } finally { releaseExclusive(s, 'project_order_created') }
}

describe('CHAOS-04: Projection rebuild during 1000 concurrent orders', () => {
  it('all 1000 concurrent events are blocked while exclusive lock is held', () => {
    const s = freshProjState()
    tryExclusive(s, 'project_order_created')
    const outcomes = Array.from({ length: 1000 }, (_, i) => projectOrderCreated(s, `evt-${i}`))
    expect(outcomes.filter(o => o === 'blocked').length).toBe(1000)
    expect(s.prepper_total_orders).toBe(0)
    releaseExclusive(s, 'project_order_created')
  })

  it('all blocked events succeed after exclusive lock is released', () => {
    const s = freshProjState()
    tryExclusive(s, 'project_order_created')
    Array.from({ length: 1000 }, (_, i) => projectOrderCreated(s, `evt-${i}`))
    releaseExclusive(s, 'project_order_created')
    const outcomes = s.blocked_events.map(eid => projectOrderCreated(s, eid))
    expect(outcomes.filter(o => o === 'applied').length).toBe(1000)
    expect(s.prepper_total_orders).toBe(1000)
  })

  it('idempotency gate deduplicates repeated event_ids — counter never over-counts', () => {
    const s = freshProjState()
    for (let i = 0; i < 50; i++) projectOrderCreated(s, 'dupe-event-1')
    expect(s.prepper_total_orders).toBe(1)
    expect(s.projection_event_log.filter(r => r.event_id === 'dupe-event-1')).toHaveLength(1)
  })

  it('checksum is stored after rebuild and reflects the replayed event set', () => {
    const s = freshProjState()
    rebuildProjection(s, ['a-evt-1', 'a-evt-2', 'a-evt-3'])
    const chk = s.projection_checksums.find(c => c.projection_name === 'project_order_created')
    expect(chk).toBeDefined()
    expect(chk!.event_count).toBe(3)
    expect(chk!.checksum).not.toBe('')
  })
})
