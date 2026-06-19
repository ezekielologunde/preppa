import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type WeeklyEarning = { label: string; amount: number };

export type PayoutRequest = {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'paid' | 'rejected';
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type PayoutBalance = {
  available: number;
  grossRevenue: number;
  netRevenue: number;
  totalRequested: number;
  pending: number;
};

export function usePayoutBalance(prepperId?: string | null) {
  return useQuery({
    queryKey: ['payout-balance', prepperId ?? 'none'],
    enabled: !!prepperId,
    staleTime: 60_000,
    queryFn: async (): Promise<PayoutBalance> => {
      const [ordersRes, payoutsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('total')
          .eq('prepper_id', prepperId!)
          .eq('status', 'completed'),
        supabase
          .from('payout_requests')
          .select('amount, status')
          .eq('prepper_id', prepperId!)
          .in('status', ['pending', 'processing', 'paid']),
      ]);

      const grossRevenue = (ordersRes.data ?? []).reduce(
        (s: number, o: { total: number }) => s + (o.total ?? 0),
        0,
      );
      const netRevenue = grossRevenue * 0.85;
      const payouts = payoutsRes.data ?? [];
      const totalRequested = payouts.reduce(
        (s: number, p: { amount: number }) => s + (p.amount ?? 0),
        0,
      );
      const pending = payouts
        .filter((p: { status: string }) => p.status === 'pending' || p.status === 'processing')
        .reduce((s: number, p: { amount: number }) => s + (p.amount ?? 0), 0);

      return {
        available: Math.max(0, netRevenue - totalRequested),
        grossRevenue,
        netRevenue,
        totalRequested,
        pending,
      };
    },
  });
}

export function usePayoutHistory(prepperId?: string | null) {
  return useQuery({
    queryKey: ['payout-history', prepperId ?? 'none'],
    enabled: !!prepperId,
    staleTime: 60_000,
    queryFn: async (): Promise<PayoutRequest[]> => {
      const { data } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('prepper_id', prepperId!)
        .order('created_at', { ascending: false });

      return (data ?? []).map((r) => ({
        id: r.id,
        amount: r.amount,
        status: r.status as PayoutRequest['status'],
        bankName: r.bank_name,
        accountNumber: r.account_number,
        accountName: r.account_name,
        note: r.note,
        createdAt: r.created_at,
        processedAt: r.processed_at,
      }));
    },
  });
}

export function usePrepperEarningsChart(prepperId?: string | null) {
  return useQuery({
    queryKey: ['prepper-earnings-chart', prepperId ?? 'anon'],
    enabled: !!prepperId,
    staleTime: 300_000,
    queryFn: async (): Promise<WeeklyEarning[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 56);

      const { data } = await supabase
        .from('orders')
        .select('created_at, total')
        .eq('prepper_id', prepperId!)
        .eq('status', 'completed')
        .gte('created_at', since.toISOString());

      const weeks: Record<string, number> = {};
      (data ?? []).forEach((o) => {
        const d = new Date(o.created_at);
        const mon = new Date(d);
        mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const key = mon.toISOString().slice(0, 10);
        weeks[key] = (weeks[key] ?? 0) + (o.total ?? 0);
      });

      const result: WeeklyEarning[] = [];
      for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - 7 * i - ((d.getDay() + 6) % 7));
        const key = d.toISOString().slice(0, 10);
        const label = i === 0 ? 'This wk' : i === 1 ? 'Last wk' : `W-${i}`;
        result.push({ label, amount: weeks[key] ?? 0 });
      }
      return result;
    },
  });
}

export function useRequestPayout(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      amount: number;
      bankName: string;
      accountNumber: string;
      accountName: string;
    }) => {
      const { error } = await supabase.from('payout_requests').insert({
        prepper_id: prepperId!,
        amount: data.amount,
        bank_name: data.bankName,
        account_number: data.accountNumber,
        account_name: data.accountName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payout-balance', prepperId] });
      void qc.invalidateQueries({ queryKey: ['payout-history', prepperId] });
    },
  });
}
