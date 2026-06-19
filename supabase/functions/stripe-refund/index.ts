// Refunds an order's payment. Safe to call on any cancellation: it no-ops
// unless there is a succeeded Stripe payment. Caller must be the order's
// customer, the order's prepper, or an admin.
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, readBody, errorResponse, checkRateLimit } from '../_shared/security.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const corsResp = cors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !user) return errorResponse('Not authenticated', 401, req);

    let body: Record<string, unknown>;
    try {
      body = await readBody(req, 16 * 1024) as Record<string, unknown>;
    } catch (e) {
      return errorResponse(e instanceof Error ? e.message : 'Invalid request', 400, req);
    }

    const allowed = await checkRateLimit(supabase, user.id, 'stripe-refund', 3);
    if (!allowed) return errorResponse('Too many requests', 429, req);

    const { orderId } = body as { orderId?: string };
    if (!orderId) return errorResponse('Missing orderId', 400, req);

    const { data: order } = await supabase
      .from('orders')
      .select('id, customer_id, prepper:prepper_profiles(user_id)')
      .eq('id', orderId)
      .single();
    if (!order) return errorResponse('Order not found', 404, req);

    const prepper = Array.isArray(order.prepper) ? order.prepper[0] : order.prepper;
    const { data: adminRows } = await supabase
      .from('user_roles')
      .select('roles(key)')
      .eq('user_id', user.id);
    const isAdmin = (adminRows ?? []).some((r: { roles: { key?: string } | { key?: string }[] | null }) => {
      const roles = Array.isArray(r.roles) ? r.roles : r.roles ? [r.roles] : [];
      return roles.some((x) => x.key === 'admin');
    });
    const isAllowed = order.customer_id === user.id || prepper?.user_id === user.id || isAdmin;
    if (!isAllowed) return errorResponse('Not allowed', 403, req);

    const { data: payment } = await supabase
      .from('payments')
      .select('transaction_id, amount, status')
      .eq('order_id', orderId)
      .maybeSingle();
    if (!payment || payment.status !== 'succeeded' || !payment.transaction_id) {
      return json({ refunded: false, reason: 'nothing to refund' }, 200, req);
    }

    await stripe.refunds.create({ payment_intent: payment.transaction_id });
    await supabase.rpc('record_refund', { p_order_id: orderId, p_amount: Number(payment.amount), p_reason: 'order cancelled' });
    return json({ refunded: true }, 200, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Refund failed' }, 500, req);
  }
});
