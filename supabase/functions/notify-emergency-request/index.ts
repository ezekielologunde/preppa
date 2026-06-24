// Sends push notifications to all approved preppers when a customer submits an emergency food request.
// Auth: any valid user JWT (caller must be signed in).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, readBody, errorResponse } from '../_shared/security.ts';

Deno.serve(async (req) => {
  const corsResp = cors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) return errorResponse('Not authenticated', 401, req);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return errorResponse('Not authenticated', 401, req);

    let payload: Record<string, unknown> = {};
    try { payload = await readBody(req, 8 * 1024) as Record<string, unknown>; } catch { /* no body */ }

    const urgencyLabel = (payload.urgencyLabel as string | undefined) ?? 'soon';
    const cuisine = (payload.cuisine as string | undefined) ?? '';

    // Step 1: approved prepper user IDs
    const { data: preppers, error: prepperErr } = await supabase
      .from('preppers')
      .select('user_id')
      .eq('status', 'approved')
      .limit(500);
    if (prepperErr) {
      console.error('[notify-emergency-request] prepper query error:', prepperErr.message);
      return errorResponse('internal_error', 500, req);
    }
    if (!preppers || preppers.length === 0) return json({ ok: true, sent: 0, reason: 'No approved preppers' }, 200, req);

    const userIds = (preppers as { user_id: string }[]).map((p) => p.user_id).filter(Boolean);

    // Step 2: push tokens for those preppers (honour push_enabled pref)
    const { data: rows, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('token, notification_prefs!left(push_enabled)')
      .in('user_id', userIds)
      .limit(500);
    if (tokenErr) {
      console.error('[notify-emergency-request] token query error:', tokenErr.message);
      return errorResponse('internal_error', 500, req);
    }
    if (!rows || rows.length === 0) return json({ ok: true, sent: 0, reason: 'No push tokens found' }, 200, req);

    const eligibleTokens = (rows as any[])
      .filter((r) => {
        const pref = Array.isArray(r.notification_prefs) ? r.notification_prefs[0] : r.notification_prefs;
        return pref?.push_enabled !== false;
      })
      .map((r) => r.token as string);

    if (eligibleTokens.length === 0) return json({ ok: true, sent: 0, reason: 'No opted-in tokens' }, 200, req);

    const cuisineText = cuisine && cuisine !== 'anything' ? ` — ${cuisine}` : '';
    const messages = eligibleTokens.map((token) => ({
      to: token,
      title: '🚨 Emergency food request',
      body: `Someone needs food in ${urgencyLabel}${cuisineText}. Tap to respond.`,
      data: { route: '/prepper-orders', tab: 'homecook' },
      sound: 'default',
      priority: 'high',
    }));

    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

    let sent = 0;
    for (const chunk of chunks) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(chunk),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      sent += chunk.length;
    }

    return json({ ok: true, sent }, 200, req);
  } catch (e) {
    console.error('[notify-emergency-request] error:', e instanceof Error ? e.message : e);
    return json({ error: 'internal_error' }, 500, req);
  }
});
