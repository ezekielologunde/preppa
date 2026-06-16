// Creates a Stripe Checkout Session in subscription mode.
// Handles Prepper Pro, Prep+, prepper-created meal plan billing, and
// customer custom-plan billing. Webhook provisions access on completion.
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
const cents = (n: unknown) => Math.round(Number(n ?? 0) * 100);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type RecurringInterval = 'week' | 'month' | 'year';
type RecurringConfig = { interval: RecurringInterval; interval_count: number };
const FREQ: Record<string, RecurringConfig> = {
  weekly:   { interval: 'week',  interval_count: 1 },
  biweekly: { interval: 'week',  interval_count: 2 },
  monthly:  { interval: 'month', interval_count: 1 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !user) return json({ error: 'Not authenticated' }, 401);

    const { type, period, planId, prepperId, qty, deliveryDay, embedded } =
      await req.json().catch(() => ({}));
    if (!type) return json({ error: 'Missing type' }, 400);

    let amount = 0;
    let productName = '';
    let rec: RecurringConfig = FREQ.monthly;
    const meta: Record<string, string> = { type };

    if (type === 'prepper_pro') {
      if (!prepperId) return json({ error: 'Missing prepperId' }, 400);
      const { data: pp } = await supabase
        .from('prepper_profiles').select('user_id').eq('id', prepperId).single();
      if (!pp || pp.user_id !== user.id) return json({ error: 'Forbidden' }, 403);
      const yearly = period === 'yearly';
      amount      = yearly ? 24900 : 2900;
      productName = `Preppa Pro (${yearly ? 'Yearly' : 'Monthly'})`;
      rec         = { interval: yearly ? 'year' : 'month', interval_count: 1 };
      meta.prepper_id = prepperId;
      meta.period     = period ?? 'monthly';

    } else if (type === 'customer_plus') {
      const yearly = period === 'yearly';
      amount      = yearly ? 8900 : 999;
      productName = `Prep+ (${yearly ? 'Yearly' : 'Monthly'})`;
      rec         = { interval: yearly ? 'year' : 'month', interval_count: 1 };
      meta.user_id = user.id;
      meta.period  = period ?? 'monthly';

    } else if (type === 'meal_plan') {
      if (!planId) return json({ error: 'Missing planId' }, 400);
      const { data: plan } = await supabase
        .from('meal_plans')
        .select('id,name,price,frequency,prepper_id')
        .eq('id', planId).eq('active', true).single();
      if (!plan) return json({ error: 'Plan not found' }, 404);
      const servings = Math.max(1, Math.min(6, Number(qty) || 1));
      rec         = FREQ[plan.frequency] ?? FREQ.weekly;
      amount      = cents(plan.price) * servings;
      productName = `${plan.name} · ${servings} serving${servings > 1 ? 's' : ''}`;
      meta.plan_id     = planId;
      meta.prepper_id  = plan.prepper_id;
      meta.plan_name   = plan.name;
      meta.frequency   = plan.frequency;
      meta.qty         = String(servings);
      meta.delivery_day = deliveryDay ?? 'mon';
      meta.customer_id = user.id;

    } else if (type === 'custom_plan') {
      if (!planId) return json({ error: 'Missing planId' }, 400);
      type PItem = { qty: number; meal: { base_price: number } | { base_price: number }[] | null };
      const { data: plan } = await supabase
        .from('customer_meal_plans')
        .select('id,name,frequency,delivery_day,customer_id,items:customer_meal_plan_items(qty,meal:meals(base_price))')
        .eq('id', planId).eq('customer_id', user.id).single();
      if (!plan) return json({ error: 'Plan not found' }, 404);
      const planAny = plan as unknown as { name: string; frequency: string; items: PItem[] };
      let total = 0;
      for (const it of planAny.items ?? []) {
        const m = Array.isArray(it.meal) ? it.meal[0] : it.meal;
        total += (m?.base_price ?? 0) * it.qty;
      }
      if (total <= 0) return json({ error: 'Plan has no priced meals' }, 400);
      rec         = FREQ[planAny.frequency] ?? FREQ.weekly;
      amount      = cents(total);
      productName = `${planAny.name} (custom plan)`;
      meta.plan_id     = planId;
      meta.customer_id = user.id;
      meta.frequency   = planAny.frequency;

    } else {
      return json({ error: 'Unknown subscription type' }, 400);
    }

    if (amount < 50) return json({ error: 'Amount too small for Stripe' }, 400);

    const common: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          recurring: { interval: rec.interval, interval_count: rec.interval_count },
          product_data: { name: productName },
        },
        quantity: 1,
      }],
      subscription_data: { metadata: meta },
      metadata: meta,
      customer_email: user.email ?? undefined,
    };

    const session = embedded
      ? await stripe.checkout.sessions.create({
          ...common, ui_mode: 'embedded',
          return_url: `${SITE}/meal-plans?subscribed=1`,
        })
      : await stripe.checkout.sessions.create({
          ...common,
          success_url: `${SITE}/meal-plans?subscribed=1`,
          cancel_url:  `${SITE}/meal-plans`,
        });

    if (embedded) {
      return json({ clientSecret: session.client_secret, pk: Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? null });
    }
    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Subscription setup failed' }, 500);
  }
});
