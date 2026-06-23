// Contract: admin-actions
// All actions require an admin JWT.
// Key actions tested: release_escrow, refund_order, freeze_account
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { invoke, assertHasKeys, CUSTOMER_JWT, ADMIN_JWT } from './helpers.ts'

const FN = 'admin-actions'

Deno.test('admin-actions: rejects unauthenticated requests', async () => {
  const { status } = await invoke(FN, { action: 'release_escrow', order_id: 'x', reason: 'test' }, '')
  assertEquals(status, 401, 'no JWT → 401')
})

Deno.test('admin-actions: rejects non-admin users', async () => {
  if (!CUSTOMER_JWT) return
  const { status } = await invoke(FN, { action: 'release_escrow', order_id: 'x', reason: 'test' }, CUSTOMER_JWT)
  assertEquals(status, 403, 'non-admin JWT → 403')
})

Deno.test('admin-actions: rejects unknown action', async () => {
  if (!ADMIN_JWT) return
  const { status } = await invoke(FN, { action: 'do_something_evil' }, ADMIN_JWT)
  assertEquals(status, 400, 'unknown action → 400')
})

Deno.test('admin-actions: release_escrow requires order_id and reason', async () => {
  if (!ADMIN_JWT) return
  const { status } = await invoke(FN, { action: 'release_escrow' }, ADMIN_JWT)
  assertEquals(status, 400, 'missing order_id and reason → 400')
})

Deno.test('admin-actions: release_escrow rejects non-existent order', async () => {
  if (!ADMIN_JWT) return
  const { status } = await invoke(FN, {
    action: 'release_escrow',
    order_id: '00000000-0000-0000-0000-000000000000',
    reason:   'test',
  }, ADMIN_JWT)
  assertEquals(status, 404, 'non-existent order → 404')
})

Deno.test('admin-actions: freeze_account requires user_id and reason', async () => {
  if (!ADMIN_JWT) return
  const { status } = await invoke(FN, { action: 'freeze_account' }, ADMIN_JWT)
  assertEquals(status, 400, 'missing user_id/reason → 400')
})

Deno.test('admin-actions: success response has ok: true', async () => {
  const testOrderId = Deno.env.get('TEST_ESCROW_ORDER_ID')
  if (!ADMIN_JWT || !testOrderId) return
  const { status, data } = await invoke(FN, {
    action:   'release_escrow',
    order_id: testOrderId,
    reason:   'contract-test release',
  }, ADMIN_JWT)
  assertEquals(status, 200, 'valid release_escrow → 200')
  assertHasKeys(data, ['ok'], 'admin-actions response')
  assertEquals((data as { ok: boolean }).ok, true, 'ok is true')
})
