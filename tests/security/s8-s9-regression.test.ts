/**
 * S-8 / S-9 Sprint 17 Security Regression Tests
 *
 * Mock/unit style — no live DB connection required.
 * Guards the contracts introduced in migrations 017 and 018.
 *
 * Run: npx jest tests/security/s8-s9-regression.test.ts
 */

import {
  freshState,
  mockSafeSendNotification,
  mockAdminBulkNotify,
  mockValidateStoragePath,
  mockAdminRemoveMedia,
  assertNoError,
  assertErrorContains,
  assert,
} from './s8-s9-mocks'

// ── S-8: Notification Hardening ───────────────────────────────────────────────

describe('S-8: Notification Hardening', () => {

  it('rejects a data payload exceeding 16 KB', () => {
    const state = freshState()
    const bigData = { blob: 'x'.repeat(17000) }

    const result = mockSafeSendNotification(state, {
      p_user_id: crypto.randomUUID(),
      p_type: 'system', p_title: 'Test', p_body: 'Hello', p_data: bigData,
    })

    assertErrorContains(result, 'notification_payload_too_large', 'large payload')
    assert(state.notifications.length === 0, 'no notification inserted')
  })

  it('returns null for the second identical notification within 5 minutes (dedup)', () => {
    const state = freshState()
    const uid = crypto.randomUUID()
    const params = {
      p_user_id: uid, p_type: 'system',
      p_title: 'Your order is ready', p_body: 'Pick up your meal!',
    }

    const first = mockSafeSendNotification(state, params)
    assertNoError(first, 'first send')
    assert(first.data !== null, 'first call returns a notification id')

    const second = mockSafeSendNotification(state, params)
    assertNoError(second, 'second send (dedup)')
    assert(second.data === null, 'second identical send must return null')
    assert(state.notifications.length === 1, 'only one notification row exists')
  })

  it('blocks urgent priority from non-service_role callers', () => {
    const state = freshState()

    const result = mockSafeSendNotification(state, {
      p_user_id: crypto.randomUUID(), p_type: 'system',
      p_title: 'Critical', p_body: 'Act now!',
      p_priority: 'urgent', callerRole: 'authenticated',
    })

    assertErrorContains(result, 'priority_escalation_denied', 'priority escalation')
    assert(state.notifications.length === 0, 'no notification inserted')
  })

  it('allows urgent priority when called as service_role', () => {
    const state = freshState()

    const result = mockSafeSendNotification(state, {
      p_user_id: crypto.randomUUID(), p_type: 'system',
      p_title: 'Urgent system alert', p_body: 'Platform issue.',
      p_priority: 'urgent', callerRole: 'service_role',
    })

    assertNoError(result, 'service_role urgent')
    assert(result.data !== null, 'notification id returned')
  })

  it('throws bulk_notify_cap_exceeded when passed more than 1000 recipients', () => {
    const state = freshState()
    const userIds = Array.from({ length: 1001 }, () => crypto.randomUUID())

    const result = mockAdminBulkNotify(state, {
      p_user_ids: userIds, p_type: 'system',
      p_title: 'Big announcement', p_body: 'Something happened',
    })

    assertErrorContains(result, 'bulk_notify_cap_exceeded', 'bulk cap')
  })

  it('succeeds with exactly 1000 recipients', () => {
    const state = freshState()
    const userIds = Array.from({ length: 1000 }, () => crypto.randomUUID())

    const result = mockAdminBulkNotify(state, {
      p_user_ids: userIds, p_type: 'system',
      p_title: 'Announcement', p_body: 'Something happened',
    })

    assertNoError(result, '1000 recipients')
    assert(result.data === 1000, 'all 1000 sent (no dedup within unique user ids)')
  })

  it('admin_bulk_notify logs an entry to admin_action_log', () => {
    const state = freshState()
    const recipients = [crypto.randomUUID(), crypto.randomUUID()]

    mockAdminBulkNotify(state, {
      p_user_ids: recipients, p_type: 'system',
      p_title: 'Hello admins', p_body: 'Test broadcast',
      p_reason: 'sprint-17-test',
    })

    const log = state.adminActionLog.find((l) => l.action_type === 'bulk_notify')
    assert(log !== undefined, 'bulk_notify entry must exist in admin_action_log')
    assert((log!.metadata['recipient_count'] as number) === 2, 'recipient_count must match')
  })

  it('rejects admin_bulk_notify from a non-admin caller', () => {
    const state = freshState()

    const result = mockAdminBulkNotify(state, {
      p_user_ids: [crypto.randomUUID()], p_type: 'system',
      p_title: 'Test', p_body: 'Test', isAdmin: false,
    })

    assertErrorContains(result, 'admin_required', 'non-admin bulk notify')
  })

  it('returns null (graceful drop) when global platform counter exceeds 10 000/min', () => {
    const state = freshState()
    // Pre-fill the counter past the storm cap
    state.platformCounter = { minute: new Date(), count: 10001 }

    const result = mockSafeSendNotification(state, {
      p_user_id: crypto.randomUUID(), p_type: 'system',
      p_title: 'Storm notification', p_body: 'This should be dropped',
      callerRole: 'service_role',
    })

    assertNoError(result, 'global storm graceful drop')
    assert(result.data === null, 'storm guard must return null')
  })
})

// ── S-9: Media Administration Hardening ──────────────────────────────────────

