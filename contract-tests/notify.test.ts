// Contract: notify-order-placed (representative of all notify-* functions)
// These are internal functions called by webhooks/triggers, not by users directly.
// All notify functions reject requests that lack the service-role key header.
// They do NOT accept user JWTs — they run server-side only.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { invoke, CUSTOMER_JWT } from './helpers.ts'

Deno.test('notify-order-placed: rejects user JWT (must be internal only)', async () => {
  if (!CUSTOMER_JWT) return
  const { status } = await invoke('notify-order-placed', { order_id: 'x' }, CUSTOMER_JWT)
  // Should reject — this function is not callable by end users
  assertEquals(status >= 400, true, 'user JWT → 4xx')
})

Deno.test('notify-order-status: rejects user JWT', async () => {
  if (!CUSTOMER_JWT) return
  const { status } = await invoke('notify-order-status', { order_id: 'x', status: 'confirmed' }, CUSTOMER_JWT)
  assertEquals(status >= 400, true, 'user JWT → 4xx')
})

Deno.test('notify-emergency-request: rejects user JWT', async () => {
  if (!CUSTOMER_JWT) return
  const { status } = await invoke('notify-emergency-request', { request_id: 'x' }, CUSTOMER_JWT)
  assertEquals(status >= 400, true, 'user JWT → 4xx')
})
