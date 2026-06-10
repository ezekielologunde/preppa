import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import type { FulfillmentType, OrderStatus } from '@/types/database.types';

export type OrderLine = {
  id: string;
  title: string;
  image: string | null;
  quantity: number;
  total: number;
};

export type OrderSummary = {
  id: string;
  status: OrderStatus;
  subtotal: number;
  tip: number;
  total: number;
  created_at: string;
  prepperId: string;
  prepper: string;
  customer: string;
  paymentStatus: string | null;
  firstMealId: string | null;
  reviewed: boolean;
  fulfillment: FulfillmentType;
  fulfillmentNote: string | null;
  deliveryFee: number;
  items: OrderLine[];
  /** Pickup/meetup handoff code — present for the customer (RLS); null for the prepper. */
  handoff: { pin: string; token: string; verified: boolean } | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

// Customer names come from profiles.full_name (PII). The customer's name is
// shown to the prepper fulfilling the order, so reduce it to "First L." rather
// than exposing the full legal name.
const maskName = (full?: string | null): string | null => {
  const t = (full ?? '').trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

type Row = {
  id: string;
  prepper_id: string;
  status: OrderStatus;
  subtotal: number;
  tip: number;
  total: number;
  delivery_fee: number;
  fulfillment_type: FulfillmentType;
  fulfillment_note: string | null;
  created_at: string;
  prepper: { display_name: string } | { display_name: string }[] | null;
  customer: { display_name: string } | { display_name: string }[] | null;
  payment: { status: string } | { status: string }[] | null;
  review: { id: string }[] | null;
  handoff: { pin: string; token: string; verified_at: string | null } | { pin: string; token: string; verified_at: string | null }[] | null;
  items:
    | {
        id: string;
        meal_id: string;
        quantity: number;
        total: number;
        meal: { title: string; images: { url: string }[] | null } | { title: string; images: { url: string }[] | null }[] | null;
      }[]
    | null;
};

const SELECT =
  'id,prepper_id,status,subtotal,tip,total,delivery_fee,fulfillment_type,fulfillment_note,created_at,' +
  'prepper:prepper_profiles(display_name),' +
  'customer:profiles(display_name:full_name),' +
  'payment:payments(status),' +
  'review:reviews(id),' +
  'handoff:order_handoff(pin,token,verified_at),' +
  'items:order_items(id,meal_id,quantity,total,meal:meals(title,images:meal_images(url)))';

function toSummary(r: Row): OrderSummary {
  const prepper = one(r.prepper);
  const customer = one(r.customer);
  const payment = one(r.payment);
  return {
    id: r.id,
    status: r.status,
    subtotal: r.subtotal,
    tip: r.tip,
    total: r.total,
    created_at: r.created_at,
    prepperId: r.prepper_id,
    prepper: prepper?.display_name ?? 'preppa',
    customer: maskName(customer?.display_name) ?? 'customer',
    paymentStatus: payment?.status ?? null,
    firstMealId: r.items?.[0]?.meal_id ?? null,
    reviewed: !!(r.review && r.review.length),
    fulfillment: r.fulfillment_type,
    fulfillmentNote: r.fulfillment_note,
    deliveryFee: r.delivery_fee,
    items: (r.items ?? []).map((it) => {
      const meal = one(it.meal);
      return { id: it.id, title: meal?.title ?? 'meal', image: meal?.images?.[0]?.url ?? null, quantity: it.quantity, total: it.total };
    }),
    handoff: (() => {
      const h = one(r.handoff);
      return h ? { pin: h.pin, token: h.token, verified: !!h.verified_at } : null;
    })(),
  };
}

/** The signed-in customer's order history, newest first. */
export function useMyOrders(userId?: string | null) {
  return useQuery({
    queryKey: ['orders', 'mine', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<OrderSummary[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(SELECT)
        .eq('customer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(toSummary);
    },
  });
}

/** Incoming orders for a prepper's kitchen, newest first (optionally filtered by status). */
export function usePrepperOrders(prepperId?: string | null, status?: OrderStatus) {
  return useQuery({
    queryKey: ['orders', 'prepper', prepperId ?? 'none', status ?? 'all'],
    enabled: !!prepperId,
    refetchInterval: 20000,
    queryFn: async (): Promise<OrderSummary[]> => {
      let q = supabase.from('orders').select(SELECT).eq('prepper_id', prepperId!).order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(toSummary);
    },
  });
}

/**
 * Live order updates: refresh the order lists the moment a relevant order row
 * changes. Realtime enforces RLS, so each subscriber only hears about its own
 * orders. Polling stays as a safety net if the socket drops.
 */
export function useOrdersRealtime(column: 'customer_id' | 'prepper_id', value?: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!value) return;
    const channel = supabase
      .channel(`orders-${column}-${value}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `${column}=eq.${value}` },
        () => qc.invalidateQueries({ queryKey: ['orders'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [column, value, qc]);
}

/** Move an order to the next legal status (prepper/admin only — enforced server-side). */
export function useAdvanceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { orderId: string; next: OrderStatus }) => {
      const { error } = await supabase.rpc('advance_order', { p_order_id: v.orderId, p_next: v.next });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

/** Cancel an order (customer while pending; prepper before preparing; admin always). */
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export type HandoffResult = { ok: boolean; completed?: boolean; attempts_left?: number; locked?: boolean; reason?: string; order_id?: string };

/** Prepper enters the customer's pickup/meetup PIN to complete the handoff. */
export function useVerifyHandoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { orderId: string; pin: string }): Promise<HandoffResult> => {
      const { data, error } = await supabase.rpc('verify_handoff', { p_order_id: v.orderId, p_pin: v.pin });
      if (error) throw error;
      return data as unknown as HandoffResult;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

/** Prepper scans the customer's QR (/verify?t=) to complete the handoff. */
export function useVerifyHandoffToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<HandoffResult> => {
      const { data, error } = await supabase.rpc('verify_handoff_token', { p_token: token });
      if (error) throw error;
      return data as unknown as HandoffResult;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}
