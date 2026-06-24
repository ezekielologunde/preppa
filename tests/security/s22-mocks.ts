/**
 * Mock infrastructure for S-22 authorization regression tests.
 * Pure in-memory simulation of the DB guard logic in migration 022.
 * No live DB connection required.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RpcResult<T = unknown> {
  data: T | null
  error: { message: string; code?: string } | null
}

export interface UserRoleRow {
  user_id: string
  role: string
  granted_by: string
  granted_at: Date
  revoked_at: Date | null
  expires_at: Date | null
}

export interface RoleAuditRow {
  id: string
  user_id: string
  role: string
  action: string
  performed_by: string | null
  reason: string
  metadata: Record<string, unknown>
}

export interface SecurityEventRow {
  id: string
  event_type: string
  actor_id: string | null
  target_id: string | null
  severity: string
  metadata: Record<string, unknown>
}

export interface DomainEventRow {
  id: string
  event_type: string
  aggregate_type: string
  aggregate_id: string
  actor_id: string | null
  payload: Record<string, unknown>
}

export interface AdminActionLogRow {
  id: string
  action_type: string
  target_type: string
  target_id: string | null
  reason: string
  metadata: Record<string, unknown>
}

export interface MockState {
  userRoles: UserRoleRow[]
  roleAudit: RoleAuditRow[]
  securityEvents: SecurityEventRow[]
  domainEvents: DomainEventRow[]
  adminActionLog: AdminActionLogRow[]
}

export function freshState(): MockState {
  return {
    userRoles: [],
    roleAudit: [],
    securityEvents: [],
    domainEvents: [],
    adminActionLog: [],
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_ROLES = ['admin', 'support', 'moderator', 'finance', 'operations', 'security'] as const

function hasActiveRole(state: MockState, uid: string, role: string): boolean {
  const now = new Date()
  return state.userRoles.some(
    (r) =>
      r.user_id === uid &&
      r.role === role &&
      r.revoked_at === null &&
      (r.expires_at === null || r.expires_at > now),
  )
}

function emitSecurityEvent(
  state: MockState,
  eventType: string,
  actorId: string | null,
  targetId: string | null,
  severity: string,
  metadata: Record<string, unknown>,
): void {
  state.securityEvents.push({
    id: crypto.randomUUID(),
    event_type: eventType,
    actor_id: actorId,
    target_id: targetId,
    severity,
    metadata,
  })
}

// ── mockIsAdmin ───────────────────────────────────────────────────────────────
// Simulates is_admin(): JWT advisory, DB authoritative.

export function mockIsAdmin(
  state: MockState,
  opts: { uid: string | null; jwtRole: string | null },
): boolean {
  const { uid, jwtRole } = opts

  if (!uid) return false

  const dbGrant = hasActiveRole(state, uid, 'admin')

  if (!dbGrant) {
    // JWT claimed admin but DB denied — this is the revocation signal
    if (jwtRole === 'admin') {
      emitSecurityEvent(state, 'admin_jwt_claim_denied_by_db', uid, null, 'critical', {
        jwt_claim: jwtRole,
        db_authorized: false,
      })
    }
    return false
  }

  return true
}

// ── mockIsRole ────────────────────────────────────────────────────────────────
// Simulates is_role(p_role): same dual-check pattern for any role.

export function mockIsRole(
  state: MockState,
  opts: { uid: string | null; role: string; jwtRole: string | null },
): boolean {
  const { uid, role, jwtRole } = opts

  if (!uid) return false

  const dbGrant = hasActiveRole(state, uid, role)

  if (!dbGrant) {
    if (jwtRole === role) {
      emitSecurityEvent(state, 'role_jwt_claim_denied_by_db', uid, null, 'warn', {
        jwt_claim: jwtRole,
        requested_role: role,
        db_authorized: false,
      })
    }
    return false
  }

  return true
}

// ── mockAdminGrantRole ────────────────────────────────────────────────────────

export function mockAdminGrantRole(
  state: MockState,
  opts: {
    callerUid: string
    isAdmin?: boolean
    p_user_id: string
    p_role: string
    p_reason: string
    p_expires_at?: Date | null
  },
): RpcResult<string> {
  const { callerUid, p_user_id, p_role, p_reason, p_expires_at = null } = opts
  const isAdmin = opts.isAdmin !== undefined ? opts.isAdmin : hasActiveRole(state, callerUid, 'admin')

  if (!isAdmin) return err('admin_required')
  if (!VALID_ROLES.includes(p_role as typeof VALID_ROLES[number])) {
    return err(`invalid_role: ${p_role} — must be one of ${VALID_ROLES.join(', ')}`)
  }
  if (!p_reason || p_reason.trim() === '') return err('reason_required')

  // Upsert: find existing row (revoked or active) for this user+role
  const existing = state.userRoles.find((r) => r.user_id === p_user_id && r.role === p_role)
  if (existing) {
    existing.granted_by = callerUid
    existing.granted_at = new Date()
    existing.revoked_at = null
    existing.expires_at = p_expires_at
  } else {
    state.userRoles.push({
      user_id: p_user_id, role: p_role,
      granted_by: callerUid, granted_at: new Date(),
      revoked_at: null, expires_at: p_expires_at,
    })
  }

  const auditId = crypto.randomUUID()
  state.roleAudit.push({
    id: auditId, user_id: p_user_id, role: p_role,
    action: 'granted', performed_by: callerUid,
    reason: p_reason,
    metadata: { expires_at: p_expires_at, granted_by: callerUid },
  })

  state.domainEvents.push({
    id: crypto.randomUUID(),
    event_type: 'role.granted',
    aggregate_type: 'user',
    aggregate_id: p_user_id,
    actor_id: callerUid,
    payload: { role: p_role, reason: p_reason, expires_at: p_expires_at, audit_id: auditId },
  })

  emitSecurityEvent(state, 'role_granted', callerUid, p_user_id, 'warn', {
    role: p_role, reason: p_reason, target_user: p_user_id,
  })

  state.adminActionLog.push({
    id: crypto.randomUUID(), action_type: 'grant_role',
    target_type: 'user', target_id: p_user_id, reason: p_reason,
    metadata: { role: p_role, expires_at: p_expires_at },
  })

  return ok(auditId)
}

// ── mockAdminRevokeRole ───────────────────────────────────────────────────────

export function mockAdminRevokeRole(
  state: MockState,
  opts: {
    callerUid: string
    isAdmin?: boolean
    p_user_id: string
    p_role: string
    p_reason: string
  },
): RpcResult<string> {
  const { callerUid, p_user_id, p_role, p_reason } = opts
  const isAdmin = opts.isAdmin !== undefined ? opts.isAdmin : hasActiveRole(state, callerUid, 'admin')

  if (!isAdmin) return err('admin_required')
  if (!p_reason || p_reason.trim() === '') return err('reason_required')

  const row = state.userRoles.find(
    (r) => r.user_id === p_user_id && r.role === p_role && r.revoked_at === null,
  )
  if (!row) {
    return err(`role_not_active: user ${p_user_id} does not hold active role ${p_role}`)
  }

  row.revoked_at = new Date()

  const auditId = crypto.randomUUID()
  state.roleAudit.push({
    id: auditId, user_id: p_user_id, role: p_role,
    action: 'revoked', performed_by: callerUid,
    reason: p_reason,
    metadata: { revoked_by: callerUid },
  })

  state.domainEvents.push({
    id: crypto.randomUUID(),
    event_type: 'role.revoked',
    aggregate_type: 'user',
    aggregate_id: p_user_id,
    actor_id: callerUid,
    payload: { role: p_role, reason: p_reason, audit_id: auditId },
  })

  emitSecurityEvent(state, 'role_revoked', callerUid, p_user_id, 'critical', {
    role: p_role, reason: p_reason, target_user: p_user_id,
  })

  state.adminActionLog.push({
    id: crypto.randomUUID(), action_type: 'revoke_role',
    target_type: 'user', target_id: p_user_id, reason: p_reason,
    metadata: { role: p_role, revoked_by: callerUid },
  })

  return ok(auditId)
}

// ── mockRoleAuditMutation ─────────────────────────────────────────────────────
// Simulates the block_audit_mutation trigger on role_audit.

export function mockRoleAuditMutation(op: 'UPDATE' | 'DELETE'): RpcResult<never> {
  return err(`append_only_table: ${op} on role_audit is blocked`)
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

export function assertNoError(result: RpcResult<unknown>, label: string): void {
  if (result.error) {
    throw new Error(`[${label}] unexpected error: ${result.error.message}`)
  }
}

export function assertErrorContains(result: RpcResult<unknown>, substring: string, label: string): void {
  if (!result.error) {
    throw new Error(`[${label}] expected an error containing "${substring}" but got success`)
  }
  if (!result.error.message.includes(substring)) {
    throw new Error(
      `[${label}] expected error to contain "${substring}" but got: "${result.error.message}"`,
    )
  }
}

export function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`Assertion failed: ${label}`)
}

// ── Result constructors ───────────────────────────────────────────────────────

function ok<T>(data: T): RpcResult<T> {
  return { data, error: null }
}

function err(message: string): RpcResult<never> {
  return { data: null, error: { message } }
}
