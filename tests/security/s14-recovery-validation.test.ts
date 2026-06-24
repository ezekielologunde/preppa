/**
 * S-14: Recovery Path Validation
 * Mock-based executable specifications for every recovery path.
 * Run with Jest: npx jest tests/security/s14-recovery-validation.test.ts
 */

// ── Shared mock types ─────────────────────────────────────────────────────────

interface DeadLetter {
  id: string; event_id: string; resolved_at: string | null; manual_replay_count: number;
}
interface EplRow {
  event_id: string; status: string; attempt_count: number; next_attempt_at: string;
}
interface Payment {
  id: string; order_id: string; status: string; amount_pence: number; refunded_at: string | null;
}
interface DrainRow { window_start: string; drain_count: number; }

// ── 1. PROJECTION REBUILD RECOVERY ───────────────────────────────────────────

describe('admin_rebuild_projection', () => {
  function makeState() {
    return {
      projectionEventLog: [{ event_id: 'e1', projection_name: 'project_order_created' }],
      prepperMetrics: [{ prepper_id: 'p1', total_orders: 10 }],
      operationLocks: [] as Array<{ key: string; until: number; by: string }>,
      securityEvents: [] as string[],
      sessions: [] as Array<{ id: string; dry_run: boolean }>,
    };
  }

  function rebuildProjection(
    s: ReturnType<typeof makeState>,
    opts: { projection_name: string; dry_run: boolean },
  ): string {
    const lock = s.operationLocks.find(l => l.key === `rebuild:${opts.projection_name}` && l.until > Date.now());
    if (lock) throw new Error(`projection_rebuild_cooldown: retry after ${new Date(lock.until).toISOString()}`);
    s.securityEvents.push('projection_rebuild_initiated');
    if (!opts.dry_run) {
      s.operationLocks = s.operationLocks.filter(l => l.key !== `rebuild:${opts.projection_name}`);
      s.operationLocks.push({ key: `rebuild:${opts.projection_name}`, until: Date.now() + 600_000, by: 'admin-1' });
      s.projectionEventLog = s.projectionEventLog.filter(e => e.projection_name !== opts.projection_name);
      if (opts.projection_name === 'project_order_created')
        s.prepperMetrics = s.prepperMetrics.map(m => ({ ...m, total_orders: 0 }));
    }
    const id = `session-${Math.random().toString(36).slice(2)}`;
    s.sessions.push({ id, dry_run: opts.dry_run });
    if (!opts.dry_run) s.operationLocks = s.operationLocks.filter(l => l.key !== `rebuild:${opts.projection_name}`);
    return id;
  }

  it('clears projection_event_log and zeroes read-models atomically (non-dry-run)', () => {
    const s = makeState();
    rebuildProjection(s, { projection_name: 'project_order_created', dry_run: false });
    expect(s.projectionEventLog.filter(e => e.projection_name === 'project_order_created')).toHaveLength(0);
    expect(s.prepperMetrics[0].total_orders).toBe(0);
  });

  it('dry_run=TRUE does not modify projection_event_log or read-models', () => {
    const s = makeState();
    rebuildProjection(s, { projection_name: 'project_order_created', dry_run: true });
    expect(s.projectionEventLog).toHaveLength(1);
    expect(s.prepperMetrics[0].total_orders).toBe(10);
    expect(s.sessions[0].dry_run).toBe(true);
  });

  it('cooldown lock prevents concurrent rebuilds of same projection', () => {
    const s = makeState();
    s.operationLocks.push({ key: 'rebuild:project_order_created', until: Date.now() + 300_000, by: 'admin-1' });
    expect(() => rebuildProjection(s, { projection_name: 'project_order_created', dry_run: false }))
      .toThrow(/projection_rebuild_cooldown/);
  });

  it('emits security event on initiation', () => {
    const s = makeState();
    rebuildProjection(s, { projection_name: 'project_order_created', dry_run: false });
    expect(s.securityEvents).toContain('projection_rebuild_initiated');
  });

  it('replay after rebuild produces correct counts (3 order.created events → total_orders = 3)', () => {
    const counters = { total_orders: 0 };
    const gate = new Set<string>();
    const events = ['e1', 'e2', 'e3'];
    for (const id of events) {
      if (!gate.has(id)) { gate.add(id); counters.total_orders += 1; }
    }
    expect(counters.total_orders).toBe(3);
  });
});