describe('S-9: Media Administration Hardening', () => {

  it('validate_storage_path blocks path traversal "../etc/passwd"', () => {
    assertErrorContains(mockValidateStoragePath('../etc/passwd'), 'invalid_storage_path', 'traversal')
  })

  it('validate_storage_path blocks absolute paths starting with "/"', () => {
    assertErrorContains(mockValidateStoragePath('/bucket/secret/file.jpg'), 'invalid_storage_path', 'absolute path')
  })

  it('validate_storage_path blocks paths with SQL-injection characters', () => {
    assertErrorContains(
      mockValidateStoragePath('users/abc;drop table notifications--/photo.jpg'),
      'invalid_storage_path', 'special chars',
    )
  })

  it('validate_storage_path allows well-formed relative paths', () => {
    const result = mockValidateStoragePath('users/abc123/photos/meal-prep.jpg')
    assertNoError(result, 'valid path')
    assert(result.data === true, 'valid path passes')
  })

  it('validate_storage_path allows NULL (path not yet set at intake)', () => {
    assertNoError(mockValidateStoragePath(null), 'null path')
  })

  it('admin_remove_media is idempotent — second call returns existing action_id without error', () => {
    const state = freshState()
    const mediaId = crypto.randomUUID()
    state.mediaObjects.push({
      id: mediaId, uploader_id: crypto.randomUUID(),
      storage_bucket: 'media', storage_path: 'users/test/photo.jpg',
      pipeline_status: 'ready', filesize: 102400, rejection_reason: null,
    })

    const first = mockAdminRemoveMedia(state, { p_media_id: mediaId, p_reason: 'spam' })
    assertNoError(first, 'first quarantine')

    const second = mockAdminRemoveMedia(state, { p_media_id: mediaId, p_reason: 'duplicate' })
    assertNoError(second, 'idempotent second call')
    assert(second.data !== null, 'second call returns an action id')
    assert(
      state.mediaObjects.find((m) => m.id === mediaId)!.pipeline_status === 'quarantined',
      'status stays quarantined',
    )
  })

  it('admin_remove_media sets pipeline_status to "quarantined"', () => {
    const state = freshState()
    const mediaId = crypto.randomUUID()
    state.mediaObjects.push({
      id: mediaId, uploader_id: crypto.randomUUID(),
      storage_bucket: 'media', storage_path: 'meals/prepper-a/lasagne.jpg',
      pipeline_status: 'ready', filesize: 204800, rejection_reason: null,
    })

    const result = mockAdminRemoveMedia(state, { p_media_id: mediaId, p_reason: 'violates policy' })
    assertNoError(result, 'quarantine')

    const media = state.mediaObjects.find((m) => m.id === mediaId)!
    assert(media.pipeline_status === 'quarantined', 'pipeline_status is "quarantined"')
    assert(media.rejection_reason === 'admin_removed: violates policy', 'rejection_reason set')
  })

  it('admin_remove_media sets orphaned_at on listing_photos sharing the storage_path', () => {
    const state = freshState()
    const mediaId = crypto.randomUUID()
    const sharedPath = 'meals/kitchen-z/lasagne.jpg'

    state.mediaObjects.push({
      id: mediaId, uploader_id: crypto.randomUUID(),
      storage_bucket: 'media', storage_path: sharedPath,
      pipeline_status: 'ready', filesize: 153600, rejection_reason: null,
    })
    const photoId = crypto.randomUUID()
    state.listingPhotos.push({
      id: photoId, listing_id: crypto.randomUUID(),
      storage_path: sharedPath, orphaned_at: null,
    })

    mockAdminRemoveMedia(state, { p_media_id: mediaId, p_reason: 'adult content' })

    const photo = state.listingPhotos.find((p) => p.id === photoId)!
    assert(photo.orphaned_at !== null, 'listing_photos.orphaned_at is set')
  })

  it('admin_remove_media returns generic "media_not_found" without leaking bucket info', () => {
    const state = freshState()
    const result = mockAdminRemoveMedia(state, {
      p_media_id: crypto.randomUUID(), p_reason: 'test',
    })

    assertErrorContains(result, 'media_not_found', 'unknown media error')
    assert(
      !result.error!.message.includes('bucket') && !result.error!.message.includes('storage'),
      'error must not leak storage internals',
    )
  })

  it('admin_remove_media rejects non-admin callers', () => {
    const state = freshState()
    const mediaId = crypto.randomUUID()
    state.mediaObjects.push({
      id: mediaId, uploader_id: crypto.randomUUID(),
      storage_bucket: 'media', storage_path: 'users/hacker/exploit.jpg',
      pipeline_status: 'ready', filesize: 1024, rejection_reason: null,
    })

    assertErrorContains(
      mockAdminRemoveMedia(state, { p_media_id: mediaId, p_reason: 'test', isAdmin: false }),
      'admin_required', 'non-admin remove',
    )
  })

  it('admin_remove_media enforces a 100/hour per-admin quota', () => {
    const state = freshState()
    state.adminMediaRemovals = 100  // already at cap

    const mediaId = crypto.randomUUID()
    state.mediaObjects.push({
      id: mediaId, uploader_id: crypto.randomUUID(),
      storage_bucket: 'media', storage_path: 'test/quota-check.jpg',
      pipeline_status: 'ready', filesize: 512, rejection_reason: null,
    })

    assertErrorContains(
      mockAdminRemoveMedia(state, { p_media_id: mediaId, p_reason: 'test' }),
      'media_removal_quota_exceeded', 'media quota',
    )
  })
})
