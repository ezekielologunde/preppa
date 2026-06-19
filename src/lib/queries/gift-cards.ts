import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type GiftCard = {
  id: string;
  code: string;
  amount: number;
  balance: number;
  message: string | null;
  recipientEmail: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
};

function mapRow(r: Record<string, unknown>): GiftCard {
  return {
    id: r.id as string,
    code: r.code as string,
    amount: r.amount as number,
    balance: r.balance as number,
    message: (r.message as string | null) ?? null,
    recipientEmail: (r.recipient_email as string | null) ?? null,
    isActive: r.is_active as boolean,
    createdAt: r.created_at as string,
    expiresAt: (r.expires_at as string | null) ?? null,
  };
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PREP';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
    if (i === 3) code += '-';
  }
  return code; // e.g. PREP-ABCD-EFG8
}

export function useMyGiftCards(userId?: string | null) {
  return useQuery({
    queryKey: ['my-gift-cards', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<GiftCard[]> => {
      const { data } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('sender_id', userId!)
        .order('created_at', { ascending: false });
      return (data ?? []).map(mapRow);
    },
  });
}

export type SendGiftCardInput = {
  amount: number;
  recipientEmail?: string;
  message?: string;
};

export function useSendGiftCard(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendGiftCardInput): Promise<{ id: string; code: string }> => {
      const code = generateCode();
      const { data, error } = await supabase
        .from('gift_cards')
        .insert({
          sender_id: userId!,
          code,
          amount: input.amount,
          balance: input.amount,
          recipient_email: input.recipientEmail ?? null,
          message: input.message ?? null,
        })
        .select('id, code')
        .single();
      if (error) throw new Error(error.message);
      return data as { id: string; code: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-gift-cards', userId] }),
  });
}

export function useValidateGiftCard() {
  return useMutation({
    mutationFn: async (rawCode: string): Promise<GiftCard | null> => {
      const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const { data } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('code', code.length > 8 ? `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}` : code)
        .eq('is_active', true)
        .gt('balance', 0)
        .maybeSingle();
      if (!data) return null;
      return mapRow(data as Record<string, unknown>);
    },
  });
}
