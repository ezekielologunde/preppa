// Handles Stripe Connect Express onboarding for preppers (direct payout disbursement).
// Actions:
//   create_account      — create a new Express account and store its ID in prepper_profiles
//   get_onboarding_link — generate an account_onboarding link (new or continuation)
//   get_dashboard_link  — generate a login link for an already-onboarded account
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

    const { action, prepper_id } = await req.json().catch(() => ({}));
    if (!action || !prepper_id) return json({ error: 'Missing action or prepper_id' }, 400);
    if (prepper_id !== user.id) return json({ error: 'Not your account' }, 403);

    const { data: profile, error: perr } = await supabase
      .from('prepper_profiles')
      .select('stripe_account_id, stripe_account_status')
      .eq('user_id', prepper_id)
      .single();
    if (perr || !profile) return json({ error: 'Prepper profile not found' }, 404);

    if (action === 'create_account') {
      if (profile.stripe_account_id) return json({ account_id: profile.stripe_account_id });
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { prepper_id },
      });
      await supabase
        .from('prepper_profiles')
        .update({ stripe_account_id: account.id, stripe_account_status: 'pending' })
        .eq('user_id', prepper_id);
      return json({ account_id: account.id });
    }

    if (action === 'get_onboarding_link') {
      const accountId = profile.stripe_account_id;
      if (!accountId) return json({ error: 'No Stripe account — call create_account first' }, 400);
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${SITE}/earnings?stripe=refresh`,
        return_url: `${SITE}/earnings?stripe=return`,
        type: 'account_onboarding',
      });
      return json({ url: link.url });
    }

    if (action === 'get_dashboard_link') {
      const accountId = profile.stripe_account_id;
      if (!accountId) return json({ error: 'No Stripe account connected' }, 400);
      const link = await stripe.accounts.createLoginLink(accountId);
      return json({ url: link.url });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Request failed' }, 500);
  }
});