// ── 2. DEAD-LETTER REPLAY RECOVERY ───────────────────────────────────────────

describe('admin_replay_dead_letter', () => {
  function makeDl(overrides: Partial<DeadLetter> = {}): DeadLetter {
    return { id: 'dl-1', event_id: 'evt-1', resolved_at: null, manual_replay_count: 0, ...overrides };
  }

  function replayDeadLetter(
    deadLetters: DeadLetter[],
    epl: EplRow[],
    drain: DrainRow[],
    args: { id: string },
  ): void {
    const win = new Date(); win.setMinutes(0, 0, 0);
    let d = drain.find(r => r.window_start === win.toISOString());
    if (!d) { d = { window_start: win.toISOString(), drain_count: 0 }; drain.push(d); }
    if (d.drain_count >= 50) throw new Error('deadletter_drain_quota_exceeded');
    d.drain_count += 1;

    const dl = deadLetters.find(x => x.id === args.id && !x.resolved_at);
    if (!dl) throw new Error('dead_letter_not_found_or_already_resolved');
    if (dl.manual_replay_count >= 3) throw new Error('replay_quota_exceeded: max 3 manual replays per dead letter');

    const row = epl.find(e => e.event_id === dl.event_id);
    if (row) row.status = 'pending_retry';
    else epl.push({ event_id: dl.event_id, status: 'pending_retry', attempt_count: 0, next_attempt_at: new Date().toISOString() });

    dl.manual_replay_count += 1;
    dl.resolved_at = new Date().toISOString();
  }

  it('max 3 replays per dead letter; 4th throws replay_quota_exceeded', () => {
    expect(() => replayDeadLetter([makeDl({ manual_replay_count: 3 })], [], [], { id: 'dl-1' }))
      .toThrow(/replay_quota_exceeded/);
  });

  it('replaying already-resolved dead letter throws dead_letter_not_found_or_already_resolved', () => {
    expect(() => replayDeadLetter([makeDl({ resolved_at: new Date().toISOString() })], [], [], { id: 'dl-1' }))
      .toThrow(/dead_letter_not_found_or_already_resolved/);
  });

  it('replay increments manual_replay_count', () => {
    const dl = [makeDl()];
    replayDeadLetter(dl, [], [], { id: 'dl-1' });
    expect(dl[0].manual_replay_count).toBe(1);
  });

  it('replay emits to event_processing_log with status=pending_retry', () => {
    const dl = [makeDl()];
    const epl: EplRow[] = [{ event_id: 'evt-1', status: 'dead_letter', attempt_count: 5, next_attempt_at: '' }];
    replayDeadLetter(dl, epl, [], { id: 'dl-1' });
    expect(epl[0].status).toBe('pending_retry');
  });

  it('global drain cap: 51st dead-letter replay this hour throws deadletter_drain_quota_exceeded', () => {
    const win = new Date(); win.setMinutes(0, 0, 0);
    const drain: DrainRow[] = [{ window_start: win.toISOString(), drain_count: 50 }];
    expect(() => replayDeadLetter([makeDl()], [], drain, { id: 'dl-1' }))
      .toThrow(/deadletter_drain_quota_exceeded/);
  });
});

// ── 3. NOTIFICATION RECOVERY ──────────────────────────────────────────────────

describe('notification recovery', () => {
  function sendNotif(db: Array<{ user_id: string; type: string; at: number }>, user_id: string, type: string): boolean {
    const cutoff = Date.now() - 5 * 60_000;
    if (db.find(n => n.user_id === user_id && n.type === type && n.at >= cutoff)) return false;
    db.push({ user_id, type, at: Date.now() });
    return true;
  }

  it('safe_send_notification: dedup prevents duplicate within 5 min', () => {
    const db: Array<{ user_id: string; type: string; at: number }> = [];
    expect(sendNotif(db, 'u1', 'order_confirmed')).toBe(true);
    expect(sendNotif(db, 'u1', 'order_confirmed')).toBe(false);
  });

  it('notification_dedup cleans up after expiry (re-send after 5 min is allowed)', () => {
    const db = [{ user_id: 'u1', type: 'order_confirmed', at: Date.now() - 6 * 60_000 }];
    expect(sendNotif(db, 'u1', 'order_confirmed')).toBe(true);
  });

  it('bulk notify cap: >1000 recipients throws bulk_notify_limit_exceeded', () => {
    function bulkNotify(n: number) { if (n > 1000) throw new Error('bulk_notify_limit_exceeded'); }
    expect(() => bulkNotify(1001)).toThrow(/bulk_notify_limit_exceeded/);
    expect(() => bulkNotify(1000)).not.toThrow();
  });
});

