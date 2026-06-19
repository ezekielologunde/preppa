// Sends an Expo push notification to one or multiple users' registered device(s).
// Single:  POST { user_id: string,   title, body, data? }  → { ok: true, sent: n }
// Batch:   POST { user_ids: string[], title, body, data? }  → { ok: true, sent: n }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const payload = await req.json().catch(() => ({}));
    const { title, body, data } = payload as { title?: string; body?: string; data?: Record<string, unknown> };
    if (!title || !body) return json({ error: 'Missing title or body' }, 400);

    // Resolve the target user ID list — accept either user_id (single) or user_ids (batch).
    const userIds: string[] = Array.isArray(payload.user_ids)
      ? (payload.user_ids as string[]).filter(Boolean)
      : payload.user_id
        ? [payload.user_id as string]
        : [];
    if (userIds.length === 0) return json({ error: 'Missing user_id or user_ids' }, 400);

    const { data: rows, error } = userIds.length === 1
      ? await supabase.from('push_tokens').select('token').eq('user_id', userIds[0])
      : await supabase.from('push_tokens').select('token').in('user_id', userIds);
    if (error) return json({ error: error.message }, 500);
    if (!rows || rows.length === 0) return json({ ok: true, sent: 0 });

    const messages = (rows as { token: string }[]).map((r) => ({
      to: r.token,
      title,
      body,
      data: data ?? {},
      sound: 'default',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
    });

    return json({ ok: true, sent: messages.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Notify failed' }, 500);
  }
});
