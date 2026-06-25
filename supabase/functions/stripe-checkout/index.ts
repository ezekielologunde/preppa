// stripe-checkout — collects payment for an existing order (current schema 001-039).
// Separate charges & transfers model: the customer is charged on the PLATFORM
// account here (funds held in platform balance); on verified-fulfilment escrow
// release, stripe-transfer moves the prepper's share to their Connect account.
//
// Flow: create_order (RPC) makes the order + a 'pending' payment, then the app
// calls this to pay. On payment_intent.succeeded the webhook calls
// record_payment_capture → payments.in_escrow.
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, readBody, errorResponse, checkRateLimit } from '../_shared/security.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const SITE = Deno.env.get('SITE_URL') ?? 'https://app.preppa.live';

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

    if (!(await checkRateLimit(supabase, user.id, 'stripe-checkout', 5))) {
      return errorResponse('Too many requests', 429, req);
    }

    const { order_id, embedded } = body as { order_id?: string; embedded?: boolean };
    if (!order_id) return errorResponse('Missing order_id', 400, req);

    // Load the order on the current schema; ownership + state checks.
    const { data: order, error: oerr } = await supabase
      .from('orders')
      .select('id, customer_id, total_pence, status, escrow_status')
      .eq('id', order_id)
      .single();
    if (oerr || !order) return errorResponse('Order not found', 404, req);
    if (order.customer_id !== user.id) return errorResponse('Not your order', 403, req);
    if (order.status === 'cancelled') return errorResponse('Order was cancelled', 409, req);

    // Idempotent: already paid → nothing to do.
    const { data: payment } = await supabase
      .from('payments').select('status').eq('order_id', order_id).maybeSingle();
    if (payment && ['captured', 'in_escrow', 'released'].includes(payment.status)) {
      return errorResponse('Order already paid', 409, req);
    }

    const common = {
      mode: 'payment' as const,
      line_items: [{
        price_data: {
          currency:     'gbp',
          product_data: { name: 'Preppa order', description: `Order ${order_id.slice(0, 8)}` },
          unit_amount:  order.total_pence as number,
        },
        quantity: 1,
      }],
      client_reference_id: order_id,
      metadata:            { order_id },
      payment_intent_data: { metadata: { order_id } },  // so payment_intent.* carries order_id
      customer_email:      user.email ?? undefined,
    };

    const session = embedded
      ? await stripe.checkout.sessions.create(
          { ...common, ui_mode: 'embedded', return_url: `${SITE}/order/${order_id}?paid=1` },
          { idempotencyKey: `checkout-${order_id}` })
      : await stripe.checkout.sessions.create(
          { ...common, success_url: `${SITE}/order/${order_id}?paid=1`, cancel_url: `${SITE}/order/${order_id}?canceled=1` },
          { idempotencyKey: `checkout-${order_id}` });

    if (embedded) {
      return json({ clientSecret: session.client_secret, pk: Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? null }, 200, req);
    }
    return json({ url: session.url }, 200, req);
  } catch (e) {
    console.error('[stripe-checkout] error:', e instanceof Error ? e.message : e);
    return json({ error: 'internal_error' }, 500, req);
  }
});