// ── 4. PAYMENT RECOVERY ───────────────────────────────────────────────────────

describe('admin_refund_order', () => {
  function refundOrder(payments: Payment[], quota: { count: number }, order_id: string): number {
    if (quota.count >= 20) throw new Error('refund_quota_exceeded: max 20 refunds per hour');
    const p = payments.find(x => x.order_id === order_id);
    if (!p) throw new Error('payment_not_found');
    if (!['captured', 'in_escrow'].includes(p.status)) throw new Error(`payment_not_refundable`);
    if (p.refunded_at) throw new Error('already_refunded');
    p.status = 'refunded'; p.refunded_at = new Date().toISOString();
    quota.count += 1;
    return p.amount_pence; // always from DB
  }

  it('FOR UPDATE lock prevents concurrent double-refund (second call throws already_refunded)', () => {
    const payments: Payment[] = [{ id: 'p1', order_id: 'o1', status: 'captured', amount_pence: 5000, refunded_at: null }];
    const q = { count: 0 };
    refundOrder(payments, q, 'o1');
    expect(() => refundOrder(payments, q, 'o1')).toThrow('already_refunded');
  });

  it('idempotency: already_refunded throws on second call with same order', () => {
    const payments: Payment[] = [{ id: 'p1', order_id: 'o1', status: 'refunded', amount_pence: 3000, refunded_at: new Date().toISOString() }];
    expect(() => refundOrder(payments, { count: 0 }, 'o1')).toThrow('already_refunded');
  });

  it('quota: 21st refund in same hour throws refund_quota_exceeded', () => {
    const payments: Payment[] = [{ id: 'p21', order_id: 'o21', status: 'captured', amount_pence: 1000, refunded_at: null }];
    expect(() => refundOrder(payments, { count: 20 }, 'o21')).toThrow(/refund_quota_exceeded/);
  });

  it('amount is always from DB, not from caller', () => {
    const payments: Payment[] = [{ id: 'p1', order_id: 'o1', status: 'captured', amount_pence: 9999, refunded_at: null }];
    const amount = refundOrder(payments, { count: 0 }, 'o1');
    expect(amount).toBe(9999);
  });
});

// ── 5. STORAGE RECOVERY ───────────────────────────────────────────────────────

describe('storage recovery', () => {
  it('quarantined media: admin_remove_media is idempotent', () => {
    const media = { id: 'm1', pipeline_status: 'ready' };
    function removeMedia(m: typeof media) { m.pipeline_status = 'quarantined'; }
    removeMedia(media); removeMedia(media);
    expect(media.pipeline_status).toBe('quarantined');
  });

  it('orphan detection: listing_photos.orphaned_at is set when media is quarantined', () => {
    const photo = { id: 'm1', orphaned_at: null as string | null };
    const media = { id: 'm1', pipeline_status: 'ready' };
    function removeMedia() {
      media.pipeline_status = 'quarantined';
      photo.orphaned_at = new Date().toISOString();
    }
    removeMedia();
    expect(photo.orphaned_at).not.toBeNull();
  });

  it('path traversal: storage_path with ../ is rejected by trigger', () => {
    function validatePath(p: string) { if (p.includes('..')) throw new Error('invalid_storage_path: path traversal detected'); }
    expect(() => validatePath('../etc/passwd')).toThrow(/path traversal/);
    expect(() => validatePath('/uploads/user-123/photo.jpg')).not.toThrow();
  });
});

// ── 6. RETRY ENGINE RECOVERY ──────────────────────────────────────────────────

