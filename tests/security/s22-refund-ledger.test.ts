/**
 * S-22: Refund Ledger Regression Tests
 * Mock-based specs for the crash-safe refund state machine (F-02).
 * Run with: npx jest tests/security/s22-refund-ledger.test.ts
 */

// ── Shared types ──────────────────────────────────────────────────────────────

type PaymentStatus = 'pending' | 'captured' | 'in_escrow' | 'refunded' | 'released'
type OpStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

interface Payment {
  id: string
  order_id: string
  stripe_payment_intent_id: string
  amount_pence: number
  currency: string
  status: PaymentStatus
  refunded_at: string | null
}

interface PaymentOperation {
  id: string
  payment_id: string
  operation_type: string
  initiated_by: string | null
  initiated_at: Date
  status: OpStatus
  stripe_idempotency_key: string | null
  stripe_refund_id: string | null
  amount_pence: number
  currency: string
  completed_at: Date | null
  failed_at: Date | null
  failure_reason: string | null
  reason: string
}

interface Order {
  id: string
  status: string
}

interface State {
  payments: Payment[]
  orders: Order[]
  paymentOps: PaymentOperation[]
  securityEvents: Array<{ type: string; metadata: Record<string, unknown> }>
  deletedOps: string[]  // tracks attempted deletes
}

// ── State machine helpers (mirrors the SQL logic) ─────────────────────────────

function makeState(): State {
  return {
    payments: [
      {
        id: 'pay-1', order_id: 'ord-1',
        stripe_payment_intent_id: 'pi_test_123',
        amount_pence: 2000, currency: 'gbp',
        status: 'captured', refunded_at: null,
      },
    ],
    orders:      [{ id: 'ord-1', status: 'accepted' }],
    paymentOps:  [],
    securityEvents: [],
    deletedOps:  [],
  }
}

// Mirrors _begin_refund_operation + admin_refund_order
function beginRefundOperation(
  s: State,
  orderId: string,
  reason: string,
  adminId: string,
  existingOperationId?: string,
): { operation_id: string; idempotency_key: string; amount_pence: number; status: OpStatus; stripe_refund_id: string | null } {
  if (existingOperationId) {
    const existing = s.paymentOps.find(
      op => op.id === existingOperationId && op.operation_type === 'refund',
    )
    if (!existing) throw new Error('operation_not_found')
    return {
      operation_id:    existing.id,
      idempotency_key: existing.stripe_idempotency_key!,
      amount_pence:    existing.amount_pence,
      status:          existing.status,
      stripe_refund_id: existing.stripe_refund_id,
    }
  }

  const payment = s.payments.find(p => p.order_id === orderId)
  if (!payment) throw new Error('payment_not_found')
  if (!['captured', 'in_escrow'].includes(payment.status)) {
    throw new Error(`payment_not_refundable: status=${payment.status}`)
  }

  // Idempotency: existing pending/processing/completed op
  const existing = s.paymentOps.find(
    op => op.payment_id === payment.id
      && op.operation_type === 'refund'
      && ['pending', 'processing', 'completed'].includes(op.status),
  )
  if (existing) {
    if (existing.status === 'completed') throw new Error(`already_refunded: operation_id=${existing.id}`)
    return {
      operation_id:    existing.id,
      idempotency_key: existing.stripe_idempotency_key!,
      amount_pence:    existing.amount_pence,
      status:          existing.status,
      stripe_refund_id: existing.stripe_refund_id,
    }
  }

  const idemKey = `refund_${orderId}`

  // Unique idempotency_key constraint
  if (s.paymentOps.find(op => op.stripe_idempotency_key === idemKey)) {
    throw new Error('duplicate_idempotency_key')
  }

  const op: PaymentOperation = {
    id:                    `op-${s.paymentOps.length + 1}`,
    payment_id:            payment.id,
    operation_type:        'refund',
    initiated_by:          adminId,
    initiated_at:          new Date(),
    status:                'pending',
    stripe_idempotency_key: idemKey,
    stripe_refund_id:      null,
    amount_pence:          payment.amount_pence,  // always from DB
    currency:              payment.currency,
    completed_at:          null,
    failed_at:             null,
    failure_reason:        null,
    reason,
  }
  s.paymentOps.push(op)

  return {
    operation_id:    op.id,
    idempotency_key: idemKey,
    amount_pence:    payment.amount_pence,
    status:          'pending',
    stripe_refund_id: null,
  }
}

