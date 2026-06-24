// Creates a Stripe Checkout Session for a listing boost.
// Accepts { prepperId, plan, amountCents, durationLabel } and returns { url }.
// On webhook success the boosts row should be confirmed; optimistically the
// client inserts with status 'active' immediately after the browser returns.
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, errorResponse, readBody } from '../_shared/security.ts';

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

    const BOOST_PRICES_CENTS: Record<string, number> = {
      '7d': 999,
      '30d': 2999,
    };

    let body: Record<string, unknown>;
    try { body = await readBody(req, 8 * 1024) as Record<string, unknown>; }
    catch (e) { return errorResponse(e instanceof Error ? e.message : 'Invalid request', 400, req); }
    const { prepperId, plan, durationLabel } = body as { prepperId?: string; plan?: string; durationLabel?: string };
    if (!prepperId || !plan) return errorResponse('Missing prepperId or plan', 400, req);
    if (!(plan in BOOST_PRICES_CENTS)) return errorResponse('Invalid boost plan', 400, req);
    const amountCents = BOOST_PRICES_CENTS[plan];

    // Verify the prepper belongs to the authed user.
    const { data: pp } = await supabase
      .from('prepper_profiles')
      .select('id')
      .eq('id', prepperId)
      .eq('user_id', user.id)
      .single();
    if (!pp) return errorResponse('Forbidden', 403, req);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Boost: ${plan} · ${durationLabel ?? ''}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      metadata: { type: 'boost', prepper_id: prepperId, plan, amount_cents: String(amountCents) },
      payment_intent_data: {
        metadata: { type: 'boost', prepper_id: prepperId, plan },
        idempotency_key: `boost-${prepperId}-${plan}`,
      },
      customer_email: user.email ?? undefined,
      success_url: `${SITE}/prepper-hub?boosted=1`,
      cancel_url: `${SITE}/boost`,
    });

    return json({ url: session.url }, 200, req);
  } catch (e) {
    console.error('[stripe-boost] error:', e instanceof Error ? e.message : e);
    return errorResponse('internal_error', 500, req);
  }
});
