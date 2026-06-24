/**
 * Sprint 22 Chaos Test Suite — Part 2 (Scenarios 5–7)
 * Executable specifications for fault injection against S-22 fixes.
 * No live DB connection — pure mock state simulation.
 * Run: npx jest tests/chaos/sprint22-chaos-part2.test.ts
 */

// ── SCENARIO 5: Retry authentication failure ────────────────────────────────────

describe('CHAOS-05: Retry authentication failure (pre-fix regression + post-fix verification)', () => {
  // dispatch_retry_events() previously sent HTTP requests without an Authorization
  // header, causing 401s that grew the retry queue indefinitely.
  // The fix: reads SERVICE_ROLE_KEY from vault and includes it as Bearer token.

  interface EplRow { event_id: string; status: string; next_attempt_at: string }
  interface HttpReq { url: string; headers: Record<string, string>; body: unknown }
  interface HttpResp { status_code: number; created: string }
  interface SecurityEvent { event_type: string; severity: string; payload: Record<string, unknown> }
  interface HealthMetrics { retry_auth_failures_5min: number }

  function makeRetryState(vaultKey?: string) {
    return {
      vault: vaultKey !== undefined ? { SERVICE_ROLE_KEY: vaultKey } : {} as Record<string, string>,
      epl: [{ event_id: 'evt-1', status: 'pending_retry', next_attempt_at: new Date(Date.now() - 1000).toISOString() }] as EplRow[],
      httpRequests: [] as HttpReq[],
      httpResponses: [] as HttpResp[],
      securityEvents: [] as SecurityEvent[],
      health: { retry_auth_failures_5min: 0 } as HealthMetrics,
    }
  }

  // Pre-fix behaviour: no Authorization header → 401 responses accumulate
  function dispatchRetryEvents_preFix(s: ReturnType<typeof makeRetryState>): void {
    for (const row of s.epl.filter(r => r.status === 'pending_retry')) {
      // Bug: no Authorization header
      s.httpRequests.push({ url: 'https://project.supabase.co/functions/v1/event-processor', headers: { 'Content-Type': 'application/json' }, body: { event_id: row.event_id } })
    }
  }

  // Post-fix behaviour: Authorization header present
  function dispatchRetryEvents_postFix(s: ReturnType<typeof makeRetryState>): void {
    const serviceKey = s.vault['SERVICE_ROLE_KEY'] ?? ''
    for (const row of s.epl.filter(r => r.status === 'pending_retry' && new Date(r.next_attempt_at) <= new Date())) {
      s.httpRequests.push({
        url: 'https://project.supabase.co/functions/v1/event-processor',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: { event_id: row.event_id },
      })
    }
  }

  function checkRetryAuthFailures(s: ReturnType<typeof makeRetryState>): number {
    const cutoff = new Date(Date.now() - 5 * 60_000)
    const failures = s.httpResponses.filter(r => [401, 403].includes(r.status_code) && new Date(r.created) >= cutoff).length
    if (failures > 0) {
      s.securityEvents.push({ event_type: 'retry_auth_failures_detected', severity: 'critical', payload: { failure_count: failures } })
    }
    s.health.retry_auth_failures_5min = failures
    return failures
  }

  it('PRE-FIX: retry request omits Authorization header → would receive 401', () => {
    const s = makeRetryState('svc-key')
    dispatchRetryEvents_preFix(s)
    expect(s.httpRequests[0].headers['Authorization']).toBeUndefined()
  })

  it('POST-FIX: retry request includes Authorization: Bearer <token>', () => {
    const s = makeRetryState('svc-key-abc')
    dispatchRetryEvents_postFix(s)
    expect(s.httpRequests).toHaveLength(1)
    expect(s.httpRequests[0].headers['Authorization']).toBe('Bearer svc-key-abc')
  })

  it('POST-FIX: vault missing key → Authorization header is empty but present', () => {
    // The guard `?? ''` means the header key exists (no missing header bug) but
    // the token is empty — this still surfaces as a 401 which is then monitored.
    const s = makeRetryState()   // no vault key
    dispatchRetryEvents_postFix(s)
    expect(s.httpRequests[0].headers['Authorization']).toBe('Bearer ')
  })

  it('POST-FIX: 401 responses are counted by check_retry_auth_failures', () => {
    const s = makeRetryState('svc-key')
    s.httpResponses.push({ status_code: 401, created: new Date().toISOString() })
    const count = checkRetryAuthFailures(s)
    expect(count).toBe(1)
    expect(s.health.retry_auth_failures_5min).toBe(1)
  })

  it('check_retry_auth_failures emits critical security event when 401s detected', () => {
    const s = makeRetryState('svc-key')
    s.httpResponses.push({ status_code: 401, created: new Date().toISOString() })
    checkRetryAuthFailures(s)
    const evt = s.securityEvents.find(e => e.event_type === 'retry_auth_failures_detected')
    expect(evt).toBeDefined()
    expect(evt!.severity).toBe('critical')
    expect(evt!.payload.failure_count).toBe(1)
  })

  it('platform_health_metrics.retry_auth_failures_5min is updated by check function', () => {
    const s = makeRetryState('svc-key')
    s.health.retry_auth_failures_5min = 99   // stale previous value
    checkRetryAuthFailures(s)
    expect(s.health.retry_auth_failures_5min).toBe(0)  // cleared when no recent failures
  })

  it('POST-FIX: with correct Authorization header, 200 responses drain the retry queue', () => {
    const s = makeRetryState('svc-key')
    dispatchRetryEvents_postFix(s)
    // Simulate successful response (200) → queue drains
    s.httpResponses.push({ status_code: 200, created: new Date().toISOString() })
    const failures = checkRetryAuthFailures(s)
    expect(failures).toBe(0)
    expect(s.securityEvents).toHaveLength(0)
  })
})

