/**
 * S-22 Authorization Regression Tests
 *
 * Mock/unit style — no live DB connection required.
 * Guards the dual-check (JWT advisory + DB authoritative) contracts introduced
 * in migration 022.
 *
 * Run: npx jest tests/security/s22-authorization.test.ts
 */

import {
  freshState,
  mockIsAdmin,
  mockIsRole,
  mockAdminGrantRole,
  mockAdminRevokeRole,
  mockRoleAuditMutation,
  assertNoError,
  assertErrorContains,
  assert,
  type MockState,
} from './s22-mocks'

// ── is_admin() — DB-authoritative checks ─────────────────────────────────────

describe('is_admin(): DB-authoritative denial', () => {

  it('returns FALSE when user_roles has no row for the user', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    // JWT claims admin but there is no user_roles row at all
    const result = mockIsAdmin(state, { uid, jwtRole: 'admin' })
    assert(result === false, 'no user_roles row → denied')
  })

  it('returns FALSE after revocation (revoked_at is set)', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    state.userRoles.push({
      user_id: uid, role: 'admin',
      granted_by: uid, granted_at: new Date(),
      revoked_at: new Date(),  // already revoked
      expires_at: null,
    })
    const result = mockIsAdmin(state, { uid, jwtRole: 'admin' })
    assert(result === false, 'revoked row → denied')
  })

  it('returns FALSE after expiry (expires_at is in the past)', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    const pastDate = new Date(Date.now() - 1000)
    state.userRoles.push({
      user_id: uid, role: 'admin',
      granted_by: uid, granted_at: new Date(),
      revoked_at: null,
      expires_at: pastDate,   // expired
    })
    const result = mockIsAdmin(state, { uid, jwtRole: 'admin' })
    assert(result === false, 'expired row → denied')
  })

  it('returns TRUE when an active admin row exists', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    const futureDate = new Date(Date.now() + 3_600_000)
    state.userRoles.push({
      user_id: uid, role: 'admin',
      granted_by: uid, granted_at: new Date(),
      revoked_at: null,
      expires_at: futureDate,
    })
    const result = mockIsAdmin(state, { uid, jwtRole: 'admin' })
    assert(result === true, 'active non-expired row → granted')
  })

  it('returns TRUE when active row has no expiry (indefinite grant)', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    state.userRoles.push({
      user_id: uid, role: 'admin',
      granted_by: uid, granted_at: new Date(),
      revoked_at: null, expires_at: null,
    })
    const result = mockIsAdmin(state, { uid, jwtRole: null })
    assert(result === true, 'indefinite active row → granted')
  })

  it('returns FALSE when uid is NULL (unauthenticated call)', () => {
    const state = freshState()
    const result = mockIsAdmin(state, { uid: null, jwtRole: 'admin' })
    assert(result === false, 'null uid → denied immediately')
  })
})

// ── Security event on JWT/DB divergence ──────────────────────────────────────

describe('is_admin(): security event when JWT says admin but DB denies', () => {

  it('emits admin_jwt_claim_denied_by_db when JWT=admin but no DB row', () => {
    const state = freshState()
    const uid = crypto.randomUUID()

    mockIsAdmin(state, { uid, jwtRole: 'admin' })

    const event = state.securityEvents.find(
      (e) => e.event_type === 'admin_jwt_claim_denied_by_db' && e.actor_id === uid,
    )
    assert(event !== undefined, 'security event must be emitted')
    assert(event!.severity === 'critical', 'severity must be critical')
    assert(event!.metadata['db_authorized'] === false, 'db_authorized must be false in payload')
  })

  it('does NOT emit the security event when JWT has no admin claim', () => {
    const state = freshState()
    const uid = crypto.randomUUID()

    // JWT has no role at all — normal non-admin user, no anomaly to report
    mockIsAdmin(state, { uid, jwtRole: null })

    const event = state.securityEvents.find((e) => e.event_type === 'admin_jwt_claim_denied_by_db')
    assert(event === undefined, 'no event when JWT makes no admin claim')
  })

  it('does NOT emit the security event when the DB grants access', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    state.userRoles.push({
      user_id: uid, role: 'admin', granted_by: uid,
      granted_at: new Date(), revoked_at: null, expires_at: null,
    })

    mockIsAdmin(state, { uid, jwtRole: 'admin' })

    const event = state.securityEvents.find((e) => e.event_type === 'admin_jwt_claim_denied_by_db')
    assert(event === undefined, 'no event when DB and JWT agree')
  })
})

// ── admin_grant_role ──────────────────────────────────────────────────────────

