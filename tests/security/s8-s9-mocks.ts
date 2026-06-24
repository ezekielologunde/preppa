/**
 * Shared mock infrastructure for S-8 / S-9 security regression tests.
 * No DB connection needed — pure in-memory simulation of DB guard logic.
 */

// ── Shared types ──────────────────────────────────────────────────────────────

export interface RpcResult<T = unknown> {
  data: T | null
  error: { message: string; code?: string } | null
}

export interface NotificationRow {
  id: string; user_id: string; type: string; title: string
  body: string; data: Record<string, unknown>; priority: string
}

export interface MediaObjectRow {
  id: string; uploader_id: string; storage_bucket: string
  storage_path: string | null; pipeline_status: string
  filesize: number; rejection_reason: string | null
}

export interface ListingPhotoRow {
  id: string; listing_id: string; storage_path: string; orphaned_at: string | null
}

export interface AdminActionLogRow {
  id: string; admin_id: string; action_type: string
  target_type: string; metadata: Record<string, unknown>
}

export interface MockState {
  notifications: NotificationRow[]
  notificationDedup: Array<{ user_id: string; dedup_key: string; expires_at: Date }>
  notificationSendLog: Map<string, number>
  platformCounter: { minute: Date; count: number }
  mediaObjects: MediaObjectRow[]
  listingPhotos: ListingPhotoRow[]
  adminActionLog: AdminActionLogRow[]
  adminMediaRemovals: number
}

export function freshState(): MockState {
  return {
    notifications: [], notificationDedup: [],
    notificationSendLog: new Map(),
    platformCounter: { minute: new Date(), count: 0 },
    mediaObjects: [], listingPhotos: [],
    adminActionLog: [], adminMediaRemovals: 0,
  }
}

// Matches SQL: md5(type || ':' || title || ':' || LEFT(body,200))
function dedupKey(type: string, title: string, body: string): string {
  return `${type}:${title}:${body.substring(0, 200)}`
}

// ── safe_send_notification ────────────────────────────────────────────────────

export function mockSafeSendNotification(
  state: MockState,
  p: {
    p_user_id: string; p_type: string; p_title: string; p_body: string
    p_data?: Record<string, unknown>; p_priority?: string
    callerRole?: 'service_role' | 'authenticated'
  },
): RpcResult<string | null> {
  const { p_user_id, p_type, p_title, p_body,
    p_data = {}, p_priority = 'normal', callerRole = 'service_role' } = p

  // Guard 1: 16 KB payload cap
  const payloadBytes = JSON.stringify(p_data).length
  if (payloadBytes > 16384) {
    return { data: null, error: {
      message: `notification_payload_too_large: max 16384 bytes, got ${payloadBytes}`,
      code: 'P0001' } }
  }

  // Guard 2: priority escalation
  if (p_priority === 'urgent' && callerRole !== 'service_role') {
    return { data: null, error: {
      message: 'priority_escalation_denied: urgent priority requires service_role',
      code: 'P0001' } }
  }

  // Guard 3: dedup (5-minute window)
  const key = dedupKey(p_type, p_title, p_body)
  const now = new Date()
  const isDuplicate = state.notificationDedup.some(
    (d) => d.user_id === p_user_id && d.dedup_key === key && d.expires_at > now,
  )
  if (isDuplicate) return { data: null, error: null }
  state.notificationDedup.push({
    user_id: p_user_id, dedup_key: key,
    expires_at: new Date(now.getTime() + 5 * 60 * 1000),
  })

  // Guard 4: per-sender hourly rate limit
  const senderKey = `${p_user_id}_${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`
  const cap = callerRole === 'service_role' ? 200 : 50
  const current = state.notificationSendLog.get(senderKey) ?? 0
  if (current >= cap) return { data: null, error: null }
  state.notificationSendLog.set(senderKey, current + 1)

  // Guard 5: global storm (10 000/minute)
  const minuteTs = new Date(Math.floor(now.getTime() / 60000) * 60000)
  if (state.platformCounter.minute.getTime() < minuteTs.getTime()) {
    state.platformCounter = { minute: minuteTs, count: 1 }
  } else {
    state.platformCounter.count += 1
  }
  if (state.platformCounter.count > 10000) return { data: null, error: null }

  const id = crypto.randomUUID()
  state.notifications.push({
    id, user_id: p_user_id, type: p_type,
    title: p_title, body: p_body, data: p_data, priority: p_priority,
  })
  return { data: id, error: null }
}

// ── admin_bulk_notify ─────────────────────────────────────────────────────────

