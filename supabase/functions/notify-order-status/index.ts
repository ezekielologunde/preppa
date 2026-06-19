// Notifies the customer when a prepper advances an order to a new status.
// POST { order_id, customer_id, status, kitchen_name }
// Checks notification_preferences before sending; skips silently if disabled or no token.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  confirmed:  { title: 'Order confirmed!',  body: 'Your kitchen accepted your order and is getting started.' },
  preparing:  { title: 'Cooking now!',      body: 'Your meal is being prepared. Sit tight!' },
  ready:      { title: 'Order ready!',      body: 'Your order is ready for pickup/delivery.' },
  completed:  { title: 'Order delivered!',  body: 'Enjoy your meal! Leave a review to help the kitchen.' },
  cancelled:  { title: 'Order cancelled',   body: 'Your order was cancelled. You have not been charged.' },
};

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
    const { order_id, customer_id, status, kitchen_name } = await req.json();
    if (!order_id || !customer_id || !status) return json({ error: 'Missing order_id, customer_id, or status' }, 400);

    const msg = STATUS_MESSAGES[status as string];
    if (!msg) return json({ sent: false, reason: 'status_not_notifiable' });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Respect the customer's notification preferences (default: send if no row yet).
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_enabled, order_updates')
      .eq('user_id', customer_id)
      .maybeSingle();
    if (prefs && (!prefs.push_enabled || !prefs.order_updates)) {
      return json({ sent: false, reason: 'notifications_disabled' });
    }

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', customer_id);
    if (!tokens?.length) return json({ sent: false, reason: 'no_token' });

    const prefix = kitchen_name ? `${kitchen_name}: ` : '';
    const messages = (tokens as { token: string }[]).map(({ token }) => ({
      to: token,
      title: msg.title,
      body: `${prefix}${msg.body}`,
      data: { screen: 'order', orderId: order_id },
      sound: 'default',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
    });
    const result = await res.json();
    return json({ sent: true, result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'notify-order-status failed' }, 500);
  }
});
