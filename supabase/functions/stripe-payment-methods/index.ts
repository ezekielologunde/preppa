// Manages saved Stripe payment methods (list / attach / detach / set_default).
// Card tokenization happens on-device via Stripe's REST API using the publishable
// key — raw card data never touches this server.
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const PK = Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function getOrCreateCustomer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string | undefined,
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });
  await supabase.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId);
  return customer.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: uerr } = await sb.auth.getUser(token);
    if (uerr || !user) return json({ error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── List ──────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const { data: profile } = await sb.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
      if (!profile?.stripe_customer_id) return json({ pk: PK, paymentMethods: [], defaultId: null });
      const customerId = profile.stripe_customer_id;
      const [pms, customer] = await Promise.all([
        stripe.paymentMethods.list({ customer: customerId, type: 'card' }),
        stripe.customers.retrieve(customerId),
      ]);
      const defaultId = (customer as Stripe.Customer).invoice_settings?.default_payment_method ?? null;
      return json({
        pk: PK,
        defaultId: typeof defaultId === 'string' ? defaultId : null,
        paymentMethods: pms.data.map((pm) => ({
          id: pm.id,
          brand: pm.card?.brand ?? 'other',
          last4: pm.card?.last4 ?? '????',
          expMonth: String(pm.card?.exp_month ?? '').padStart(2, '0'),
          expYear: String((pm.card?.exp_year ?? 0) % 100).padStart(2, '0'),
        })),
      });
    }

    // ── Attach ────────────────────────────────────────────────────────────────
    if (action === 'attach') {
      const { pmId } = body as { pmId?: string };
      if (!pmId) return json({ error: 'Missing pmId' }, 400);
      const customerId = await getOrCreateCustomer(sb, user.id, user.email);
      await stripe.paymentMethods.attach(pmId, { customer: customerId });
      // Auto-set as default if it's the first card
      const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
      if (pms.data.length === 1) {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: pmId },
        });
      }
      return json({ ok: true });
    }

    // ── Detach ────────────────────────────────────────────────────────────────
    if (action === 'detach') {
      const { pmId } = body as { pmId?: string };
      if (!pmId) return json({ error: 'Missing pmId' }, 400);
      const { data: profile } = await sb.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
      const pm = await stripe.paymentMethods.retrieve(pmId);
      if (pm.customer !== profile?.stripe_customer_id) return json({ error: 'Not your card' }, 403);
      await stripe.paymentMethods.detach(pmId);
      return json({ ok: true });
    }

    // ── Set default ───────────────────────────────────────────────────────────
    if (action === 'set_default') {
      const { pmId } = body as { pmId?: string };
      if (!pmId) return json({ error: 'Missing pmId' }, 400);
      const { data: profile } = await sb.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
      if (!profile?.stripe_customer_id) return json({ error: 'No customer' }, 400);
      const pm = await stripe.paymentMethods.retrieve(pmId);
      if (pm.customer !== profile.stripe_customer_id) return json({ error: 'Not your card' }, 403);
      await stripe.customers.update(profile.stripe_customer_id, {
        invoice_settings: { default_payment_method: pmId },
      });
      return json({ ok: true });
    }

    // ── Create SetupIntent ────────────────────────────────────────────────────
    if (action === 'create_setup_intent') {
      const customerId = await getOrCreateCustomer(sb, user.id, user.email);
      const si = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });
      return json({ clientSecret: si.client_secret, pk: PK });
    }

    // ── Customer Portal session (native card management) ─────────────────────
    if (action === 'create_portal_session') {
      const customerId = await getOrCreateCustomer(sb, user.id, user.email);
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${Deno.env.get('SITE_URL') ?? 'https://app.preppa.live'}/payment-methods`,
      });
      return json({ url: session.url });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Request failed' }, 500);
  }
});
