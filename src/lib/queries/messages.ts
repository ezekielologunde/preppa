import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Conversation = {
  id: string;
  otherName: string;
  otherAvatar: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  unread: boolean;
};

type Participant = { user_id: string; profile: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null };
type Msg = { id: string; body: string | null; created_at: string; sender_id: string };
type ConvRow = {
  last_read_at: string | null;
  conversation: {
    id: string;
    participants: Participant[];
    messages: Msg[];
  } | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

/** Inbox: the user's conversations with the other participant + last message. */
export function useConversations(userId?: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`conversations:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        qc.invalidateQueries({ queryKey: ['conversations', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  return useQuery({
    queryKey: ['conversations', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('last_read_at,conversation:conversations(id,participants:conversation_participants(user_id,profile:profiles(full_name,avatar_url)),messages(id,body,created_at,sender_id))')
        .eq('user_id', userId!);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ConvRow[];
      return rows
        .filter((r) => r.conversation)
        .map((r) => {
          const c = r.conversation!;
          const other = c.participants.find((p) => p.user_id !== userId);
          const prof = one(other?.profile);
          const msgs = [...(c.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
          const last = msgs[msgs.length - 1];
          const unread = !!last && last.sender_id !== userId && (!r.last_read_at || last.created_at > r.last_read_at);
          return {
            id: c.id,
            otherName: prof?.full_name ?? 'Preppa user',
            otherAvatar: prof?.avatar_url ?? null,
            lastMessage: last?.body ?? null,
            lastAt: last?.created_at ?? null,
            unread,
          };
        })
        .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
    },
  });
}

export type Message = { id: string; body: string | null; created_at: string; sender_id: string; mine: boolean };

/** Thread: messages in a conversation (realtime). */
export function useMessages(conversationId?: string, userId?: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, qc]);

  return useQuery({
    queryKey: ['messages', conversationId ?? 'none'],
    enabled: !!conversationId,
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('id,body,created_at,sender_id')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => ({ ...m, mine: m.sender_id === userId }));
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { conversationId: string; senderId: string; body: string; senderName?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('messages').insert({
        conversation_id: v.conversationId,
        sender_id: user.id,
        body: v.body.trim().slice(0, 2000),
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['messages', v.conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations', v.senderId] });
      // Notify the other participant (fire-and-forget)
      void (async () => {
        try {
          const { data } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', v.conversationId)
            .neq('user_id', v.senderId)
            .limit(1)
            .maybeSingle();
          if (!data?.user_id) return;
          await supabase.functions.invoke('notify', {
            body: {
              user_id: data.user_id,
              title: `New message from ${v.senderName ?? 'Preppa user'}`,
              body: v.body.slice(0, 100),
              data: { type: 'message', conversation_id: v.conversationId },
            },
          });
        } catch {
          // Non-critical — swallow errors
        }
      })();
    },
  });
}

export type HomeCookNegotiationCtx = {
  id: string;
  status: 'pending' | 'negotiating';
  requestedDate: string;
  requestedTime: string;
  address: string;
  guestCount: number;
  cuisine: string | null;
  ingredientBudget: number;
  cookingFee: number | null;
  travelFee: number | null;
  iAmPrepper: boolean;
};

export type ChatContext = {
  otherUserId: string | null;
  otherPhone: string | null;
  order: { id: string; status: string; total: number; firstItem: string | null; items: number; iAmPrepper: boolean } | null;
  homeCookRequest: HomeCookNegotiationCtx | null;
};

/**
 * Context for a chat: the other participant, their phone (tap-to-call), and
 * the latest order the two of you share — surfaced as a card above the thread
 * so the conversation always has its order details in view.
 */
export function useChatContext(conversationId?: string, userId?: string | null) {
  return useQuery({
    queryKey: ['chat-context', conversationId ?? 'none'],
    enabled: !!conversationId && !!userId,
    queryFn: async (): Promise<ChatContext> => {
      const { data: parts } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId!);
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const other = (parts ?? []).map((p) => p.user_id).find((u) => u !== userId) ?? null;
      if (!other || !UUID_RE.test(other)) return { otherUserId: null, otherPhone: null, order: null, homeCookRequest: null };

      const [{ data: prof }, { data: preps }] = await Promise.all([
        supabase.from('profiles').select('phone').eq('id', other).maybeSingle(),
        supabase.from('prepper_profiles').select('id,user_id').in('user_id', [userId!, other]),
      ]);
      const prepRows = (preps ?? []) as { id: string; user_id: string }[];
      const otherPrep = prepRows.find((p) => p.user_id === other);
      const myPrep = prepRows.find((p) => p.user_id === userId);

      let order: ChatContext['order'] = null;
      const ors: string[] = [];
      if (otherPrep) ors.push(`and(customer_id.eq.${userId},prepper_id.eq.${otherPrep.id})`);
      if (myPrep) ors.push(`and(prepper_id.eq.${myPrep.id},customer_id.eq.${other})`);
      if (ors.length) {
        const { data: o } = await supabase
          .from('orders')
          .select('id,status,total,prepper_id,items:order_items(id,meal:meals(title))')
          .or(ors.join(','))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (o) {
          const row = o as unknown as { id: string; status: string; total: number; prepper_id: string; items: { id: string; meal: { title: string } | { title: string }[] | null }[] };
          const meal = one(row.items?.[0]?.meal);
          order = {
            id: row.id,
            status: row.status,
            total: Number(row.total),
            firstItem: meal?.title ?? null,
            items: row.items?.length ?? 0,
            iAmPrepper: !!myPrep && row.prepper_id === myPrep.id,
          };
        }
      }
      // Fetch any active home cook negotiation linked to this conversation.
      let homeCookRequest: HomeCookNegotiationCtx | null = null;
      const { data: hcRow } = await supabase
        .from('home_cook_requests')
        .select('id,status,requested_date,requested_time,address,guest_count,cuisine,ingredient_budget,cooking_fee,travel_fee,prepper_id')
        .eq('conversation_id', conversationId!)
        .in('status', ['pending', 'negotiating'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hcRow) {
        const h = hcRow as { id: string; status: string; requested_date: string; requested_time: string; address: string; guest_count: number; cuisine: string | null; ingredient_budget: number; cooking_fee: number | null; travel_fee: number | null; prepper_id: string };
        homeCookRequest = {
          id: h.id,
          status: h.status as 'pending' | 'negotiating',
          requestedDate: h.requested_date,
          requestedTime: h.requested_time,
          address: h.address,
          guestCount: h.guest_count,
          cuisine: h.cuisine,
          ingredientBudget: Number(h.ingredient_budget),
          cookingFee: h.cooking_fee != null ? Number(h.cooking_fee) : null,
          travelFee: h.travel_fee != null ? Number(h.travel_fee) : null,
          iAmPrepper: !!myPrep && h.prepper_id === myPrep.id,
        };
      }

      return { otherUserId: other, otherPhone: ((prof as { phone?: string | null } | null)?.phone as string | null) ?? null, order, homeCookRequest };
    },
  });
}

/** Start (or reuse) a 1:1 conversation; returns its id. */
export function useStartConversation() {
  return useMutation({
    mutationFn: async (otherUserId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('start_conversation', { p_other: otherUserId });
      if (error) throw error;
      return data as string;
    },
  });
}
