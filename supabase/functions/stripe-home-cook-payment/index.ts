// Creates a Stripe PaymentIntent with capture_method:'manual' for a confirmed
// home cook booking. The hold is placed on the customer's card at booking time;
// funds are captured when the session completes (prepper marks order complete,
// then the stripe-webhook calls capturePaymentIntent).
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
    const { requestId, orderId } = body as { requestId?: string; orderId?: string };
    if (!requestId || !orderId) {
      return errorResponse('Missing requestId or orderId', 400, req);
    }

    // Verify the request belongs to this customer and is confirmed
    const { data: hcr, error: hcrerr } = await supabase
      .from('home_cook_requests')
      .select('id, customer_id, order_id, status, payment_intent_id, ingredient_budget, cooking_fee, travel_fee')
      .eq('id', requestId)
      .single();
    if (hcrerr || !hcr) return errorResponse('Home cook request not found', 404, req);
    if (hcr.customer_id !== user.id) return errorResponse('Forbidden', 403, req);
    if (hcr.status !== 'confirmed') return errorResponse('Request is not confirmed', 409, req);
    if (hcr.order_id !== orderId) return errorResponse('Order ID mismatch', 400, req);

    if (hcr.cooking_fee == null) return errorResponse('Prepper has not proposed fees yet', 409, req);
    const totalDollars = Number(hcr.ingredient_budget) + Number(hcr.cooking_fee) + Number(hcr.travel_fee ?? 0);
    const amountCents = Math.round(totalDollars * 100);
    if (amountCents < 100) return errorResponse('Computed amount is too low', 500, req);

    // Idempotent: if a payment intent already exists, return it
    if (hcr.payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(hcr.payment_intent_id);
      return json({ clientSecret: existing.client_secret, paymentIntentId: existing.id }, 200, req);
    }

    // Look up or create a Stripe customer for this user
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    let stripeCustomerId: string | undefined = profile?.stripe_customer_id ?? undefined;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_uid: user.id },
      });
      stripeCustomerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: stripeCustomerId }).eq('id', user.id);
    }

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      capture_method: 'manual',
      setup_future_usage: 'off_session',
      metadata: {
        supabase_uid: user.id,
        order_id: orderId,
        home_cook_request_id: requestId,
        type: 'home_cook',
      },
      description: 'Home cook session hold — captured on completion',
    }, { idempotencyKey: `home-cook-pi-${requestId}` });

    return json({ clientSecret: intent.client_secret, paymentIntentId: intent.id }, 200, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return errorResponse(msg, 500, req);
  }
});
