// Contract: stripe-checkout
// Input:  { listing_id: string, quantity: number }
//         { type: 'bid_payment', bidId: string }
// Output: { url: string } | { clientSecret: string, pk: string }
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { invoke, assertStatus, assertHasKeys, CUSTOMER_JWT } from './helpers.ts'

const FN = 'stripe-checkout'

Deno.test('stripe-checkout: rejects unauthenticated requests', async () => {
  const { status } = await invoke(FN, { listing_id: 'x', quantity: 1 }, '')
  assertEquals(status, 401, 'no JWT → 401')
})

Deno.test('stripe-checkout: rejects missing listing_id', async () => {
  if (!CUSTOMER_JWT) return
  const { status } = await invoke(FN, { quantity: 1 }, CUSTOMER_JWT)
  assertEquals(status, 400, 'missing listing_id → 400')
})

Deno.test('stripe-checkout: rejects quantity < 1', async () => {
  if (!CUSTOMER_JWT) return
  const { status } = await invoke(FN, { listing_id: 'fake-id', quantity: 0 }, CUSTOMER_JWT)
  assertEquals(status, 400, 'quantity 0 → 400')
})

Deno.test('stripe-checkout: bid_payment rejects missing bidId', async () => {
  if (!CUSTOMER_JWT) return
  const { status } = await invoke(FN, { type: 'bid_payment' }, CUSTOMER_JWT)
  assertEquals(status, 400, 'bid_payment without bidId → 400')
})

Deno.test('stripe-checkout: success response has url', async () => {
  if (!CUSTOMER_JWT) return
  // Uses a known-good test listing_id seeded in local Supabase
  const testListingId = Deno.env.get('TEST_LISTING_ID')
  if (!testListingId) return
  const { status, data } = await invoke(FN, { listing_id: testListingId, quantity: 1 }, CUSTOMER_JWT)
  assertEquals(status, 200, 'valid request → 200')
  assertHasKeys(data, ['url'], 'stripe-checkout response')
  const url = (data as { url: string }).url
  assertEquals(typeof url, 'string', 'url is a string')
  assertEquals(url.startsWith('https://'), true, 'url is https')
})
