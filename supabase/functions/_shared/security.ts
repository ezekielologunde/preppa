// Shared security utilities for Preppa edge functions.
// Import: import { cors, json, readBody, sanitize, sanitizeOptional, getUser, errorResponse, checkRateLimit } from '../_shared/security.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Handle preflight — return non-null to short-circuit the handler
export function cors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS, status: 200 });
  }
  return null;
}

// JSON response with CORS headers attached
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Structured error response helper
export function errorResponse(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

// Body size guard — prevents DOS via oversized payloads.
// Reads the raw text first (Stripe webhook uses req.text() not this helper).
export async function readBody(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > maxBytes) {
    throw new Error(`Payload too large: ${contentLength} bytes (max ${maxBytes})`);
  }
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new Error('Payload too large');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

// Sanitize a required string — trim, enforce max length, throw if empty
export function sanitize(s: unknown, maxLength = 500): string {
  if (typeof s !== 'string') throw new Error('Expected string');
  const t = s.trim();
  if (t.length === 0) throw new Error('Value must not be empty');
  if (t.length > maxLength) throw new Error(`Value too long (max ${maxLength})`);
  return t;
}

// Sanitize an optional string — returns null if absent or empty
export function sanitizeOptional(s: unknown, maxLength = 500): string | null {
  if (s == null || s === '') return null;
  return sanitize(s, maxLength);
}

// Extract user from Bearer JWT — returns null if missing or invalid
export async function getUser(
  req: Request,
  supabase: ReturnType<typeof createClient>,
) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Persisted rate limiting via Supabase rate_limit_events table.
// Returns true = request allowed; false = limit exceeded.
// The table must exist (migration 0113_rate_limit_events.sql).
export async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  maxPerWindow: number,
  windowMs = 60_000,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count } = await supabase
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= maxPerWindow) return false;

  // Record this attempt (fire-and-forget; don't let insert failure block the request)
  await supabase.from('rate_limit_events').insert({ user_id: userId, action }).catch(
    (e: unknown) => console.error('rate_limit insert failed', e instanceof Error ? e.message : e),
  );

  return true;
}

// Prune events older than olderThanMs (call opportunistically inside handlers)
export async function cleanupRateLimits(
  supabase: ReturnType<typeof createClient>,
  olderThanMs = 5 * 60_000,
): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  await supabase.from('rate_limit_events').delete().lt('created_at', cutoff).catch(
    (e: unknown) => console.error('rate_limit cleanup failed', e instanceof Error ? e.message : e),
  );
}