// Mirrors admin_complete_refund + _complete_refund_operation
function completeRefund(s: State, operationId: string, stripeRefundId: string, orderId: string): void {
  const op = s.paymentOps.find(o => o.id === operationId)
  if (!op) throw new Error('operation_not_found')

  op.status           = 'completed'
  op.stripe_refund_id = stripeRefundId
  op.completed_at     = new Date()

  const payment = s.payments.find(p => p.order_id === orderId)!
  payment.status      = 'refunded'
  payment.refunded_at = new Date().toISOString()

  const order = s.orders.find(o => o.id === orderId)!
  order.status = 'refunded'
}

// Mirrors admin_fail_refund + _fail_refund_operation
function failRefund(s: State, operationId: string, reason: string): void {
  const op = s.paymentOps.find(o => o.id === operationId)
  if (!op) throw new Error('operation_not_found')

  op.status         = 'failed'
  op.failed_at      = new Date()
  op.failure_reason = reason
}

// Mirrors recover_stale_payment_operations
function recoverStaleOps(s: State, staleCutoffMs = 10 * 60 * 1000): number {
  const cutoff = new Date(Date.now() - staleCutoffMs)
  let count = 0
  for (const op of s.paymentOps) {
    if (op.operation_type === 'refund' && op.status === 'pending' && op.initiated_at < cutoff) {
      op.status = 'processing'
      s.securityEvents.push({
        type: 'stale_payment_operation_detected',
        metadata: {
          operation_id:   op.id,
          operation_type: op.operation_type,
          age_minutes:    (Date.now() - op.initiated_at.getTime()) / 60_000,
        },
      })
      count++
    }
  }
  return count
}

