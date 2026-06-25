import { supabase } from '@/lib/supabase';

export type StripeAccountStatus = 'not_connected' | 'pending' | 'active' | 'restricted' | 'disabled';

export type StripeAccount = {
  prepper_id: string;
  stripe_account_id: string | null;
  status: StripeAccountStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  disabled_reason: string | null;
  requirements_due: string[];
  requirements_eventually_due: string[];
  available_pence: number;
  pending_pence: number;
};

export type PayoutStatus = 'pending' | 'in_transit' | 'paid' | 'failed' | 'canceled';

export type Payout = {
  id: string;
  stripe_payout_id: string | null;
  amount_pence: number;
  currency: string;
  status: PayoutStatus;
  failure_message: string | null;
  arrival_date: string | null;
  created_at: string;
};

export type ConnectAction =
  | 'create_account'
  | 'get_onboarding_link'
  | 'refresh_onboarding'
  | 'get_dashboard_link'
  | 'sync_status'
  | 'get_balance';

export type ConnectResponse = {
  url?: string;
  account_id?: string;
  status?: string;
  available_pence?: number;
  pending_pence?: number;
};

/** The caller's Connect account row, or null if they've never started onboarding. */
export async function getMyStripeAccount(): Promise<StripeAccount | null> {
  const { data, error } = await supabase.rpc('get_my_stripe_account');
  if (error) throw new Error(error.message);
  if (!data) return null;
  // A single-composite RPC may surface as an object or a 1-element array.
  const row = Array.isArray(data) ? data[0] : data;
  return (row as StripeAccount) ?? null;
}

export async function getMyPayouts(limit = 20): Promise<Payout[]> {
  const { data, error } = await supabase.rpc('get_my_payouts', { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as Payout[];
}

/** Invoke a stripe-connect edge-function action. Returns a hosted-flow URL when relevant. */
export async function stripeConnectAction(action: ConnectAction): Promise<ConnectResponse> {
  const { data, error } = await supabase.functions.invoke('stripe-connect', { body: { action } });
  if (error) throw new Error(error.message ?? 'stripe-connect failed');
  return (data ?? {}) as ConnectResponse;
}

// Human-readable readiness summary for the dashboard banner.
export function readiness(account: StripeAccount | null): {
  label: string;
  tone: 'neutral' | 'warning' | 'success' | 'danger';
  cta: 'connect' | 'resume' | 'fix' | 'manage' | null;
} {
  if (!account || account.status === 'not_connected') {
    return { label: 'Connect Stripe to receive payouts', tone: 'neutral', cta: 'connect' };
  }
  if (account.status === 'active' && account.payouts_enabled) {
    return { label: 'Payouts active', tone: 'success', cta: 'manage' };
  }
  if (account.status === 'restricted' || account.status === 'disabled') {
    return { label: 'Action needed — Stripe restricted your account', tone: 'danger', cta: 'fix' };
  }
  return { label: 'Finish Stripe setup to get paid', tone: 'warning', cta: 'resume' };
}
