import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** Insert an emergency food request into meal_requests. */
export function useCreateEmergencyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      userId: string;
      cuisine: string;
      notes: string;
      urgencyMins: number;
      addressLine: string | null;
    }) => {
      const urgencyLabel = v.urgencyMins <= 30 ? '30 min' : v.urgencyMins <= 60 ? '1 hour' : '2 hours';
      const title = `Emergency request · ${urgencyLabel}`;
      const description = [
        `Urgency: ${urgencyLabel}`,
        v.addressLine ? `Address: ${v.addressLine}` : null,
        v.notes ? `Notes: ${v.notes}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const { error } = await supabase.from('meal_requests').insert({
        customer_id: v.userId,
        title,
        description: description || null,
        cuisine: v.cuisine === 'anything' ? null : v.cuisine,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['meal-requests', v.userId] }),
  });
}
