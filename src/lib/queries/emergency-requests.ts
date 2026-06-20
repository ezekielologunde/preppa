import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** Insert an emergency food request into meal_requests. */
export function useCreateEmergencyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      cuisine: string;
      notes: string;
      urgencyMins: number;
      addressLine: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const urgencyLabel = v.urgencyMins <= 30 ? '30 min' : v.urgencyMins <= 60 ? '1 hour' : '2 hours';
      const title = `Emergency request · ${urgencyLabel}`;
      const description = [
        `Urgency: ${urgencyLabel}`,
        v.addressLine ? `Address: ${v.addressLine}` : null,
        v.notes ? `Notes: ${v.notes.trim().slice(0, 500)}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const { error } = await supabase.from('meal_requests').insert({
        customer_id: user.id,
        title,
        description: description || null,
        cuisine: v.cuisine === 'anything' ? null : v.cuisine.trim().slice(0, 50),
      });
      if (error) throw error;

      // Fire-and-forget: notify approved preppers (failure must not block the customer)
      supabase.functions.invoke('notify-emergency-request', {
        body: { urgencyLabel, cuisine: v.cuisine },
      }).catch(() => {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-requests'] }),
  });
}
