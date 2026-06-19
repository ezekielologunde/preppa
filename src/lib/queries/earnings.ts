import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type RefundRow = {
  id: string;
  amount: number;
  reason: string | null;
  created_at: string;
  order_id: string;
};

export type EarningsRecent = {
  order_id: string;
  created_at: string;
  status: string;
  amount: number;
  fees: number;
  net: number;
  refunded: number;
  customer_first: string;
  first_item: string | null;
  item_count: number;
};

export type Earnings = {
  is_prepper: boolean;
  gross_total: number;
  stripe_fees: number;
  platform_fees: number;
  refunded_total: number;
  net_total: number;
  net_week: number;
  net_month: number;
  orders_paid: number;
  recent: EarningsRecent[];
};

/** Real earnings for the signed-in prepper, computed server-side from payments. */
export function useMyEarnings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['earnings', user?.id ?? 'anon'],
    enabled: !!user,
    queryFn: async (): Promise<Earnings> => {
      const { data, error } = await supabase.rpc('my_prepper_earnings');
      if (error) throw error;
      return data as unknown as Earnings;
    },
  });
}

/** Refund history for the signed-in prepper (last 20). Returns [] if table absent. */
export function usePrepperRefunds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['prepper-refunds', user?.id ?? 'none'],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<RefundRow[]> => {
      const { data } = await supabase
        .from('order_refunds' as never)
        .select('id,amount,reason,created_at,order_id')
        .eq('prepper_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data as RefundRow[] | null) ?? [];
    },
  });
}
