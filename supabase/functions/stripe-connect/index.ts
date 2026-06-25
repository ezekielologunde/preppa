// stripe-connect — Stripe Connect Express onboarding for preppers (current schema).
// State is stored in public.stripe_accounts (migration 038), keyed by prepper_id
// (= auth.users.id = kitchens.prepper_id). All writes go through the service-role
// RPC upsert_stripe_account so the row stays the single source of truth.
//
// Actions:
//   create_account       — create an Express account, store its id
//   get_onboarding_link  — account_onboarding link (new OR resume — Stripe returns
//                          a continuation link automatically for incomplete accounts)
//   refresh_onboarding   — alias of get_onboarding_link (the refresh_url target)
//   sync_status          — retrieve the account, map capabilities/requirements → DB
//   get_dashboard_link   — Express dashboard login link
//   get_balance          — retrieve balance, sync available/pending → DB
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { cors, json, readBody, errorResponse, checkRateLimit } from '../_shared/security.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const SITE = Deno.env.get('SITE_URL') ?? 'https://app.preppa.live';

// Maps a Stripe account object to our stripe_accounts shape.
function mapAccount(account: Stripe.Account): Record<string, unknown> {
  const status =
    account.charges_enabled && account.payouts_enabled ? 'active'
    : account.requirements?.disabled_reason ? 'restricted'
    : account.details_submitted ? 'pending'
    : 'not_connected';
  return {
    stripe_account_id:           account.id,
    status,
    charges_enabled:             account.charges_enabled ?? false,
    payouts_enabled:             account.payouts_enabled ?? false,
    details_submitted:           account.details_submitted ?? false,
    disabled_reason:             account.requirements?.disabled_reason ?? null,
    requirements_due:            account.requirements?.currently_due ?? [],
    requirements_eventually_due: account.requirements?.eventually_due ?? [],
    country:                     account.country ?? null,
    business_type:               account.business_type ?? null,
    default_currency:            account.default_currency ?? 'gbp',
  };
}

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

    if (!(await checkRateLimit(supabase, user.id, 'stripe-connect', 10))) {
      return errorResponse('Too many requests', 429, req);
    }

    const { action } = body as { action?: string };
    if (!action) return errorResponse('Missing action', 400, req);
    const prepperId = user.id;  // a prepper acts only on their own account

    // Caller must be an approved prepper (has a kitchen).
    const { data: kitchen } = await supabase
      .from('kitchens').select('id').eq('prepper_id', prepperId).maybeSingle();
    if (!kitchen) return errorResponse('Not an approved prepper', 403, req);

    const { data: acct } = await supabase
      .from('stripe_accounts').select('stripe_account_id, status').eq('prepper_id', prepperId).maybeSingle();
    const existingId = acct?.stripe_account_id as string | undefined;

    switch (action) {
      case 'create_account': {
        if (existingId) return json({ account_id: existingId }, 200, req);
        const account = await stripe.accounts.create({
          type:     'express',
          metadata: { prepper_id: prepperId },
          capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
        });
        await supabase.rpc('upsert_stripe_account', {
          p_prepper_id: prepperId,
          p_data:       { ...mapAccount(account), status: 'pending' },
        });
        return json({ account_id: account.id }, 200, req);
      }

      case 'get_onboarding_link':
      case 'refresh_onboarding': {
        if (!existingId) return errorResponse('No Stripe account — call create_account first', 400, req);
        const link = await stripe.accountLinks.create({
          account:     existingId,
          refresh_url: `${SITE}/earnings?stripe=refresh`,
          return_url:  `${SITE}/earnings?stripe=return`,
          type:        'account_onboarding',
        });
        return json({ url: link.url }, 200, req);
      }

      case 'get_dashboard_link': {
        if (!existingId) return errorResponse('No Stripe account connected', 400, req);
        const link = await stripe.accounts.createLoginLink(existingId);
        return json({ url: link.url }, 200, req);
      }

      case 'sync_status': {
        if (!existingId) return json({ status: 'not_connected' }, 200, req);
        const account = await stripe.accounts.retrieve(existingId);
        const mapped = mapAccount(account);
        await supabase.rpc('upsert_stripe_account', { p_prepper_id: prepperId, p_data: mapped });
        return json({ status: mapped.status, account: mapped }, 200, req);
      }

      case 'get_balance': {
        if (!existingId) return json({ available_pence: 0, pending_pence: 0 }, 200, req);
        const balance = await stripe.balance.retrieve({ stripeAccount: existingId });
        const sum = (arr: Stripe.Balance.Available[] | Stripe.Balance.Pending[]) =>
          arr.filter((b) => b.currency === 'gbp').reduce((t, b) => t + b.amount, 0);
        const available_pence = sum(balance.available ?? []);
        const pending_pence   = sum(balance.pending ?? []);
        await supabase.rpc('upsert_stripe_account', {
          p_prepper_id: prepperId,
          p_data:       { stripe_account_id: existingId, status: acct?.status ?? 'active', available_pence, pending_pence },
        });
        return json({ available_pence, pending_pence }, 200, req);
      }

      default:
        return errorResponse('Unknown action', 400, req);
    }
  } catch (e) {
    console.error('[stripe-connect] error:', e instanceof Error ? e.message : e);
    return json({ error: 'internal_error' }, 500, req);
  }
});
