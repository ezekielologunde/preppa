// Creates a Stripe Checkout Session for a listing boost.
// Accepts { prepperId, plan, amountCents, durationLabel } and returns { url }.
// On webhook success the boosts row should be confirmed; optimistically the
// client inserts with status 'active' immediately after the browser returns.
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const SITE = Deno.env.get('SITE_URL') ?? 'https://app.preppa.live';
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
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !user) return json({ error: 'Not authenticated' }, 401);

    const { prepperId, plan, amountCents, durationLabel } = await req.json().catch(() => ({}));
    if (!prepperId || !plan || !amountCents) return json({ error: 'Missing prepperId, plan, or amountCents' }, 400);

    // Verify the prepper belongs to the authed user.
    const { data: pp } = await supabase
      .from('prepper_profiles')
      .select('id')
      .eq('id', prepperId)
      .eq('user_id', user.id)
      .single();
    if (!pp) return json({ error: 'Forbidden' }, 403);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Boost: ${plan} · ${durationLabel ?? ''}` },
          unit_amount: Number(amountCents),
        },
        quantity: 1,
      }],
      metadata: { type: 'boost', prepper_id: prepperId, plan, amount_cents: String(amountCents) },
      payment_intent_data: { metadata: { type: 'boost', prepper_id: prepperId, plan } },
      customer_email: user.email ?? undefined,
      success_url: `${SITE}/prepper-hub?boosted=1`,
      cancel_url: `${SITE}/boost`,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Boost checkout failed' }, 500);
  }
});
