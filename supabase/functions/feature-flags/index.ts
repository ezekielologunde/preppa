import { createClient } from 'jsr:@supabase/supabase-js@2'
import { cors } from '../_shared/security.ts'

// Feature Flags edge function
// Evaluates flags server-side. Clients receive only TRUE/FALSE — never flag config.
// Supports single and batch evaluation.
// Rate-limited to prevent enumeration attacks.

// Simple in-memory rate limit (per-worker; resets on cold start)
const RATE_MAP = new Map<string, { count: number; window: number }>()
const RATE_LIMIT = 200   // requests per minute per IP
const RATE_WINDOW = 60_000

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const entry = RATE_MAP.get(identifier)

  if (!entry || now - entry.window > RATE_WINDOW) {
    RATE_MAP.set(identifier, { count: 1, window: now })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

Deno.serve(async (req: Request) => {
  const corsResp = cors(req)
  if (corsResp) return corsResp

  // Rate limit by IP before any auth/DB work
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return json({ error: 'rate_limited' }, 429)
  }

  const auth = req.headers.get('Authorization')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    auth ? { global: { headers: { Authorization: auth } } } : {},
  )

  // Build evaluation context from the authenticated user (if any)
  const context: Record<string, unknown> = {}

  if (auth?.startsWith('Bearer ')) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      context.user_id = user.id
      // is_prepper: check if they have a kitchen row
      const { data: kitchen } = await supabase
        .from('kitchens')
        .select('id')
        .eq('prepper_id', user.id)
        .maybeSingle()
      if (kitchen) context.is_prepper = true
    }
  }

  // Merge any client-provided context (country, city, app_version)
  // These are ADVISORY ONLY — the DB evaluates; client cannot forge authorization.
  try {
    const body = req.method === 'POST' ? await req.json() : {}
    if (body.country)      context.country     = String(body.country).slice(0, 2).toUpperCase()
    if (body.city)         context.city        = String(body.city).slice(0, 100)
    if (body.postcode)     context.postcode    = String(body.postcode).slice(0, 10)
    if (body.app_version)  context.app_version = String(body.app_version).slice(0, 20)

    // Single flag evaluation: { key: 'flag_name' }
    if (body.key && typeof body.key === 'string') {
      const result = await evaluateOne(supabase, body.key, context)
      return json({ key: body.key, enabled: result })
    }

    // Batch evaluation: { keys: ['flag_a', 'flag_b'] }
    if (Array.isArray(body.keys)) {
      const keys = body.keys
        .filter((k: unknown) => typeof k === 'string')
        .slice(0, 50) as string[]  // max 50 flags per batch

      const results: Record<string, boolean> = {}
      await Promise.all(
        keys.map(async (key) => {
          results[key] = await evaluateOne(supabase, key, context)
        })
      )
      return json({ flags: results })
    }

    return json({ error: 'missing_key_or_keys' }, 400)

  } catch (err: unknown) {
    console.error('[feature-flags] error:', err instanceof Error ? err.message : err)
    return json({ error: 'internal_error' }, 500)
  }
})

async function evaluateOne(
  supabase: ReturnType<typeof createClient>,
  key: string,
  context: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('evaluate_flag', {
    p_key:     key,
    p_context: context,
  })
  if (error) return false   // fail-closed: unknown/error → false
  return data === true
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',  // flags must never be cached
    },
  })
}
