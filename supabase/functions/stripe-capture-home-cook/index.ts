// Captures the Stripe PaymentIntent hold placed at home cook booking confirmation.
// Called by the prepper after the customer verifies their PIN and the session completes.
// Idempotent — safe to call even if already captured.
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, errorResponse, readBody } from '../_shared/security.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const corsResp = cors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !user) return errorResponse('Not authenticated', 401, req);

    let body: Record<string, unknown>;
    try { body = await readBody(req, 8 * 1024) as Record<string, unknown>; }
    catch (e) { return errorResponse(e instanceof Error ? e.message : 'Invalid request', 400, req); }
    const { orderId } = body as { orderId?: string };
    if (!orderId) return errorResponse('Missing orderId', 400, req);

    // Verify caller is the prepper for this order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, prepper_id, total, fulfillment_type, status')
      .eq('id', orderId)
      .single();
    if (orderErr || !order) return errorResponse('Order not found', 404, req);

    const { data: pp } = await supabase
      .from('prepper_profiles')
      .select('id')
      .eq('id', order.prepper_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!pp) return errorResponse('Forbidden', 403, req);

    if (order.fulfillment_type !== 'home_cook') return errorResponse('Not a home cook order', 400, req);

    // Get payment intent from home_cook_requests
    const { data: hcr } = await supabase
      .from('home_cook_requests')
      .select('id, payment_intent_id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!hcr?.payment_intent_id) return errorResponse('No payment intent on record for this order', 404, req);

    // Idempotent — if already captured, return success
    const intent = await stripe.paymentIntents.retrieve(hcr.payment_intent_id);
    if (intent.status === 'succeeded') {
      return json({ captured: true, paymentIntentId: intent.id, idempotent: true }, 200, req);
    }
    if (intent.status !== 'requires_capture') {
      return errorResponse(`Payment intent in unexpected state: ${intent.status}`, 409, req);
    }

    const captured = await stripe.paymentIntents.capture(hcr.payment_intent_id);

    await supabase.rpc('record_payment', {
      p_order_id: orderId,
      p_txn: captured.id,
      p_status: 'succeeded',
      p_amount: Number(order.total),
    });

    return json({ captured: true, paymentIntentId: captured.id }, 200, req);
  } catch (err) {
    console.error('[stripe-capture-home-cook] error:', err instanceof Error ? err.message : err);
    return errorResponse('internal_error', 500, req);
  }
});
