// Contract: stripe-connect
// Actions: create_account, get_onboarding_link, get_dashboard_link, sync_status
// Input:   { action: string, prepper_id: string }
// Output:  { account_id } | { url } | { status, charges_enabled, payouts_enabled }
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { invoke, assertStatus, assertHasKeys, PREPPER_JWT } from './helpers.ts'

const FN = 'stripe-connect'
const PREPPER_ID = Deno.env.get('TEST_PREPPER_ID') ?? ''

Deno.test('stripe-connect: rejects unauthenticated requests', async () => {
  const { status } = await invoke(FN, { action: 'create_account', prepper_id: 'x' }, '')
  assertEquals(status, 401, 'no JWT → 401')
})

Deno.test('stripe-connect: rejects missing action', async () => {
  if (!PREPPER_JWT || !PREPPER_ID) return
  const { status } = await invoke(FN, { prepper_id: PREPPER_ID }, PREPPER_JWT)
  assertEquals(status, 400, 'missing action → 400')
})

Deno.test('stripe-connect: rejects mismatched prepper_id', async () => {
  if (!PREPPER_JWT) return
  const { status } = await invoke(FN, { action: 'create_account', prepper_id: 'someone-elses-id' }, PREPPER_JWT)
  assertEquals(status, 403, 'prepper_id mismatch → 403 (not your account)')
})

Deno.test('stripe-connect: create_account returns account_id', async () => {
  if (!PREPPER_JWT || !PREPPER_ID) return
  const { status, data } = await invoke(FN, { action: 'create_account', prepper_id: PREPPER_ID }, PREPPER_JWT)
  assertEquals(status, 200, 'create_account → 200')
  assertHasKeys(data, ['account_id'], 'stripe-connect create_account response')
})

Deno.test('stripe-connect: get_onboarding_link returns url', async () => {
  if (!PREPPER_JWT || !PREPPER_ID) return
  const { status, data } = await invoke(FN, { action: 'get_onboarding_link', prepper_id: PREPPER_ID }, PREPPER_JWT)
  assertEquals(status, 200, 'get_onboarding_link → 200')
  assertHasKeys(data, ['url'], 'stripe-connect onboarding response')
})

Deno.test('stripe-connect: sync_status returns status fields', async () => {
  if (!PREPPER_JWT || !PREPPER_ID) return
  const { status, data } = await invoke(FN, { action: 'sync_status', prepper_id: PREPPER_ID }, PREPPER_JWT)
  assertEquals(status, 200, 'sync_status → 200')
  assertHasKeys(data, ['status'], 'stripe-connect sync_status response')
})
