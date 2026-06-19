import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderMessage = {
  id: string;
  senderId: string | null;
  body: string;
  createdAt: string;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Fetches messages for an order, refetches every 15 s, and subscribes to
 *  real-time INSERTs so new messages arrive without polling delay. */
export function useOrderMessages(orderId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['order-messages', orderId ?? 'none'],
    enabled: !!orderId,
    staleTime: 5_000,
    refetchInterval: 15_000,
    queryFn: async (): Promise<OrderMessage[]> => {
      const { data, error } = await supabase
        .from('order_messages')
        .select('id, sender_id, body, created_at')
        .eq('order_id', orderId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        senderId: r.sender_id,
        body: r.body,
        createdAt: r.created_at,
      }));
    },
  });

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` },
        () => { void qc.invalidateQueries({ queryKey: ['order-messages', orderId] }); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orderId, qc]);

  return query;
}

/** Inserts a message and invalidates the message list on success. */
export function useSendOrderMessage(orderId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, senderId }: { body: string; senderId: string }) => {
      const { error } = await supabase.from('order_messages').insert({
        order_id: orderId!,
        sender_id: senderId,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['order-messages', orderId] });
    },
  });
}
