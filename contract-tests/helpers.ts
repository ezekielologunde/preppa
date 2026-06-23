export const BASE = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321'
export const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
export const CUSTOMER_JWT = Deno.env.get('TEST_USER_JWT') ?? ''
export const PREPPER_JWT  = Deno.env.get('TEST_PREPPER_JWT') ?? ''
export const ADMIN_JWT    = Deno.env.get('TEST_ADMIN_JWT') ?? ''

export async function invoke(
  fn: string,
  body: unknown,
  jwt?: string,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE}/functions/v1/${fn}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   jwt ? `Bearer ${jwt}` : `Bearer ${ANON}`,
      apikey:          ANON,
    },
    body: JSON.stringify(body),
  })
  let data: unknown
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

export function assertStatus(
  actual: number,
  expected: number,
  context: string,
) {
  if (actual !== expected) {
    throw new Error(`${context}: expected HTTP ${expected}, got ${actual}`)
  }
}

export function assertHasKeys(obj: unknown, keys: string[], context: string) {
  if (!obj || typeof obj !== 'object') {
    throw new Error(`${context}: response is not an object`)
  }
  for (const k of keys) {
    if (!(k in (obj as Record<string, unknown>))) {
      throw new Error(`${context}: missing key "${k}" in ${JSON.stringify(obj)}`)
    }
  }
}