describe('admin_grant_role()', () => {

  it('inserts a user_roles row and a role_audit row on success', () => {
    const state = freshState()
    const granterId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    // Make granter an admin
    state.userRoles.push({
      user_id: granterId, role: 'admin', granted_by: granterId,
      granted_at: new Date(), revoked_at: null, expires_at: null,
    })

    const result = mockAdminGrantRole(state, {
      callerUid: granterId,
      p_user_id: targetId,
      p_role: 'finance',
      p_reason: 'assigned to finance team',
    })

    assertNoError(result, 'grant succeeds')
    assert(result.data !== null, 'returns audit id')

    const roleRow = state.userRoles.find((r) => r.user_id === targetId && r.role === 'finance')
    assert(roleRow !== undefined, 'user_roles row created')
    assert(roleRow!.revoked_at === null, 'not revoked')

    const auditRow = state.roleAudit.find((a) => a.user_id === targetId && a.action === 'granted')
    assert(auditRow !== undefined, 'role_audit row created')
    assert(auditRow!.role === 'finance', 'correct role in audit')
  })

  it('emits a domain event on grant', () => {
    const state = freshState()
    const granterId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    state.userRoles.push({
      user_id: granterId, role: 'admin', granted_by: granterId,
      granted_at: new Date(), revoked_at: null, expires_at: null,
    })

    mockAdminGrantRole(state, {
      callerUid: granterId, p_user_id: targetId,
      p_role: 'support', p_reason: 'new hire',
    })

    const evt = state.domainEvents.find((e) => e.event_type === 'role.granted')
    assert(evt !== undefined, 'domain event emitted')
    assert(evt!.aggregate_id === targetId, 'aggregate_id is target user')
  })

  it('emits a warn security_event on grant', () => {
    const state = freshState()
    const granterId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    state.userRoles.push({
      user_id: granterId, role: 'admin', granted_by: granterId,
      granted_at: new Date(), revoked_at: null, expires_at: null,
    })

    mockAdminGrantRole(state, {
      callerUid: granterId, p_user_id: targetId,
      p_role: 'moderator', p_reason: 'community trust',
    })

    const evt = state.securityEvents.find((e) => e.event_type === 'role_granted')
    assert(evt !== undefined, 'security event emitted')
    assert(evt!.severity === 'warn', 'severity is warn')
  })

  it('reactivates a previously revoked row on re-grant (upsert)', () => {
    const state = freshState()
    const granterId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    state.userRoles.push({
      user_id: granterId, role: 'admin', granted_by: granterId,
      granted_at: new Date(), revoked_at: null, expires_at: null,
    })
    // Pre-existing revoked row
    state.userRoles.push({
      user_id: targetId, role: 'finance', granted_by: granterId,
      granted_at: new Date(Date.now() - 86_400_000), revoked_at: new Date(), expires_at: null,
    })

    mockAdminGrantRole(state, {
      callerUid: granterId, p_user_id: targetId,
      p_role: 'finance', p_reason: 'reinstated',
    })

    const rows = state.userRoles.filter((r) => r.user_id === targetId && r.role === 'finance')
    assert(rows.length === 1, 'no duplicate row — upsert reactivated')
    assert(rows[0].revoked_at === null, 'revoked_at cleared')
  })

  it('rejects a non-admin caller', () => {
    const state = freshState()
    const result = mockAdminGrantRole(state, {
      callerUid: crypto.randomUUID(), isAdmin: false,
      p_user_id: crypto.randomUUID(), p_role: 'admin', p_reason: 'self-escalation',
    })
    assertErrorContains(result, 'admin_required', 'non-admin grant')
  })

  it('rejects an unknown role string', () => {
    const state = freshState()
    const granterId = crypto.randomUUID()
    state.userRoles.push({
      user_id: granterId, role: 'admin', granted_by: granterId,
      granted_at: new Date(), revoked_at: null, expires_at: null,
    })

    const result = mockAdminGrantRole(state, {
      callerUid: granterId, p_user_id: crypto.randomUUID(),
      p_role: 'superuser', p_reason: 'test',
    })
    assertErrorContains(result, 'invalid_role', 'unknown role')
  })

  it('rejects an empty reason', () => {
    const state = freshState()
    const granterId = crypto.randomUUID()
    state.userRoles.push({
      user_id: granterId, role: 'admin', granted_by: granterId,
      granted_at: new Date(), revoked_at: null, expires_at: null,
    })

    const result = mockAdminGrantRole(state, {
      callerUid: granterId, p_user_id: crypto.randomUUID(),
      p_role: 'support', p_reason: '',
    })
    assertErrorContains(result, 'reason_required', 'empty reason')
  })
})

// ── admin_revoke_role ─────────────────────────────────────────────────────────

