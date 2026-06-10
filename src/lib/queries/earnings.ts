import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type EarningsRecent = {
  order_id: string;
  created_at: string;
  status: string;
  amount: number;
  refunded: number;
  customer_first: string;
  first_item: string | null;
  item_count: number;
};

export type Earnings = {
  is_prepper: boolean;
  gross_total: number;
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
