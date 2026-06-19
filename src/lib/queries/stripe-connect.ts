import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type StripeAccountStatus = 'not_connected' | 'pending' | 'active' | 'restricted';

export interface StripeConnectProfile {
  stripe_account_id: string | null;
  stripe_account_status: StripeAccountStatus | null;
}

async function callConnect(body: Record<string, unknown>): Promise<{ account_id?: string; url?: string }> {
  const { data, error } = await supabase.functions.invoke('stripe-connect', { body });
  if (error) throw error;
  return data;
}

/** Fetch the prepper's Stripe Connect status from their profile. */
export function useStripeConnect() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<StripeConnectProfile>({
    queryKey: ['stripe-connect', user?.id ?? 'anon'],
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prepper_profiles')
        .select('stripe_account_id, stripe_account_status')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return {
        stripe_account_id: data.stripe_account_id ?? null,
        stripe_account_status: (data.stripe_account_status ?? 'not_connected') as StripeAccountStatus,
      };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['stripe-connect', user?.id] });

  const connectAccount = useMutation({
    mutationFn: () => callConnect({ action: 'create_account', prepper_id: user!.id }),
    onSuccess: invalidate,
  });

  const getOnboardingLink = useMutation({
    mutationFn: () => callConnect({ action: 'get_onboarding_link', prepper_id: user!.id }),
  });

  const getDashboardLink = useMutation({
    mutationFn: () => callConnect({ action: 'get_dashboard_link', prepper_id: user!.id }),
  });

  const syncStatus = useMutation({
    mutationFn: () => callConnect({ action: 'sync_status', prepper_id: user!.id }),
    onSuccess: invalidate,
  });

  return { ...query, connectAccount, getOnboardingLink, getDashboardLink, syncStatus };
}