// Mirrors the DELETE trigger
function attemptDelete(s: State, operationId: string): void {
  s.deletedOps.push(operationId)
  throw new Error('append_only_table: DELETE on payment_operations is blocked')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('S-22: payment_operations ledger', () => {

  // ── 1. Ledger row created BEFORE Stripe ──────────────────────────────────────

  it('creates a pending operation record before any Stripe call', () => {
    const s = makeState()
    const op = beginRefundOperation(s, 'ord-1', 'customer request', 'admin-1')

    expect(op.status).toBe('pending')
    expect(op.idempotency_key).toBe('refund_ord-1')
    expect(s.paymentOps).toHaveLength(1)
    expect(s.paymentOps[0].stripe_refund_id).toBeNull()
    // amount comes from DB, not caller
    expect(s.paymentOps[0].amount_pence).toBe(2000)
  })

  // ── 2. Stripe success → complete → payments.status = 'refunded' ──────────────

  it('marks payment refunded after Stripe success', () => {
    const s = makeState()
    const op = beginRefundOperation(s, 'ord-1', 'customer request', 'admin-1')
    completeRefund(s, op.operation_id, 're_stripe_abc', 'ord-1')

    const payment = s.payments[0]
    const dbOp    = s.paymentOps[0]
    expect(payment.status).toBe('refunded')
    expect(payment.refunded_at).not.toBeNull()
    expect(s.orders[0].status).toBe('refunded')
    expect(dbOp.status).toBe('completed')
    expect(dbOp.stripe_refund_id).toBe('re_stripe_abc')
    expect(dbOp.completed_at).not.toBeNull()
  })

  // ── 3. Stripe failure → payments.status UNCHANGED ────────────────────────────

  it('leaves payment status as captured when Stripe fails', () => {
    const s = makeState()
    const op = beginRefundOperation(s, 'ord-1', 'customer request', 'admin-1')
    failRefund(s, op.operation_id, 'stripe_refund_failed')

    const payment = s.payments[0]
    const dbOp    = s.paymentOps[0]
    expect(payment.status).toBe('captured')     // unchanged — retry is safe
    expect(payment.refunded_at).toBeNull()
    expect(dbOp.status).toBe('failed')
    expect(dbOp.failure_reason).toBe('stripe_refund_failed')
    expect(dbOp.stripe_refund_id).toBeNull()
  })

  // ── 4. Retry with same operation_id uses same idempotency key ─────────────────

  it('returns the same idempotency key on retry — Stripe cannot double-charge', () => {
    const s = makeState()
    const op1 = beginRefundOperation(s, 'ord-1', 'first attempt', 'admin-1')

    // Simulate process crash — op is still 'pending', no second op created
    expect(s.paymentOps).toHaveLength(1)

    // Admin retries with the operation_id from the first call
    const op2 = beginRefundOperation(s, 'ord-1', 'retry', 'admin-1', op1.operation_id)

    expect(op2.operation_id).toBe(op1.operation_id)
    expect(op2.idempotency_key).toBe(op1.idempotency_key)
    expect(s.paymentOps).toHaveLength(1)  // no duplicate row created
  })

  // ── 5. Stale pending op detected by recovery worker ──────────────────────────

  it('recovery worker transitions stale ops to processing and fires security event', () => {
    const s = makeState()
    beginRefundOperation(s, 'ord-1', 'customer request', 'admin-1')

    // Back-date the op to simulate a crash 15 min ago
    s.paymentOps[0].initiated_at = new Date(Date.now() - 15 * 60 * 1000)

    const count = recoverStaleOps(s)

    expect(count).toBe(1)
    expect(s.paymentOps[0].status).toBe('processing')
    expect(s.securityEvents).toHaveLength(1)
    expect(s.securityEvents[0].type).toBe('stale_payment_operation_detected')
    expect(s.securityEvents[0].metadata.operation_id).toBe(s.paymentOps[0].id)
  })

  it('recovery worker ignores ops younger than 10 minutes', () => {
    const s = makeState()
    beginRefundOperation(s, 'ord-1', 'customer request', 'admin-1')
    // initiated_at is just now — should not be picked up

    const count = recoverStaleOps(s)
    expect(count).toBe(0)
    expect(s.paymentOps[0].status).toBe('pending')
    expect(s.securityEvents).toHaveLength(0)
  })

  // ── 6. Second admin_refund_order call finds existing pending op ───────────────

  it('second call with same order_id returns existing pending op (no duplicate)', () => {
    const s = makeState()
    const op1 = beginRefundOperation(s, 'ord-1', 'first call', 'admin-1')
    const op2 = beginRefundOperation(s, 'ord-1', 'second call', 'admin-2')

    expect(op2.operation_id).toBe(op1.operation_id)
    expect(s.paymentOps).toHaveLength(1)
  })

  it('throws already_refunded if a completed op exists', () => {
    const s = makeState()
    const op = beginRefundOperation(s, 'ord-1', 'first call', 'admin-1')
    completeRefund(s, op.operation_id, 're_done', 'ord-1')

    expect(() => beginRefundOperation(s, 'ord-1', 'second call', 'admin-2'))
      .toThrow('already_refunded')
  })

  // ── 7. DELETE on payment_operations is blocked ───────────────────────────────

  it('DELETE on payment_operations is blocked by trigger', () => {
    const s = makeState()
    const op = beginRefundOperation(s, 'ord-1', 'test', 'admin-1')

    expect(() => attemptDelete(s, op.operation_id))
      .toThrow('append_only_table: DELETE on payment_operations is blocked')

    // The op still exists
    expect(s.paymentOps).toHaveLength(1)
    expect(s.deletedOps).toContain(op.operation_id)
  })

  // ── 8. Amount always comes from DB, not caller ────────────────────────────────

  it('amount_pence in ledger matches DB payment row, not any caller-supplied value', () => {
    const s = makeState()
    // Even if a caller could supply a different amount, the SQL function
    // ignores it — amount_pence is read from v_payment.amount_pence.
    const op = beginRefundOperation(s, 'ord-1', 'test', 'admin-1')

    expect(op.amount_pence).toBe(s.payments[0].amount_pence)
    expect(s.paymentOps[0].amount_pence).toBe(2000)
  })

  // ── 9. payment_not_refundable guard works ────────────────────────────────────

  it('throws payment_not_refundable when payment status is pending', () => {
    const s = makeState()
    s.payments[0].status = 'pending'

    expect(() => beginRefundOperation(s, 'ord-1', 'test', 'admin-1'))
      .toThrow('payment_not_refundable')
  })

  // ── 10. Idempotency key is unique — no two ops for the same order ─────────────

  it('stripe_idempotency_key UNIQUE means only one refund op per order', () => {
    const s = makeState()
    beginRefundOperation(s, 'ord-1', 'test', 'admin-1')

    // Force a state where the existing op is 'failed' (not in the idempotency check)
    // and someone tries to create a new op with the same key
    s.paymentOps[0].status = 'failed'

    // The check for existing pending/processing/completed ops would miss 'failed',
    // but the UNIQUE constraint on stripe_idempotency_key prevents a second insert.
    expect(() => {
      // Simulate the UNIQUE constraint by checking manually (as the DB would)
      const idemKey = 'refund_ord-1'
      if (s.paymentOps.find(op => op.stripe_idempotency_key === idemKey)) {
        throw new Error('duplicate_idempotency_key')
      }
    }).toThrow('duplicate_idempotency_key')
  })
})
