// Contract: stripe-refund
// Input:  { orderId: string }
// Output: { refunded: boolean, refund_id?: string, reason?: string }
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { invoke, assertHasKeys, CUSTOMER_JWT, ADMIN_JWT } from './helpers.ts'

const FN = 'stripe-refund'

Deno.test('stripe-refund: rejects unauthenticated requests', async () => {
  const { status } = await invoke(FN, { orderId: 'x' }, '')
  assertEquals(status, 401, 'no JWT → 401')
})

Deno.test('stripe-refund: rejects missing orderId', async () => {
  if (!CUSTOMER_JWT) return
  const { status } = await invoke(FN, {}, CUSTOMER_JWT)
  assertEquals(status, 400, 'missing orderId → 400')
})

Deno.test('stripe-refund: rejects non-existent order', async () => {
  if (!CUSTOMER_JWT) return
  const { status } = await invoke(FN, { orderId: '00000000-0000-0000-0000-000000000000' }, CUSTOMER_JWT)
  // Either 404 (not found) or 403 (not your order) — both are correct rejections
  assertEquals(status >= 400, true, 'non-existent order → 4xx')
})

Deno.test('stripe-refund: rejects orders that belong to other customers', async () => {
  const otherOrderId = Deno.env.get('TEST_OTHER_ORDER_ID')
  if (!CUSTOMER_JWT || !otherOrderId) return
  const { status } = await invoke(FN, { orderId: otherOrderId }, CUSTOMER_JWT)
  assertEquals(status, 403, 'other customer\'s order → 403')
})

Deno.test('stripe-refund: success response has refunded field', async () => {
  const testOrderId = Deno.env.get('TEST_DELIVERED_ORDER_ID')
  if (!CUSTOMER_JWT || !testOrderId) return
  const { status, data } = await invoke(FN, { orderId: testOrderId }, CUSTOMER_JWT)
  assertEquals(status, 200, 'valid request → 200')
  assertHasKeys(data, ['refunded'], 'stripe-refund response shape')
})
