import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import type { FulfillmentType, OrderStatus } from '@/types/database.types';

export type OrderLine = {
  id: string;
  mealId: string;
  title: string;
  image: string | null;
  quantity: number;
  total: number;
};

export type OrderSummary = {
  id: string;
  status: OrderStatus;
  customerId: string;
  subtotal: number;
  tip: number;
  total: number;
  service_fee: number | null;
  created_at: string;
  scheduled_at: string | null;
  prepperId: string;
  prepperUserId: string;
  prepper: string;
  customer: string;
  paymentStatus: string | null;
  firstMealId: string | null;
  reviewed: boolean;
  disputed: boolean;
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
  customer_id: string;
  status: OrderStatus;
  subtotal: number;
  tip: number;
  total: number;
  service_fee: number | null;
  delivery_fee: number;
  fulfillment_type: FulfillmentType;
  fulfillment_note: string | null;
  created_at: string;
  scheduled_at: string | null;
  prepper: { display_name: string; user_id: string } | { display_name: string; user_id: string }[] | null;
  customer: { display_name: string } | { display_name: string }[] | null;
  payment: { status: string } | { status: string }[] | null;
  review: { id: string }[] | null;
  dispute: { id: string }[] | null;
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
  'id,prepper_id,customer_id,status,subtotal,tip,total,service_fee,delivery_fee,fulfillment_type,fulfillment_note,created_at,scheduled_at,' +
  'prepper:prepper_profiles(display_name,user_id),' +
  'customer:profiles(display_name:full_name),' +
  'payment:payments(status),' +
  'review:reviews(id),' +
  'dispute:order_disputes(id),' +
  'handoff:order_handoff(pin,token,verified_at),' +
  'items:order_items(id,meal_id,quantity,total,meal:meals(title,images:meal_images(url)))';

function toSummary(r: Row): OrderSummary {
  const prepper = one(r.prepper);
  const customer = one(r.customer);
  const payment = one(r.payment);
  return {
    id: r.id,
    status: r.status,
    customerId: r.customer_id,
    subtotal: r.subtotal,
    tip: r.tip,
    total: r.total,
    service_fee: r.service_fee ?? null,
    created_at: r.created_at,
    scheduled_at: r.scheduled_at ?? null,
    prepperId: r.prepper_id,
    prepperUserId: prepper?.user_id ?? '',
    prepper: prepper?.display_name ?? 'preppa',
    customer: maskName(customer?.display_name) ?? 'customer',
    paymentStatus: payment?.status ?? null,
    firstMealId: r.items?.[0]?.meal_id ?? null,
    reviewed: !!(r.review && r.review.length),
    disputed: !!(r.dispute && r.dispute.length),
    fulfillment: r.fulfillment_type,
    fulfillmentNote: r.fulfillment_note,
    deliveryFee: r.delivery_fee,
    items: (r.items ?? []).map((it) => {
      const meal = one(it.meal);
      return { id: it.id, mealId: it.meal_id, title: meal?.title ?? 'meal', image: meal?.images?.[0]?.url ?? null, quantity: it.quantity, total: it.total };
    }),
    handoff: (() => {
      const h = one(r.handoff);
      return h ? { pin: h.pin, token: h.token, verified: !!h.verified_at } : null;
    })(),
  };
}

/** A single order by ID — same shape as the list query. */
export function useOrder(orderId?: string | null) {
  return useQuery({
    queryKey: ['orders', 'single', orderId ?? 'none'],
    enabled: !!orderId,
    queryFn: async (): Promise<OrderSummary> => {
      const { data, error } = await supabase
        .from('orders')
        .select(SELECT)
        .eq('id', orderId!)
        .single();
      if (error) throw error;
      return toSummary(data as unknown as Row);
    },
  });
}

/** The signed-in customer's order history, newest first. */
export function useMyOrders(userId?: string | null) {
  return useQuery({
    queryKey: ['orders', 'mine', userId ?? 'anon'],
    enabled: !!userId,
    // Poll every 30 s; stop polling after 3 consecutive errors to avoid hammering a failing endpoint.
    refetchInterval: (query) => {
      if (query.state.errorUpdateCount > 3) return false; // stop polling after 3 errors
      return 30_000;
    },
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

export type OrderItem = { id: string; quantity: number; price_at_time: number; title: string };

/** Line items for a single order, used in the expanded receipt panel. Cached forever — items never change after placement. */
export function useOrderItems(orderId?: string | null) {
  return useQuery({
    queryKey: ['order-items', orderId ?? 'none'],
    enabled: !!orderId,
    staleTime: Infinity,
    queryFn: async (): Promise<OrderItem[]> => {
      const { data, error } = await supabase
        .from('order_items')
        .select('id,quantity,price_at_time,meal:meals(title)')
        .eq('order_id', orderId!);
      if (error) throw error;
      return ((data ?? []) as unknown as { id: string; quantity: number; price_at_time: number; meal: { title: string } | { title: string }[] | null }[]).map((it) => {
        const meal = Array.isArray(it.meal) ? it.meal[0] : it.meal;
        return { id: it.id, quantity: it.quantity, price_at_time: it.price_at_time, title: meal?.title ?? 'meal' };
      });
    },
  });
}

/** Incoming orders for a prepper's kitchen, newest first (optionally filtered by status). */
export function usePrepperOrders(prepperId?: string | null, status?: OrderStatus) {
  return useQuery({
    queryKey: ['orders', 'prepper', prepperId ?? 'none', status ?? 'all'],
    enabled: !!prepperId,
    refetchInterval: (query) => {
      if (query.state.errorUpdateCount > 3) return false; // stop polling after 3 errors
      return 20_000;
    },
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

const NOTIFIABLE_STATUSES = new Set<OrderStatus>(['confirmed', 'preparing', 'ready', 'completed', 'cancelled']);

/** Move an order to the next legal status (prepper/admin only — enforced server-side). */
export function useAdvanceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { orderId: string; next: OrderStatus }) => {
      const { error } = await supabase.rpc('advance_order', { p_order_id: v.orderId, p_next: v.next });
      if (error) throw error;
      // Fire-and-forget push notification to the customer — never blocks the status update.
      if (NOTIFIABLE_STATUSES.has(v.next)) {
        void (async () => {
          try {
            const { data: row } = await supabase
              .from('orders')
              .select('customer_id, prepper:prepper_profiles(display_name)')
              .eq('id', v.orderId)
              .single();
            if (!row) return;
            const prepper = Array.isArray(row.prepper) ? row.prepper[0] : row.prepper;
            void supabase.functions.invoke('notify-order-status', {
              body: {
                order_id: v.orderId,
                customer_id: (row as { customer_id: string }).customer_id,
                status: v.next,
                kitchen_name: (prepper as { display_name: string } | null)?.display_name ?? null,
              },
            });
          } catch {
            // Notification errors are non-fatal.
          }
        })();
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

/** Cancel an order (customer while pending/confirmed; prepper before preparing; admin always). */
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { orderId: string; prepperUserId: string; customerName: string }) => {
      const { error } = await supabase.rpc('cancel_order', { p_order_id: v.orderId });
      if (error) throw error;
      // Notify the prepper so they don't prepare food that won't be picked up.
      void supabase.functions.invoke('notify', {
        body: {
          userId: v.prepperUserId,
          title: '❌ Order cancelled',
          body: `${v.customerName} cancelled their order #${v.orderId.slice(-6).toUpperCase()}`,
          data: { type: 'order_cancelled', order_id: v.orderId },
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export type OrderStatusStep = {
  key: string;
  label: string;
  description: string;
  icon: string;
};

export const STATUS_STEPS: OrderStatusStep[] = [
  { key: 'pending',          label: 'Order placed',      description: 'Waiting for kitchen to confirm',  icon: 'Clock' },
  { key: 'confirmed',        label: 'Order confirmed',   description: 'Kitchen has accepted your order', icon: 'CheckCircle' },
  { key: 'preparing',        label: 'Being prepared',    description: 'Chef is cooking your meal',       icon: 'UtensilsCrossed' },
  { key: 'out_for_delivery', label: 'On the way',        description: 'Your order is on its way!',       icon: 'Truck' },
  { key: 'ready',            label: 'Ready for pickup',  description: 'Your order is ready!',            icon: 'Package' },
  { key: 'completed',        label: 'Delivered',         description: 'Enjoy your meal!',                icon: 'Heart' },
];

/**
 * Wraps the existing useOrder hook and adds a real-time subscription that
 * invalidates the cache the moment the order row changes in Supabase.
 */
export function useOrderStatus(orderId: string | undefined | null) {
  const qc = useQueryClient();
  const query = useOrder(orderId);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, () => {
        void qc.invalidateQueries({ queryKey: ['orders', 'single', orderId] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orderId, qc]);

  return { ...query, steps: STATUS_STEPS };
}

export type TodayOrderSummary = {
  totalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  completedOrders: number;
  todayRevenue: number;
  urgentOrders: Array<{
    id: string;
    customerName: string;
    mealTitles: string[];
    total: number;
    createdAt: string;
    status: string;
  }>;
};

export function useTodayOrders(prepperId?: string | null) {
  return useQuery({
    queryKey: ['today-orders', prepperId ?? 'none'],
    enabled: !!prepperId,
    staleTime: 30_000,
    refetchInterval: (query) => {
      if (query.state.errorUpdateCount > 3) return false; // stop polling after 3 errors
      return 60_000;
    },
    queryFn: async (): Promise<TodayOrderSummary> => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id, status, total, created_at,
          customer:profiles(display_name:full_name),
          items:order_items(meal:meals(title))
        `)
        .eq('prepper_id', prepperId!)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: true });

      const rows = (orders ?? []) as any[];

      const pending = rows.filter(o => o.status === 'pending');
      const preparing = rows.filter(o => ['confirmed', 'preparing'].includes(o.status));
      const completed = rows.filter(o => o.status === 'completed');
      const todayRevenue = completed.reduce((s, o) => s + (o.total ?? 0), 0);

      const urgentOrders = [...pending, ...preparing].map(o => ({
        id: o.id,
        customerName: maskName((Array.isArray(o.customer) ? o.customer[0] : o.customer)?.display_name) ?? 'Customer',
        mealTitles: (o.items ?? []).map((it: any) => (Array.isArray(it.meal) ? it.meal[0] : it.meal)?.title ?? '').filter(Boolean),
        total: o.total,
        createdAt: o.created_at,
        status: o.status,
      }));

      return {
        totalOrders: rows.length,
        pendingOrders: pending.length,
        preparingOrders: preparing.length,
        completedOrders: completed.length,
        todayRevenue,
        urgentOrders,
      };
    },
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

export type OrderForReview = {
  id: string;
  status: string;
  prepper: { id: string; display_name: string; avatar_url: string | null } | null;
  items: { meal_id: string; qty: number; meal: { id: string; title: string; image: string | null } | null }[];
};

/** Minimal order detail used by the review-order screen. Cached forever. */
export function useOrderForReview(orderId: string) {
  return useQuery({
    queryKey: ['order-for-review', orderId],
    staleTime: Infinity,
    queryFn: async (): Promise<OrderForReview> => {
      const { data, error } = await supabase
        .from('orders')
        .select('id,status,prepper:prepper_profiles(id,display_name,avatar_url),items:order_items(meal_id,qty:quantity,meal:meals(id,title,images:meal_images(url)))')
        .eq('id', orderId)
        .single();
      if (error) throw error;
      const row = data as any;
      const prepper = Array.isArray(row.prepper) ? row.prepper[0] : row.prepper;
      const items = (row.items ?? []).map((it: any) => {
        const meal = Array.isArray(it.meal) ? it.meal[0] : it.meal;
        const imgs = meal?.images ?? [];
        const img = Array.isArray(imgs) ? imgs[0]?.url ?? null : null;
        return { meal_id: it.meal_id, qty: it.qty, meal: meal ? { id: meal.id, title: meal.title, image: img } : null };
      });
      return { id: row.id, status: row.status, prepper: prepper ?? null, items };
    },
  });
}

/** Customer files a dispute for an order (one per order; enforced by unique index). */
export function useReportDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { orderId: string; reason: string; reporterId: string }) => {
      const { error } = await supabase
        .from('order_disputes')
        .insert({ order_id: v.orderId, reporter_id: v.reporterId, reason: v.reason });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}
