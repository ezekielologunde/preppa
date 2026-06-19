// Notifies the prepper when a customer places a new order.
// POST { order_id, prepper_id, customer_name, meal_count, total }
// Checks notification_preferences before sending; skips silently if disabled or no token.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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
    const { order_id, prepper_id, customer_name, meal_count, total } = await req.json();
    if (!order_id || !prepper_id) return json({ error: 'Missing order_id or prepper_id' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Respect the prepper's notification preferences (default: send if no row yet).
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_enabled, order_updates')
      .eq('user_id', prepper_id)
      .maybeSingle();
    if (prefs && (!prefs.push_enabled || !prefs.order_updates)) {
      return json({ sent: false, reason: 'notifications_disabled' });
    }

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', prepper_id);
    if (!tokens?.length) return json({ sent: false, reason: 'no_token' });

    const count = Number(meal_count ?? 1);
    const amount = Number(total ?? 0).toFixed(2);
    const messages = (tokens as { token: string }[]).map(({ token }) => ({
      to: token,
      title: 'New order!',
      body: `${customer_name ?? 'A customer'} ordered ${count} meal${count !== 1 ? 's' : ''} · $${amount}`,
      data: { screen: 'order', orderId: order_id },
      sound: 'default',
      badge: 1,
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
    });
    const result = await res.json();
    return json({ sent: true, result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'notify-order-placed failed' }, 500);
  }
});