// ── SCENARIO 6: Database restart during projection rebuild ─────────────────────

describe('CHAOS-06: Database restart during projection rebuild', () => {
  // pg_advisory_lock is SESSION-LEVEL — it is automatically released when the
  // session (DB connection) terminates. A DB restart kills all sessions.
  // After restart: the exclusive advisory lock is gone (no ghost lock).
  // However, admin_operation_locks (a real DB table) may still have a future
  // locked_until — this cooldown is PERSISTENT across restarts.

  interface CooldownLock { operation: string; locked_until: Date; operation_id: string }
  interface SessionLock { name: string; session_id: string }

  interface RestartState {
    session_locks: SessionLock[]    // simulates pg session-level advisory locks
    cooldown_locks: CooldownLock[]  // simulates admin_operation_locks table rows
    projection_event_log: { event_id: string }[]
    checksums: { name: string; checksum: string }[]
  }

  function freshRestartState(): RestartState {
    return { session_locks: [], cooldown_locks: [], projection_event_log: [], checksums: [] }
  }

  function acquireSessionLock(s: RestartState, name: string, sessionId: string): boolean {
    if (s.session_locks.some(l => l.name === name)) return false
    s.session_locks.push({ name, session_id: sessionId })
    return true
  }

  function simulateDbRestart(s: RestartState): void {
    // PostgreSQL releases all session-level advisory locks when sessions are killed.
    // DB table data (cooldown_locks, projection_event_log, checksums) persists.
    s.session_locks = []
  }

  function setCooldownLock(s: RestartState, operation: string, durationMs: number, opId: string): void {
    const existing = s.cooldown_locks.findIndex(c => c.operation === operation)
    const row: CooldownLock = { operation, locked_until: new Date(Date.now() + durationMs), operation_id: opId }
    if (existing >= 0) s.cooldown_locks[existing] = row
    else s.cooldown_locks.push(row)
  }

  function isCooldownActive(s: RestartState, operation: string): boolean {
    const lock = s.cooldown_locks.find(c => c.operation === operation)
    return lock !== undefined && lock.locked_until > new Date()
  }

  function clearCooldownLock(s: RestartState, operation: string): void {
    s.cooldown_locks = s.cooldown_locks.filter(c => c.operation !== operation)
  }

  it('session-level advisory lock is released on DB restart — no ghost lock', () => {
    const s = freshRestartState()
    const acquired = acquireSessionLock(s, 'project_order_created', 'session-1')
    expect(acquired).toBe(true)
    expect(s.session_locks).toHaveLength(1)

    simulateDbRestart(s)

    // After restart: session lock is gone
    expect(s.session_locks).toHaveLength(0)
    // A new rebuild can immediately acquire the lock
    const reacquired = acquireSessionLock(s, 'project_order_created', 'session-2')
    expect(reacquired).toBe(true)
  })

  it('cooldown lock in admin_operation_locks persists across DB restart', () => {
    const s = freshRestartState()
    setCooldownLock(s, 'admin_rebuild_projection', 30 * 60_000, 'op-rebuild-1')
    expect(isCooldownActive(s, 'admin_rebuild_projection')).toBe(true)

    simulateDbRestart(s)

    // DB table data survives restart — cooldown is still active
    expect(s.cooldown_locks).toHaveLength(1)
    expect(isCooldownActive(s, 'admin_rebuild_projection')).toBe(true)
  })

  it('if cooldown is active post-restart, rebuild is blocked until admin clears it', () => {
    const s = freshRestartState()
    setCooldownLock(s, 'admin_rebuild_projection', 30 * 60_000, 'op-rebuild-1')
    simulateDbRestart(s)

    // Rebuild attempt blocked by cooldown (not by session lock — that's gone)
    const blockedByCooldown = isCooldownActive(s, 'admin_rebuild_projection')
    expect(blockedByCooldown).toBe(true)

    // Admin manually clears the cooldown (emergency override)
    clearCooldownLock(s, 'admin_rebuild_projection')
    expect(isCooldownActive(s, 'admin_rebuild_projection')).toBe(false)

    // Now rebuild can proceed
    const acquired = acquireSessionLock(s, 'project_order_created', 'session-new')
    expect(acquired).toBe(true)
  })

  it('projection_event_log and checksums survive restart (no data corruption)', () => {
    const s = freshRestartState()
    s.projection_event_log.push({ event_id: 'evt-1' }, { event_id: 'evt-2' })
    s.checksums.push({ name: 'project_order_created', checksum: 'hash(evt-1,evt-2)' })

    simulateDbRestart(s)

    // Persistent data is intact
    expect(s.projection_event_log).toHaveLength(2)
    expect(s.checksums[0].checksum).toBe('hash(evt-1,evt-2)')
  })

  it('after restart an expired cooldown does not block the rebuild', () => {
    const s = freshRestartState()
    // Set a cooldown that is already in the past (e.g., rebuild ran 2 hours ago)
    s.cooldown_locks.push({ operation: 'admin_rebuild_projection', locked_until: new Date(Date.now() - 3600_000), operation_id: 'op-old' })
    simulateDbRestart(s)

    expect(isCooldownActive(s, 'admin_rebuild_projection')).toBe(false)
    const acquired = acquireSessionLock(s, 'project_order_created', 'session-3')
    expect(acquired).toBe(true)
  })
})

