import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Address } from '@/components/address-sheet';
import { supabase } from '@/lib/supabase';

type DbAddress = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  is_default: boolean;
};

function toAddress(r: DbAddress): Address {
  return {
    id: r.id,
    label: r.label ?? 'Home',
    street1: r.line1,
    street2: r.line2 ?? undefined,
    city: r.city ?? '',
    state: r.state ?? '',
    postalCode: r.postal_code ?? '',
    country: r.country ?? 'US',
    isDefault: r.is_default,
  };
}

export function useAddresses(userId: string | undefined) {
  return useQuery({
    queryKey: ['addresses', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select('id,label,line1,line2,city,state,postal_code,country,is_default')
        .eq('user_id', userId!)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as DbAddress[]).map(toAddress);
    },
    enabled: !!userId,
  });
}

export function useUpsertAddress(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<Address, 'id'> & { id?: string }) => {
      // Shared editable fields (no user_id — that's set on insert only;
      // updating it isn't allowed and the Update type rightly omits it).
      const fields = {
        label: form.label === 'Other' ? null : form.label,
        line1: form.street1,
        line2: form.street2 || null,
        city: form.city,
        state: form.state,
        postal_code: form.postalCode,
        country: form.country || 'US',
        is_default: form.isDefault,
      };
      if (form.id) {
        const { error } = await supabase.from('addresses').update(fields).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('addresses').insert({ user_id: userId!, ...fields });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses', userId] }),
  });
}

export function useDeleteAddress(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('addresses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses', userId] }),
  });
}

export function useSetDefaultAddress(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, allIds }: { id: string; allIds: string[] }) => {
      // Clear all defaults first, then set the new one.
      // Explicit user_id filter provides defense-in-depth alongside RLS.
      const { error: clearErr } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId!)
        .in('id', allIds);
      if (clearErr) throw clearErr;
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('user_id', userId!)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses', userId] }),
  });
}
