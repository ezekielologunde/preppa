/**
 * Shared test helpers for chaos tests.
 * Run with: deno test --allow-env --allow-net
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const _supabaseUrl = Deno.env.get('SUPABASE_URL')
if (!_supabaseUrl) throw new Error('SUPABASE_URL is required — do not default to production')
export const SUPABASE_URL = _supabaseUrl
export const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
export const FUNCTIONS_URL   = `${SUPABASE_URL}/functions/v1`

export const db = () => createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Generates a random UUID-v4-like string for test isolation */
export function uuid(): string {
  return crypto.randomUUID()
}

/** ISO date string for today */
export function today(): string {
  return new Date().toISOString().split('T')[0]
}

/** Run N async thunks concurrently and collect results */
export async function concurrent<T>(n: number, fn: (i: number) => Promise<T>): Promise<T[]> {
  return Promise.all(Array.from({ length: n }, (_, i) => fn(i)))
}

/** Sleep for ms milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Create a minimal test prepper + kitchen row via service role (bypasses RLS) */
export async function createTestPrepper(client: ReturnType<typeof createClient>): Promise<{
  userId: string
  kitchenId: string
}> {
  const userId = uuid()
  const kitchenId = uuid()

  const { error } = await client.from('kitchens').insert({
    id:            kitchenId,
    prepper_id:    userId,
    display_name:  `chaos-test-kitchen-${kitchenId.slice(0, 8)}`,
    daily_capacity: 10,
  })
  if (error) throw new Error(`createTestPrepper failed: ${error.message}`)

  return { userId, kitchenId }
}

/** Remove test data created by chaos tests */
export async function cleanupTestPrepper(
  client: ReturnType<typeof createClient>,
  kitchenId: string,
): Promise<void> {
  await client.from('kitchen_capacity').delete().eq('kitchen_id', kitchenId)
  await client.from('kitchen_metrics').delete().eq('kitchen_id', kitchenId)
  await client.from('kitchens').delete().eq('id', kitchenId)
}
