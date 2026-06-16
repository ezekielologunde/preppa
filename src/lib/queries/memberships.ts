import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

type PrepperMembership = {
  tier: string;
  billing_period: string;
  status: string;
  current_period_end: string | null;
  isPro: boolean;
};

type CustomerMembership = {
  tier: string;
  billing_period: string;
  status: string;
  current_period_end: string | null;
  isPlus: boolean;
  isConnect: boolean;
  isUnlocked: boolean;
};

/** Active Pro membership for a prepper. Returns null when on free tier (no row). */
export function usePrepperMembership(prepperId?: string | null) {
  return useQuery({
    queryKey: ['prepper-membership', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<PrepperMembership | null> => {
      const { data, error } = await supabase
        .from('prepper_memberships')
        .select('tier,billing_period,status,current_period_end')
        .eq('prepper_id', prepperId!)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as { tier: string; billing_period: string; status: string; current_period_end: string | null };
      return { ...row, isPro: row.tier === 'pro' };
    },
  });
}

/** Active Prep+ membership for a customer. Returns null when on free tier. */
export function useCustomerMembership(userId?: string | null) {
  return useQuery({
    queryKey: ['customer-membership', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<CustomerMembership | null> => {
      const { data, error } = await supabase
        .from('customer_memberships')
        .select('tier,billing_period,status,current_period_end')
        .eq('customer_id', userId!)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as { tier: string; billing_period: string; status: string; current_period_end: string | null };
      return { ...row, isPlus: row.tier === 'plus', isConnect: row.tier === 'connect', isUnlocked: row.tier === 'plus' || row.tier === 'connect' };
    },
  });
}
