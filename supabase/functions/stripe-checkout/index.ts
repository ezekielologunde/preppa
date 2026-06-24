// Creates a Stripe Checkout Session for an order. Two modes:
//  - default: hosted page (returns { url }) — used by native, and as fallback
//  - embedded: in-app Checkout (returns { clientSecret, pk }) — the customer
//    pays inside Preppa, no redirect. Same session type, same webhook.
// Called by the signed-in customer right after their order row is created.
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, readBody, errorResponse, checkRateLimit } from '../_shared/security.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const SITE = Deno.env.get('SITE_URL') ?? 'https://app.preppa.live';
const cents = (n: unknown) => Math.round(Number(n ?? 0) * 100);

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

    const allowed = await checkRateLimit(supabase, user.id, 'stripe-checkout', 5);
    if (!allowed) return errorResponse('Too many requests', 429, req);

    const { type } = body as { type?: string };

    // ── bid_payment: customer pays an accepted meal-request bid ──────────────
    if (type === 'bid_payment') {
      const { bidId } = body as { bidId?: string };
      if (!bidId) return errorResponse('Missing bidId', 400, req);

      const { data: bid, error: berr } = await supabase
        .from('meal_request_bids')
        .select('id, request_id, prepper_id, price_per_serving, status')
        .eq('id', bidId)
        .single();
      if (berr || !bid) return errorResponse('Bid not found', 404, req);
      if (bid.status !== 'accepted') return errorResponse('Bid is not in accepted state', 409, req);

      const { data: mealReq, error: rerr } = await supabase
        .from('meal_requests')
        .select('id, customer_id, title, servings')
        .eq('id', bid.request_id)
        .single();
      if (rerr || !mealReq) return errorResponse('Meal request not found', 404, req);
      if (mealReq.customer_id !== user.id) return errorResponse('Not your request', 403, req);

      const bidTotal = bid.price_per_serving * mealReq.servings;
      const serviceFee = Math.max(Math.round(bidTotal * 0.10 * 100) / 100, 1.50);

      const line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: mealReq.title ?? 'Meal prep bid' },
            unit_amount: Math.round(bidTotal * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Platform fee (10%)' },
            unit_amount: Math.round(serviceFee * 100),
          },
          quantity: 1,
        },
      ];

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items,
        success_url: `preppa://bid-payment-success?bid_id=${bidId}`,
        cancel_url: `preppa://bid-payment-cancel?bid_id=${bidId}`,
        client_reference_id: bidId,
        metadata: { type: 'bid_payment', bid_id: bidId, user_id: user.id, request_id: bid.request_id },
        payment_intent_data: { metadata: { type: 'bid_payment', bid_id: bidId, user_id: user.id, request_id: bid.request_id } },
        customer_email: user.email ?? undefined,
      }, { idempotencyKey: `bid-checkout-${bidId}` });

      return json({ url: session.url }, 200, req);
    }

    // ── default: hosted checkout for a regular order ─────────────────────────
    const { orderId, embedded } = body as { orderId?: string; embedded?: boolean };
    if (!orderId) return errorResponse('Missing orderId', 400, req);

    const { data: order, error: oerr } = await supabase
      .from('orders')
      .select('id, customer_id, total, delivery_fee, tip, status, gift_card_code, gift_card_amount, items:order_items(quantity, unit_price, meal:meals(title))')
      .eq('id', orderId)
      .single();
    if (oerr || !order) return errorResponse('Order not found', 404, req);
    if (order.customer_id !== user.id) return errorResponse('Not your order', 403, req);
    if (order.status === 'cancelled') return errorResponse('Order was cancelled', 409, req);

    const { data: existing } = await supabase.from('payments').select('status').eq('order_id', orderId).maybeSingle();
    if (existing?.status === 'succeeded') return errorResponse('Order already paid', 409, req);

    type Item = { quantity: number; unit_price: number; meal: { title?: string } | { title?: string }[] | null };
    const items = (order.items ?? []) as Item[];
    const line_items = items.map((it) => {
      const meal = Array.isArray(it.meal) ? it.meal[0] : it.meal;
      return {
        price_data: { currency: 'usd', product_data: { name: meal?.title ?? 'Meal' }, unit_amount: cents(it.unit_price) },
        quantity: it.quantity,
      };
    });
    if (Number(order.delivery_fee) > 0)
      line_items.push({ price_data: { currency: 'usd', product_data: { name: 'Delivery fee' }, unit_amount: cents(order.delivery_fee) }, quantity: 1 });
    if (Number(order.tip) > 0)
      line_items.push({ price_data: { currency: 'usd', product_data: { name: 'Tip for your prepper' }, unit_amount: cents(order.tip) }, quantity: 1 });
    if (line_items.length === 0) return errorResponse('Order has no items', 400, req);

    // Gift card partial discount — re-validate card, then create a one-off Stripe coupon
    const gcAmount = Number(order.gift_card_amount ?? 0);
    let discounts: { coupon: string }[] | undefined;
    if (gcAmount > 0 && order.gift_card_code) {
      const { data: card } = await supabase
        .from('gift_cards')
        .select('balance, is_active, expires_at')
        .eq('code', order.gift_card_code)
        .single();
      const expired = card?.expires_at && new Date(card.expires_at) < new Date();
      const validAmount = card && card.is_active && !expired && (card.balance ?? 0) > 0
        ? Math.min(gcAmount, card.balance)
        : 0;
      if (validAmount > 0) {
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(validAmount * 100),
          currency: 'usd',
          duration: 'once',
          name: `Gift card (${order.gift_card_code})`,
        });
        discounts = [{ coupon: coupon.id }];
      } else {
        console.warn('gift card invalid or exhausted at checkout — skipping discount', order.gift_card_code);
      }
    }

    const common = {
      mode: 'payment' as const,
      line_items,
      discounts,
      client_reference_id: orderId,
      metadata: { order_id: orderId },
      payment_intent_data: { metadata: { order_id: orderId } },
      customer_email: user.email ?? undefined,
    };
    const session = embedded
      ? await stripe.checkout.sessions.create({
          ...common,
          ui_mode: 'embedded',
          return_url: `${SITE}/orders?paid=1`,
        }, { idempotencyKey: `order-checkout-${orderId}` })
      : await stripe.checkout.sessions.create({
          ...common,
          success_url: `${SITE}/orders?paid=1`,
          cancel_url: `${SITE}/cart?canceled=1`,
        }, { idempotencyKey: `order-checkout-${orderId}` });

    await supabase.rpc('record_payment', { p_order_id: orderId, p_txn: session.id, p_status: 'pending', p_amount: Number(order.total) });
    if (embedded) {
      return json({ clientSecret: session.client_secret, pk: Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? null }, 200, req);
    }
    return json({ url: session.url }, 200, req);
  } catch (e) {
    console.error('[stripe-checkout] error:', e instanceof Error ? e.message : e);
    return json({ error: 'internal_error' }, 500, req);
  }
});
