import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type ReferralStatus = 'pending' | 'completed' | 'paid';

export type Referral = {
  id: string;
  code: string;
  status: ReferralStatus;
  creditAmount: number;
  createdAt: string;
  completedAt?: string;
};

// ─── Referral code ──────────────────────────────────────────────────────────

export function useMyReferralCode(userId?: string | null) {
  return useQuery({
    queryKey: ['referral-code', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 600_000,
    queryFn: async (): Promise<string> => {
      // 1. Try reading from profiles.referral_code first
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', userId!)
        .single();

      if (profile?.referral_code) return profile.referral_code as string;

      // 2. Fallback: try the DB RPC that auto-creates the code
      const { data: rpcCode } = await supabase.rpc('get_or_create_referral_code', {
        uid: userId!,
      });
      if (rpcCode) return rpcCode as string;

      // 3. Last resort: derive deterministically and persist
      const code = 'PREP-' + userId!.replace(/-/g, '').slice(0, 6).toUpperCase();
      await supabase.from('profiles').update({ referral_code: code }).eq('id', userId!);
      return code;
    },
  });
}

// ─── My referrals list ──────────────────────────────────────────────────────

export function useMyReferrals(userId?: string | null) {
  return useQuery({
    queryKey: ['my-referrals', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 120_000,
    queryFn: async (): Promise<Referral[]> => {
      const { data } = await supabase
        .from('referrals')
        .select('id, code, status, credit_amount, created_at, completed_at')
        .eq('referrer_id', userId!)
        .order('created_at', { ascending: false });

      return (data ?? []).map((r) => ({
        id: r.id as string,
        code: r.code as string,
        status: r.status as ReferralStatus,
        creditAmount: r.credit_amount as number,
        createdAt: r.created_at as string,
        completedAt: (r.completed_at as string | null) ?? undefined,
      }));
    },
  });
}

// ─── Referral balance ───────────────────────────────────────────────────────

export type ReferralBalance = { total: number; available: number };

export function useReferralBalance(userId?: string | null) {
  return useQuery({
    queryKey: ['referral-balance', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 120_000,
    queryFn: async (): Promise<ReferralBalance> => {
      const { data } = await supabase
        .from('referrals')
        .select('credit_amount, status')
        .eq('referrer_id', userId!)
        .in('status', ['completed', 'paid']);

      const rows = data ?? [];
      const total = rows.reduce((s, r) => s + ((r.credit_amount as number) ?? 0), 0);
      const available = rows
        .filter((r) => r.status === 'completed')
        .reduce((s, r) => s + ((r.credit_amount as number) ?? 0), 0);
      return { total, available };
    },
  });
}
