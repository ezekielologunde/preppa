// Sends an Expo push notification to one or multiple users' registered device(s).
// Single:  POST { user_id: string,   title, body, data? }  → { ok: true, sent: n }
// Batch:   POST { user_ids: string[], title, body, data? }  → { ok: true, sent: n }
// Requires service-role key (internal callers) or admin JWT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, readBody, errorResponse } from '../_shared/security.ts';

const MAX_USER_IDS = 500;

Deno.serve(async (req) => {
  const corsResp = cors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Require authentication — service-role key (internal callers) or admin JWT
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) return errorResponse('Not authenticated', 401, req);
    const isServiceRole = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!isServiceRole) {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return errorResponse('Not authenticated', 401, req);
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: isAdmin } = await userClient.rpc('is_admin');
      if (!isAdmin) return errorResponse('Forbidden', 403, req);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await readBody(req, 32 * 1024) as Record<string, unknown>;
    } catch (e) {
      return errorResponse(e instanceof Error ? e.message : 'Invalid request', 400, req);
    }

    const { title, body, data } = payload as { title?: string; body?: string; data?: Record<string, unknown> };
    if (!title || !body) return errorResponse('Missing title or body', 400, req);

    // Resolve the target user ID list — accept either user_id (single) or user_ids (batch).
    const userIds: string[] = Array.isArray(payload.user_ids)
      ? (payload.user_ids as string[]).filter(Boolean)
      : payload.user_id
        ? [payload.user_id as string]
        : [];
    if (userIds.length === 0) return errorResponse('Missing user_id or user_ids', 400, req);
    if (userIds.length > MAX_USER_IDS) return errorResponse(`user_ids exceeds maximum of ${MAX_USER_IDS}`, 400, req);

    const { data: rows, error } = userIds.length === 1
      ? await supabase.from('push_tokens').select('token').eq('user_id', userIds[0])
      : await supabase.from('push_tokens').select('token').in('user_id', userIds);
    if (error) {
      console.error('[notify] token fetch error:', error.message);
      return errorResponse('internal_error', 500, req);
    }
    if (!rows || rows.length === 0) return json({ ok: true, sent: 0 }, 200, req);

    const messages = (rows as { token: string }[]).map((r) => ({
      to: r.token,
      title,
      body,
      data: data ?? {},
      sound: 'default',
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    return json({ ok: true, sent: messages.length }, 200, req);
  } catch (e) {
    console.error('[notify] error:', e instanceof Error ? e.message : e);
    return json({ error: 'internal_error' }, 500, req);
  }
});