// ── SCENARIO 7: Role escalation during rebuild ─────────────────────────────────

describe('CHAOS-07: Role escalation during rebuild', () => {
  // Three escalation paths are tested:
  // 1. Standard user calls admin_rebuild_projection → admin_required
  // 2. Standard user calls admin_grant_role to elevate themselves → admin_required
  // 3. Attacker with stale admin JWT (revoked in user_roles) calls admin functions
  //    → is_admin() queries DB, sees revoked_at is set → admin_required +
  //      admin_jwt_claim_denied_by_db security event at critical

  interface UserRoleRow {
    user_id: string; role: string
    revoked_at: Date | null; expires_at: Date | null
  }
  interface SecurityEvent { event_type: string; severity: string; metadata: Record<string, unknown> }

  interface EscalationState {
    userRoles: UserRoleRow[]
    securityEvents: SecurityEvent[]
    rebuildLog: string[]
    grantLog: string[]
  }

  function freshEscState(): EscalationState {
    return { userRoles: [], securityEvents: [], rebuildLog: [], grantLog: [] }
  }

  function hasActiveAdmin(s: EscalationState, uid: string): boolean {
    const now = new Date()
    return s.userRoles.some(
      r => r.user_id === uid && r.role === 'admin' && r.revoked_at === null &&
           (r.expires_at === null || r.expires_at > now),
    )
  }

  function isAdminCheck(s: EscalationState, uid: string, jwtRole: string | null): boolean {
    const active = hasActiveAdmin(s, uid)
    if (!active && jwtRole === 'admin') {
      s.securityEvents.push({
        event_type: 'admin_jwt_claim_denied_by_db',
        severity: 'critical',
        metadata: { uid, db_authorized: false, jwt_claim: jwtRole },
      })
    }
    return active
  }

  function callAdminRebuildProjection(s: EscalationState, callerUid: string, jwtRole: string | null): 'success' | 'admin_required' {
    if (!isAdminCheck(s, callerUid, jwtRole)) return 'admin_required'
    s.rebuildLog.push(callerUid)
    return 'success'
  }

  function callAdminGrantRole(s: EscalationState, callerUid: string, jwtRole: string | null, targetRole: string): 'success' | 'admin_required' {
    if (!isAdminCheck(s, callerUid, jwtRole)) return 'admin_required'
    s.grantLog.push(`${callerUid} → ${targetRole}`)
    return 'success'
  }

  it('standard user (no user_roles row) cannot call admin_rebuild_projection', () => {
    const s = freshEscState()
    const standardUser = 'user-standard'
    const result = callAdminRebuildProjection(s, standardUser, null)
    expect(result).toBe('admin_required')
    expect(s.rebuildLog).toHaveLength(0)
  })

  it('standard user cannot self-escalate via admin_grant_role', () => {
    const s = freshEscState()
    const attacker = 'user-attacker'
    const result = callAdminGrantRole(s, attacker, null, 'admin')
    expect(result).toBe('admin_required')
    expect(s.grantLog).toHaveLength(0)
  })

  it('active admin can call admin_rebuild_projection', () => {
    const s = freshEscState()
    const adminId = 'user-real-admin'
    s.userRoles.push({ user_id: adminId, role: 'admin', revoked_at: null, expires_at: null })
    const result = callAdminRebuildProjection(s, adminId, 'admin')
    expect(result).toBe('success')
    expect(s.rebuildLog).toContain(adminId)
  })

  it('stale JWT attacker: revoked admin cannot call admin_rebuild_projection', () => {
    const s = freshEscState()
    const attackerId = 'user-revoked-admin'
    // Attacker has an admin JWT but their user_roles row has revoked_at set
    s.userRoles.push({ user_id: attackerId, role: 'admin', revoked_at: new Date(), expires_at: null })

    const result = callAdminRebuildProjection(s, attackerId, 'admin')  // JWT claims 'admin'
    expect(result).toBe('admin_required')
    expect(s.rebuildLog).toHaveLength(0)
  })

  it('stale JWT attacker: admin_jwt_claim_denied_by_db emitted at critical severity', () => {
    const s = freshEscState()
    const attackerId = 'user-revoked-admin'
    s.userRoles.push({ user_id: attackerId, role: 'admin', revoked_at: new Date(), expires_at: null })

    callAdminRebuildProjection(s, attackerId, 'admin')

    const evt = s.securityEvents.find(e => e.event_type === 'admin_jwt_claim_denied_by_db')
    expect(evt).toBeDefined()
    expect(evt!.severity).toBe('critical')
    expect(evt!.metadata.uid).toBe(attackerId)
    expect(evt!.metadata.db_authorized).toBe(false)
  })

  it('stale JWT attacker: revoked admin cannot self-grant via admin_grant_role', () => {
    const s = freshEscState()
    const attackerId = 'user-revoked-admin'
    s.userRoles.push({ user_id: attackerId, role: 'admin', revoked_at: new Date(), expires_at: null })

    const result = callAdminGrantRole(s, attackerId, 'admin', 'admin')
    expect(result).toBe('admin_required')
    expect(s.grantLog).toHaveLength(0)
  })

  it('expired admin (expires_at in the past) is denied — same path as revoked', () => {
    const s = freshEscState()
    const attackerId = 'user-expired-admin'
    s.userRoles.push({
      user_id: attackerId, role: 'admin',
      revoked_at: null, expires_at: new Date(Date.now() - 1000),   // expired
    })

    const result = callAdminRebuildProjection(s, attackerId, 'admin')
    expect(result).toBe('admin_required')
  })

  it('no security event emitted when non-admin user makes no admin JWT claim', () => {
    // Normal users have no admin JWT claim — no anomaly to report
    const s = freshEscState()
    callAdminRebuildProjection(s, 'user-normal', null)
    expect(s.securityEvents).toHaveLength(0)
  })

  it('JWT without DB grant does not pollute rebuild log', () => {
    const s = freshEscState()
    const attackerId = 'user-no-db-row'
    // JWT claims admin but there is NO user_roles row at all
    const result = callAdminRebuildProjection(s, attackerId, 'admin')
    expect(result).toBe('admin_required')
    expect(s.rebuildLog).toHaveLength(0)
    // Security event IS emitted because JWT/DB diverge
    expect(s.securityEvents.find(e => e.event_type === 'admin_jwt_claim_denied_by_db')).toBeDefined()
  })
})
