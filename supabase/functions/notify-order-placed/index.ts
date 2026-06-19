// Notifies the prepper when a customer places a new order.
// POST { order_id, customer_name, meal_count, total }
// Caller must be the customer on the order (JWT verified, ownership checked).
// Checks notification_preferences before sending; skips silently if disabled or no token.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, errorResponse, readBody, getUser } from '../_shared/security.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  const preflight = cors(req);
  if (preflight) return preflight;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const user = await getUser(req, supabase);
    if (!user) return errorResponse('Unauthorized', 401);

    const body = await readBody(req) as Record<string, unknown>;
    const orderId = body.order_id;
    if (!orderId || typeof orderId !== 'string') {
      return errorResponse('Missing order_id', 400);
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_id, prepper_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return errorResponse('Order not found', 404);
    if (order.customer_id !== user.id) return errorResponse('Forbidden', 403);

    const prepperId = order.prepper_id as string;

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_enabled, order_updates')
      .eq('user_id', prepperId)
      .maybeSingle();
    if (prefs && (!prefs.push_enabled || !prefs.order_updates)) {
      return json({ sent: false, reason: 'notifications_disabled' });
    }

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', prepperId);
    if (!tokens?.length) return json({ sent: false, reason: 'no_token' });

    const customerName = typeof body.customer_name === 'string' ? body.customer_name : 'A customer';
    const count = Number(body.meal_count ?? 1);
    const amount = Number(body.total ?? 0).toFixed(2);

    const messages = (tokens as { token: string }[]).map(({ token }) => ({
      to: token,
      title: 'New order!',
      body: `${customerName} ordered ${count} meal${count !== 1 ? 's' : ''} · $${amount}`,
      data: { screen: 'order', orderId },
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
    return errorResponse(e instanceof Error ? e.message : 'notify-order-placed failed', 500);
  }
});
