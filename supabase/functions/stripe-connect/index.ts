// Handles Stripe Connect Express onboarding for preppers (direct payout disbursement).
// Actions:
//   create_account      — create a new Express account and store its ID in prepper_profiles
//   get_onboarding_link — generate an account_onboarding link (new or continuation)
//   get_dashboard_link  — generate a login link for an already-onboarded account
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

    const allowed = await checkRateLimit(supabase, user.id, 'stripe-connect', 10);
    if (!allowed) return errorResponse('Too many requests', 429, req);

    const { action, prepper_id } = body as { action?: string; prepper_id?: string };
    if (!action || !prepper_id) return errorResponse('Missing action or prepper_id', 400, req);
    if (prepper_id !== user.id) return errorResponse('Not your account', 403, req);

    const { data: profile, error: perr } = await supabase
      .from('prepper_profiles')
      .select('stripe_account_id, stripe_account_status')
      .eq('user_id', prepper_id)
      .single();
    if (perr || !profile) return errorResponse('Prepper profile not found', 404, req);

    if (action === 'create_account') {
      if (profile.stripe_account_id) return json({ account_id: profile.stripe_account_id }, 200, req);
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { prepper_id },
      });
      await supabase
        .from('prepper_profiles')
        .update({ stripe_account_id: account.id, stripe_account_status: 'pending' })
        .eq('user_id', prepper_id);
      return json({ account_id: account.id }, 200, req);
    }

    if (action === 'get_onboarding_link') {
      const accountId = profile.stripe_account_id;
      if (!accountId) return errorResponse('No Stripe account — call create_account first', 400, req);
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${SITE}/earnings?stripe=refresh`,
        return_url: `${SITE}/earnings?stripe=return`,
        type: 'account_onboarding',
      });
      return json({ url: link.url }, 200, req);
    }

    if (action === 'get_dashboard_link') {
      const accountId = profile.stripe_account_id;
      if (!accountId) return errorResponse('No Stripe account connected', 400, req);
      const link = await stripe.accounts.createLoginLink(accountId);
      return json({ url: link.url }, 200, req);
    }

    // Fetch real Stripe account status and sync to DB — call after onboarding returns.
    if (action === 'sync_status') {
      const accountId = profile.stripe_account_id;
      if (!accountId) return json({ status: 'not_connected' }, 200, req);
      const account = await stripe.accounts.retrieve(accountId);
      const status =
        account.charges_enabled && account.payouts_enabled ? 'active'
        : account.details_submitted ? 'pending'
        : 'not_connected';
      await supabase
        .from('prepper_profiles')
        .update({ stripe_account_status: status })
        .eq('user_id', prepper_id);
      return json({ status }, 200, req);
    }

    return errorResponse('Unknown action', 400, req);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Request failed' }, 500, req);
  }
});
