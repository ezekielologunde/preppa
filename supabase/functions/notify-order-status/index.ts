// Notifies the customer when a prepper advances an order to a new status.
// POST { order_id, status, kitchen_name }
// Caller must be the prepper on the order or an admin (JWT verified, ownership checked).
// Checks notification_preferences before sending; skips silently if disabled or no token.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, errorResponse, readBody, getUser } from '../_shared/security.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  confirmed:  { title: 'Order confirmed!',  body: 'Your kitchen accepted your order and is getting started.' },
  preparing:  { title: 'Cooking now!',      body: 'Your meal is being prepared. Sit tight!' },
  ready:      { title: 'Order ready!',      body: 'Your order is ready for pickup/delivery.' },
  completed:  { title: 'Order delivered!',  body: 'Enjoy your meal! Leave a review to help the kitchen.' },
  cancelled:  { title: 'Order cancelled',   body: 'Your order was cancelled. You have not been charged.' },
};

Deno.serve(async (req) => {
  const preflight = cors(req);
  if (preflight) return preflight;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return errorResponse('Unauthorized', 401, req);

    const user = await getUser(req, supabase);
    if (!user) return errorResponse('Unauthorized', 401, req);

    const body = await readBody(req) as Record<string, unknown>;
    const orderId = body.order_id;
    const status = body.status;
    if (!orderId || typeof orderId !== 'string') return errorResponse('Missing order_id', 400, req);
    if (!status || typeof status !== 'string') return errorResponse('Missing status', 400, req);

    const msg = STATUS_MESSAGES[status];
    if (!msg) return json({ sent: false, reason: 'status_not_notifiable' }, 200, req);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_id, prepper_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return errorResponse('Order not found', 404, req);

    const isPrepper = order.prepper_id === user.id;
    if (!isPrepper) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const { data: adminResult, error: adminError } = await userClient.rpc('is_admin');
      if (adminError || !adminResult) return errorResponse('Forbidden', 403, req);
    }

    const customerId = order.customer_id as string;

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_enabled, order_updates')
      .eq('user_id', customerId)
      .maybeSingle();
    if (prefs && (!prefs.push_enabled || !prefs.order_updates)) {
      return json({ sent: false, reason: 'notifications_disabled' }, 200, req);
    }

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', customerId);
    if (!tokens?.length) return json({ sent: false, reason: 'no_token' }, 200, req);

    const kitchenName = typeof body.kitchen_name === 'string' ? body.kitchen_name : '';
    const prefix = kitchenName ? `${kitchenName}: ` : '';
    const messages = (tokens as { token: string }[]).map(({ token: t }) => ({
      to: t,
      title: msg.title,
      body: `${prefix}${msg.body}`,
      data: { screen: 'order', orderId },
      sound: 'default',
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let result: unknown;
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
        signal: controller.signal,
      });
      result = await res.json();
    } finally {
      clearTimeout(timer);
    }
    return json({ sent: true, result }, 200, req);
  } catch (e) {
    console.error('[notify-order-status] error:', e instanceof Error ? e.message : e);
    return errorResponse('internal_error', 500, req);
  }
});