export function mockAdminBulkNotify(
  state: MockState,
  p: {
    p_user_ids: string[]; p_type: string; p_title: string; p_body: string
    p_data?: Record<string, unknown>; p_reason?: string; isAdmin?: boolean
  },
): RpcResult<number> {
  const { p_user_ids, p_type, p_title, p_body,
    p_data = {}, p_reason = 'test', isAdmin = true } = p

  if (!isAdmin) return { data: null, error: { message: 'admin_required', code: 'P0001' } }

  if (p_user_ids.length > 1000) {
    return { data: null, error: {
      message: `bulk_notify_cap_exceeded: max 1000 recipients per call, got ${p_user_ids.length}`,
      code: 'P0001' } }
  }

  let sent = 0
  for (const uid of p_user_ids) {
    const r = mockSafeSendNotification(state, {
      p_user_id: uid, p_type, p_title, p_body, p_data, callerRole: 'service_role',
    })
    if (r.data !== null && r.error === null) sent++
  }

  state.adminActionLog.push({
    id: crypto.randomUUID(), admin_id: 'mock-admin',
    action_type: 'bulk_notify', target_type: 'user',
    metadata: { type: p_type, title: p_title, recipient_count: p_user_ids.length,
      sent_count: sent, reason: p_reason },
  })
  return { data: sent, error: null }
}

// ── validate_storage_path ─────────────────────────────────────────────────────

export function mockValidateStoragePath(storagePath: string | null): RpcResult<boolean> {
  if (storagePath === null) return { data: true, error: null }
  if (storagePath.includes('..') || storagePath.startsWith('/')) {
    return { data: null, error: {
      message: 'invalid_storage_path: traversal sequences or absolute paths are not allowed',
      code: 'P0001' } }
  }
  if (!/^[a-zA-Z0-9/._-]+$/.test(storagePath)) {
    return { data: null, error: {
      message: 'invalid_storage_path: path contains disallowed characters',
      code: 'P0001' } }
  }
  return { data: true, error: null }
}

// ── admin_remove_media ────────────────────────────────────────────────────────

export function mockAdminRemoveMedia(
  state: MockState,
  p: { p_media_id: string; p_reason: string; isAdmin?: boolean },
): RpcResult<string> {
  const { p_media_id, p_reason, isAdmin = true } = p

  if (!isAdmin) return { data: null, error: { message: 'admin_required', code: 'P0001' } }

  if (state.adminMediaRemovals >= 100) {
    return { data: null, error: {
      message: 'media_removal_quota_exceeded: max 100 removals per hour', code: 'P0001' } }
  }
  state.adminMediaRemovals++

  const media = state.mediaObjects.find((m) => m.id === p_media_id)
  if (!media) return { data: null, error: { message: 'media_not_found', code: 'P0001' } }

  // Idempotent
  if (media.pipeline_status === 'quarantined') {
    const existing = state.adminActionLog.find(
      (l) => l.action_type === 'remove_media' && l.metadata['target_id'] === p_media_id,
    )
    return { data: existing?.id ?? crypto.randomUUID(), error: null }
  }

  media.pipeline_status = 'quarantined'
  media.rejection_reason = 'admin_removed: ' + p_reason

  // Orphan listing photos by matching storage_path
  for (const photo of state.listingPhotos) {
    if (photo.storage_path === media.storage_path && photo.orphaned_at === null) {
      photo.orphaned_at = new Date().toISOString()
    }
  }

  const actionId = crypto.randomUUID()
  state.adminActionLog.push({
    id: actionId, admin_id: 'mock-admin',
    action_type: 'remove_media', target_type: 'media_object',
    metadata: { target_id: p_media_id, storage_bucket: media.storage_bucket,
      storage_path: media.storage_path, uploader_id: media.uploader_id, reason: p_reason },
  })
  return { data: actionId, error: null }
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

export function assertNoError(result: RpcResult<unknown>, label: string): void {
  if (result.error !== null) {
    throw new Error(`[${label}] Unexpected error: ${result.error.message}`)
  }
}

export function assertErrorContains(result: RpcResult<unknown>, substr: string, label: string): void {
  if (!result.error) {
    throw new Error(`[${label}] Expected an error but got none (data=${JSON.stringify(result.data)})`)
  }
  if (!result.error.message.includes(substr)) {
    throw new Error(`[${label}] Expected error to contain "${substr}" but got: ${result.error.message}`)
  }
}

export function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`Assertion failed: ${label}`)
}