describe('admin_revoke_role()', () => {

  it('sets revoked_at and writes a role_audit row on success', () => {
    const state = freshState()
    const adminId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    state.userRoles.push(
      { user_id: adminId, role: 'admin', granted_by: adminId, granted_at: new Date(), revoked_at: null, expires_at: null },
      { user_id: targetId, role: 'support', granted_by: adminId, granted_at: new Date(), revoked_at: null, expires_at: null },
    )

    const result = mockAdminRevokeRole(state, {
      callerUid: adminId, p_user_id: targetId,
      p_role: 'support', p_reason: 'contract ended',
    })

    assertNoError(result, 'revoke succeeds')
    const roleRow = state.userRoles.find((r) => r.user_id === targetId && r.role === 'support')
    assert(roleRow!.revoked_at !== null, 'revoked_at is set')

    const auditRow = state.roleAudit.find((a) => a.user_id === targetId && a.action === 'revoked')
    assert(auditRow !== undefined, 'role_audit row created')
  })

  it('emits a critical security_event on revocation', () => {
    const state = freshState()
    const adminId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    state.userRoles.push(
      { user_id: adminId, role: 'admin', granted_by: adminId, granted_at: new Date(), revoked_at: null, expires_at: null },
      { user_id: targetId, role: 'admin', granted_by: adminId, granted_at: new Date(), revoked_at: null, expires_at: null },
    )

    mockAdminRevokeRole(state, {
      callerUid: adminId, p_user_id: targetId,
      p_role: 'admin', p_reason: 'terminated',
    })

    const evt = state.securityEvents.find((e) => e.event_type === 'role_revoked')
    assert(evt !== undefined, 'security event emitted')
    assert(evt!.severity === 'critical', 'revocation severity is critical')
  })

  it('emits a domain event role.revoked', () => {
    const state = freshState()
    const adminId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    state.userRoles.push(
      { user_id: adminId, role: 'admin', granted_by: adminId, granted_at: new Date(), revoked_at: null, expires_at: null },
      { user_id: targetId, role: 'finance', granted_by: adminId, granted_at: new Date(), revoked_at: null, expires_at: null },
    )

    mockAdminRevokeRole(state, {
      callerUid: adminId, p_user_id: targetId,
      p_role: 'finance', p_reason: 'role reassignment',
    })

    const evt = state.domainEvents.find((e) => e.event_type === 'role.revoked')
    assert(evt !== undefined, 'domain event emitted')
  })

  it('throws role_not_active when revoking an already-revoked role', () => {
    const state = freshState()
    const adminId = crypto.randomUUID()
    const targetId = crypto.randomUUID()
    state.userRoles.push(
      { user_id: adminId, role: 'admin', granted_by: adminId, granted_at: new Date(), revoked_at: null, expires_at: null },
      { user_id: targetId, role: 'support', granted_by: adminId, granted_at: new Date(), revoked_at: new Date(), expires_at: null },
    )

    const result = mockAdminRevokeRole(state, {
      callerUid: adminId, p_user_id: targetId,
      p_role: 'support', p_reason: 'double revoke',
    })
    assertErrorContains(result, 'role_not_active', 'double revoke')
  })

  it('rejects a non-admin caller', () => {
    const state = freshState()
    const result = mockAdminRevokeRole(state, {
      callerUid: crypto.randomUUID(), isAdmin: false,
      p_user_id: crypto.randomUUID(), p_role: 'support', p_reason: 'test',
    })
    assertErrorContains(result, 'admin_required', 'non-admin revoke')
  })
})

// ── role_audit append-only enforcement ───────────────────────────────────────

describe('role_audit: append-only', () => {

  it('blocks UPDATE on role_audit (block_audit_mutation trigger)', () => {
    const result = mockRoleAuditMutation('UPDATE')
    assertErrorContains(result, 'append_only_table', 'UPDATE blocked')
  })

  it('blocks DELETE on role_audit (block_audit_mutation trigger)', () => {
    const result = mockRoleAuditMutation('DELETE')
    assertErrorContains(result, 'append_only_table', 'DELETE blocked')
  })
})

// ── is_role() generic role check ─────────────────────────────────────────────

describe('is_role()', () => {

  it('returns TRUE only when the user has an active finance role', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    state.userRoles.push({
      user_id: uid, role: 'finance', granted_by: uid,
      granted_at: new Date(), revoked_at: null, expires_at: null,
    })
    assert(mockIsRole(state, { uid, role: 'finance', jwtRole: 'finance' }) === true, 'active finance → TRUE')
  })

  it('returns FALSE when the role row is for a different role', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    state.userRoles.push({
      user_id: uid, role: 'support', granted_by: uid,
      granted_at: new Date(), revoked_at: null, expires_at: null,
    })
    assert(mockIsRole(state, { uid, role: 'finance', jwtRole: null }) === false, 'wrong role → FALSE')
  })

  it('returns FALSE when the finance role is revoked', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    state.userRoles.push({
      user_id: uid, role: 'finance', granted_by: uid,
      granted_at: new Date(), revoked_at: new Date(), expires_at: null,
    })
    assert(mockIsRole(state, { uid, role: 'finance', jwtRole: 'finance' }) === false, 'revoked → FALSE')
  })

  it('emits role_jwt_claim_denied_by_db at warn severity when JWT/DB diverge', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    // JWT claims finance but no DB row
    mockIsRole(state, { uid, role: 'finance', jwtRole: 'finance' })

    const evt = state.securityEvents.find((e) => e.event_type === 'role_jwt_claim_denied_by_db')
    assert(evt !== undefined, 'security event emitted')
    assert(evt!.severity === 'warn', 'severity is warn for non-admin roles')
    assert(evt!.metadata['requested_role'] === 'finance', 'role captured in payload')
  })
})