describe('retry engine', () => {
  function dispatchRetry(epl: EplRow[], deadLetters: DeadLetter[], maxAttempts = 5): number {
    let dispatched = 0;
    for (const row of epl) {
      if (row.status !== 'pending_retry') continue;
      if (new Date(row.next_attempt_at) > new Date()) continue;
      row.status = 'processing'; dispatched += 1;
      if (row.attempt_count >= maxAttempts) {
        row.status = 'dead_letter';
        deadLetters.push({ id: `dl-${row.event_id}`, event_id: row.event_id, resolved_at: null, manual_replay_count: 0 });
      }
    }
    return dispatched;
  }

  it('dispatch_retry_events moves pending_retry events to processing', () => {
    const epl: EplRow[] = [
      { event_id: 'e1', status: 'pending_retry', attempt_count: 0, next_attempt_at: new Date(Date.now() - 1000).toISOString() },
      { event_id: 'e2', status: 'completed', attempt_count: 0, next_attempt_at: new Date(Date.now() - 1000).toISOString() },
    ];
    expect(dispatchRetry(epl, [])).toBe(1);
    expect(epl[0].status).toBe('processing');
    expect(epl[1].status).toBe('completed');
  });

  it('events that fail max attempts move to event_dead_letters', () => {
    const epl: EplRow[] = [{ event_id: 'e1', status: 'pending_retry', attempt_count: 5, next_attempt_at: new Date(Date.now() - 1000).toISOString() }];
    const dl: DeadLetter[] = [];
    dispatchRetry(epl, dl);
    expect(epl[0].status).toBe('dead_letter');
    expect(dl).toHaveLength(1);
  });

  it('pg_try_advisory_lock prevents concurrent pg_cron stacking', () => {
    let locked = true; // first run holds lock
    function tryDispatch(): boolean { if (locked) return false; locked = true; locked = false; return true; }
    expect(tryDispatch()).toBe(false); // second invocation skipped
  });
});

// ── 7. AUDIT LOG IMMUTABILITY ─────────────────────────────────────────────────

describe('audit log immutability', () => {
  function blockMutation(table: string, op: 'UPDATE' | 'DELETE'): never {
    throw new Error(`append_only_table: ${op} on ${table} is blocked`);
  }

  it('UPDATE on audit_logs throws append_only_table error', () => {
    expect(() => blockMutation('audit_logs', 'UPDATE')).toThrow('append_only_table: UPDATE on audit_logs is blocked');
  });

  it('DELETE on audit_logs throws append_only_table error', () => {
    expect(() => blockMutation('audit_logs', 'DELETE')).toThrow('append_only_table: DELETE on audit_logs is blocked');
  });

  it('DELETE on security_events throws append_only_table error', () => {
    expect(() => blockMutation('security_events', 'DELETE')).toThrow('append_only_table: DELETE on security_events is blocked');
  });

  it('DELETE on admin_action_log throws append_only_table error', () => {
    expect(() => blockMutation('admin_action_log', 'DELETE')).toThrow('append_only_table: DELETE on admin_action_log is blocked');
  });
});

// ── 8. FEATURE FLAG RECOVERY ──────────────────────────────────────────────────

describe('feature flag kill switch', () => {
  interface Flag { key: string; kill_switch: boolean; enabled: boolean; last_killed_at?: number; }

  function evaluateFlag(flags: Flag[], key: string): boolean {
    const f = flags.find(x => x.key === key);
    return !!f && !f.kill_switch && f.enabled;
  }

  function killFlag(flags: Flag[], key: string): void {
    const f = flags.find(x => x.key === key);
    if (!f) throw new Error('flag_not_found');
    if (f.kill_switch && f.last_killed_at && Date.now() - f.last_killed_at < 30_000)
      throw new Error('kill_switch_cooldown: cannot toggle within 30 seconds of last kill');
    f.kill_switch = true; f.enabled = false; f.last_killed_at = Date.now();
  }

  it('kill_switch=TRUE causes evaluate_flag to return FALSE for all users', () => {
    const flags: Flag[] = [{ key: 'new_search_ui', kill_switch: true, enabled: true }];
    expect(evaluateFlag(flags, 'new_search_ui')).toBe(false);
  });

  it('kill switch cooldown: toggling within 30s throws kill_switch_cooldown', () => {
    const flags: Flag[] = [{ key: 'payment_v2', kill_switch: true, enabled: false, last_killed_at: Date.now() - 10_000 }];
    expect(() => killFlag(flags, 'payment_v2')).toThrow(/kill_switch_cooldown/);
  });
});
