import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const DURATION_HOURS: Record<string, number> = {
  '24 hours': 24,
  '3 days': 72,
  '1 week': 168,
};

/** Open a Stripe Checkout session for a listing boost. Returns the hosted URL. */
export function useBoostCheckout() {
  return useMutation({
    mutationFn: async (v: {
      prepperId: string;
      plan: string;
      amountCents: number;
      durationLabel: string;
    }): Promise<string> => {
      const { data, error } = await supabase.functions.invoke('stripe-boost', {
        body: {
          prepperId: v.prepperId,
          plan: v.plan,
          amountCents: v.amountCents,
          durationLabel: v.durationLabel,
        },
      });
      if (error) throw error;
      const url = (data as { url?: string; error?: string })?.url;
      if (!url) throw new Error((data as { error?: string })?.error || 'Could not start boost checkout.');
      return url;
    },
  });
}

/** Optimistic insert of a boost row after payment browser returns. */
export function useInsertBoost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      prepperId: string;
      plan: string;
      amountCents: number;
      durationLabel: string;
    }) => {
      const hours = DURATION_HOURS[v.durationLabel] ?? 24;
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('boosts').insert({
        prepper_id: v.prepperId,
        plan: v.plan,
        amount_cents: v.amountCents,
        expires_at: expiresAt,
        status: 'active',
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['boosts', v.prepperId] }),
  });
}
