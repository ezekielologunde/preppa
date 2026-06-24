// Sends rush-hour marketing push notifications to opted-in customers.
//
// Called at the start of each rush window by pg_cron (or manually):
//   select cron.schedule('rush-morning', '0 7 * * *',  $$select net.http_post(url:=..., body:=...) $$);
//   select cron.schedule('rush-lunch',   '0 11 * * *', $$select net.http_post(url:=..., body:=...) $$);
//   select cron.schedule('rush-dinner',  '0 16 * * *', $$select net.http_post(url:=..., body:=...) $$);
//
// Auth: service-role key in Authorization header (called server-to-server only).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, errorResponse } from '../_shared/security.ts';

type RushId = 'morning' | 'lunch' | 'dinner';

type RushWindow = {
  id: RushId;
  label: string;
  start: number;
  end: number;
  emoji: string;
  title: string;
  body: string;
  route: string;
};

const RUSH_WINDOWS: RushWindow[] = [
  {
    id: 'morning',
    label: 'morning prep',
    start: 7,
    end: 10,
    emoji: '☀️',
    title: '☀️ Morning drop is live',
    body: 'Fresh breakfast from local kitchens. Preorder before 10 am.',
    route: '/specials',
  },
  {
    id: 'lunch',
    label: 'lunch rush',
    start: 11,
    end: 14,
    emoji: '🍱',
    title: '🍱 Lunch rush is on',
    body: 'Top kitchens near you are live — preorder for 12–2 pm.',
    route: '/',
  },
  {
    id: 'dinner',
    label: 'dinner window',
    start: 16,
    end: 20,
    emoji: '🌆',
    title: "🌆 What's for dinner?",
    body: 'Your neighbourhood kitchens are live — preorder for 6–7 pm.',
    route: '/',
  },
];

function getCurrentRush(hour: number): RushWindow | null {
  return RUSH_WINDOWS.find((w) => hour >= w.start && hour < w.end) ?? null;
}

Deno.serve(async (req) => {
  const corsResp = cors(req);
  if (corsResp) return corsResp;

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (token !== serviceKey) return errorResponse('Not authenticated', 401, req);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

    // Determine which rush window is active right now.
    const hour = new Date().getUTCHours();
    const rush = getCurrentRush(hour);
    if (!rush) {
      return json({ ok: true, sent: 0, reason: 'No active rush window at this hour' }, 200, req);
    }

    // Query push tokens for customers who have promotions enabled.
    // Joins push_tokens → notification_prefs, filter promotions=true and push_enabled=true.
    const { data: tokenRows, error } = await supabase
      .from('push_tokens')
      .select('token, user_id, notification_prefs!inner(push_enabled, promotions)')
      .eq('notification_prefs.push_enabled', true)
      .eq('notification_prefs.promotions', true)
      .limit(500);

    if (error) {
      console.error('[notify-rush-hour] token query error:', error.message);
      return errorResponse('internal_error', 500, req);
    }
    if (!tokenRows || tokenRows.length === 0) {
      return json({ ok: true, sent: 0, reason: 'No opted-in tokens found' }, 200, req);
    }

    const messages = (tokenRows as any[]).map((r) => ({
      to: r.token,
      title: rush.title,
      body: rush.body,
      data: { route: rush.route, rush: rush.id },
      sound: 'default',
    }));

    // Expo push API accepts up to 100 messages per request — chunk if needed.
    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

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

    return json({ ok: true, sent, rush: rush.id }, 200, req);
  } catch (e) {
    console.error('[notify-rush-hour] error:', e instanceof Error ? e.message : e);
    return json({ error: 'internal_error' }, 500, req);
  }
});
