import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type CartItem = {
  id: string;
  meal_id: string;
  quantity: number;
  price_snapshot: number;
  title: string;
  image: string | null;
  prepper: string;
  prepperId: string | null;
  prepTime: number | null;
  available: boolean;
};

type PrepperCol = { id: string; display_name: string; delivery_fee: number | null; delivery_min_order: number | null; delivers: boolean; pickup: boolean };
type CartItemRow = {
  id: string;
  meal_id: string;
  quantity: number;
  price_snapshot: number;
  created_at: string;
  meal: {
    title: string;
    status: string | null;
    prep_time_min: number | null;
    images: { url: string }[] | null;
    prepper: PrepperCol | PrepperCol[] | null;
  } | null;
};
type CartRootRow = { id: string; cart_items: CartItemRow[] };

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

/** Fallback lookup — only used by useAddToCart when the cart isn't yet cached. */
async function getCartId(userId: string): Promise<string | null> {
  const { data } = await supabase.from('carts').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export type Cart = { id: string | null; items: CartItem[]; subtotal: number; count: number; deliveryFee: number; deliveryMinOrder: number; delivers: boolean; pickup: boolean };

/** The user's cart with line items + computed subtotal. */
export function useCart(userId?: string | null) {
  return useQuery({
    queryKey: ['cart', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<Cart> => {
      const { data, error } = await supabase
        .from('carts')
        .select('id,cart_items(id,created_at,meal_id,quantity,price_snapshot,meal:meals(title,status,prep_time_min,images:meal_images(url),prepper:prepper_profiles(id,display_name,delivery_fee,delivery_min_order,delivers,pickup)))')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      const root = data as unknown as CartRootRow | null;
      if (!root) return { id: null, items: [], subtotal: 0, count: 0, deliveryFee: 3.99, deliveryMinOrder: 0, delivers: true, pickup: true };
      const rows = (root.cart_items ?? []).slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      const items: CartItem[] = rows.map((r) => {
        const prepper = one(r.meal?.prepper);
        return {
          id: r.id,
          meal_id: r.meal_id,
          quantity: r.quantity,
          price_snapshot: r.price_snapshot,
          title: r.meal?.title ?? 'meal',
          image: r.meal?.images?.[0]?.url ?? null,
          prepper: prepper?.display_name ?? 'preppa',
          prepperId: prepper?.id ?? null,
          prepTime: r.meal?.prep_time_min ?? null,
          available: r.meal?.status === 'published',
        };
      });
      const subtotal = items.reduce((s, i) => s + i.price_snapshot * i.quantity, 0);
      const count = items.reduce((s, i) => s + i.quantity, 0);
      const firstPrepper = one(rows[0]?.meal?.prepper);
      return { id: root.id, items, subtotal, count, deliveryFee: firstPrepper?.delivery_fee ?? 3.99, deliveryMinOrder: firstPrepper?.delivery_min_order ?? 0, delivers: firstPrepper?.delivers ?? true, pickup: firstPrepper?.pickup ?? true };
    },
  });
}

/** Add a meal to the cart (or bump quantity if already present). Pass `replace` to
 * empty the cart first — used when switching to a different prepper (one prepper per order). */
export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { userId: string; mealId: string; price: number; quantity?: number; replace?: boolean }) => {
      const cartId = qc.getQueryData<Cart>(['cart', v.userId])?.id ?? await getCartId(v.userId);
      if (!cartId) throw new Error('No cart found for this account.');
      if (v.replace) {
        const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId);
        if (error) throw error;
      }
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id,quantity')
        .eq('cart_id', cartId)
        .eq('meal_id', v.mealId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase.from('cart_items').update({ quantity: existing.quantity + (v.quantity ?? 1) }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cart_items').insert({
          cart_id: cartId,
          meal_id: v.mealId,
          quantity: v.quantity ?? 1,
          price_snapshot: v.price,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['cart', v.userId] }),
  });
}

/** Set a line item's quantity (0 removes it). Optimistic — the UI updates
 * instantly and rolls back only if the server rejects it. */
export function useUpdateCartItem(userId?: string | null) {
  const qc = useQueryClient();
  const key = ['cart', userId ?? 'anon'];
  return useMutation({
    mutationFn: async (v: { itemId: string; quantity: number }) => {
      if (v.quantity <= 0) {
        const { error } = await supabase.from('cart_items').delete().eq('id', v.itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cart_items').update({ quantity: v.quantity }).eq('id', v.itemId);
        if (error) throw error;
      }
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Cart>(key);
      if (prev) {
        const items = prev.items
          .map((it) => (it.id === v.itemId ? { ...it, quantity: v.quantity } : it))
          .filter((it) => it.quantity > 0);
        const subtotal = items.reduce((s, i) => s + i.price_snapshot * i.quantity, 0);
        const count = items.reduce((s, i) => s + i.quantity, 0);
        qc.setQueryData<Cart>(key, { id: prev.id, items, subtotal, count, deliveryFee: prev.deliveryFee, deliveryMinOrder: prev.deliveryMinOrder, delivers: prev.delivers, pickup: prev.pickup });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

function isAlreadyPaid(error: unknown): boolean {
  return (error as { context?: { status?: number } })?.context?.status === 409;
}

/** Start a Stripe Checkout for an order; returns the hosted payment-page URL. */
export function useStripeCheckout() {
  return useMutation({
    mutationFn: async (orderId: string): Promise<string> => {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { orderId } });
      if (error) {
        if (isAlreadyPaid(error)) throw Object.assign(new Error('Order already paid'), { alreadyPaid: true });
        throw error;
      }
      const url = (data as { url?: string; error?: string })?.url;
      if (!url) throw new Error((data as { error?: string })?.error || 'Could not start checkout.');
      return url;
    },
  });
}

export type EmbeddedPay = { clientSecret: string; pk: string } | { url: string };

/** In-app (embedded) Stripe Checkout — the customer pays without leaving
 * Preppa. Falls back to the hosted-page URL if the embedded mode is
 * unavailable for any reason. */
export function useEmbeddedCheckout() {
  return useMutation({
    mutationFn: async (orderId: string): Promise<EmbeddedPay> => {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { orderId, embedded: true } });
      if (error) {
        if (isAlreadyPaid(error)) throw Object.assign(new Error('Order already paid'), { alreadyPaid: true });
        throw error;
      }
      const d = data as { clientSecret?: string; pk?: string; url?: string; error?: string };
      if (d?.clientSecret && d?.pk) return { clientSecret: d.clientSecret, pk: d.pk };
      if (d?.url) return { url: d.url };
      throw new Error(d?.error || 'Could not start checkout.');
    },
  });
}

/** Best-effort refund for a cancelled order. No-ops if the order was never paid. */
export function useRefundOrder() {
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.functions.invoke('stripe-refund', { body: { orderId } });
      if (error) throw error;
    },
  });
}

/** Remove a set of line items by id (used to resolve a mixed-prepper cart). */
export function useRemoveItems(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!itemIds.length) return;
      const { error } = await supabase.from('cart_items').delete().in('id', itemIds);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart', userId ?? 'anon'] }),
  });
}

export type MultiOrderGroup = {
  prepperId: string;
  prepperName: string;
  items: CartItem[];
  fulfillment: import('@/types/database.types').FulfillmentType;
  addressId?: string | null;
  note?: string | null;
  tip?: number;
  scheduledAt?: string | null;
};

export type MultiOrderResult = { prepperId: string; prepperName: string; orderId: string };

/**
 * Place one sub-order per kitchen group sequentially.
 * Each group calls create_order once; results are returned in order.
 * On failure, throws with a `failedKitchen` property so the caller
 * can show which kitchen failed and allow retry.
 */
export function usePlaceMultipleOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      userId: string;
      groups: MultiOrderGroup[];
      onProgress?: (completed: number, total: number, kitchenName: string) => void;
    }): Promise<MultiOrderResult[]> => {
      const results: MultiOrderResult[] = [];
      for (let i = 0; i < v.groups.length; i++) {
        const g = v.groups[i];
        v.onProgress?.(i, v.groups.length, g.prepperName);
        const { data, error } = await supabase.rpc('create_order', {
          p_fulfillment: g.fulfillment,
          p_address_id: g.addressId ?? null,
          p_note: g.note ?? null,
          p_tip: g.tip ?? 0,
          p_scheduled_at: g.scheduledAt ?? null,
        });
        if (error) {
          const err = new Error(`Could not place order with ${g.prepperName}: ${error.message}`) as Error & { failedKitchen: string };
          err.failedKitchen = g.prepperName;
          throw err;
        }
        const orderId = data as string;
        supabase.rpc('record_event', { p_event: 'order_created', p_props: { order_id: orderId, fulfillment: g.fulfillment, prepper_id: g.prepperId } }).then(() => {}, () => {});
        // Fire-and-forget push notification to the prepper.
        void supabase.functions.invoke('notify-order-placed', {
          body: {
            order_id: orderId,
            prepper_id: g.prepperId,
            customer_name: 'A customer',
            meal_count: g.items.reduce((s, it) => s + it.quantity, 0),
            total: g.items.reduce((s, it) => s + it.price_snapshot * it.quantity, 0),
          },
        });
        results.push({ prepperId: g.prepperId, prepperName: g.prepperName, orderId });
      }
      return results;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['cart', v.userId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}

/** Place the order from the cart via the create_order RPC (server-priced). */
export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      userId: string;
      fulfillment: import('@/types/database.types').FulfillmentType;
      addressId?: string | null;
      note?: string | null;
      tip?: number;
      scheduledAt?: string | null;
      giftCardCode?: string | null;
      giftCardAmount?: number;
      /** Caller-supplied hints for the new-order push notification (optional). */
      notifyHints?: { prepperId: string; customerName: string; mealCount: number; total: number };
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('create_order', {
        p_fulfillment: v.fulfillment,
        p_address_id: v.addressId ?? null,
        p_note: v.note ?? null,
        p_tip: v.tip ?? 0,
        p_scheduled_at: v.scheduledAt ?? null,
        p_gift_card_code: v.giftCardCode ?? null,
        p_gift_card_amount: v.giftCardAmount ?? 0,
      });
      if (error) throw error;
      const orderId = data as string;
      // Fire-and-forget analytics — never block or fail the order on telemetry.
      supabase.rpc('record_event', { p_event: 'order_created', p_props: { order_id: orderId, fulfillment: v.fulfillment } }).then(() => {}, () => {});
      // Fire-and-forget push notification to the prepper.
      void (async () => {
        try {
          const hints = v.notifyHints;
          if (hints) {
            void supabase.functions.invoke('notify-order-placed', {
              body: {
                order_id: orderId,
                prepper_id: hints.prepperId,
                customer_name: hints.customerName,
                meal_count: hints.mealCount,
                total: hints.total,
              },
            });
          } else {
            // Fetch the minimal fields needed when hints weren't provided.
            const { data: row } = await supabase
              .from('orders')
              .select('prepper_id, total, items:order_items(quantity)')
              .eq('id', orderId)
              .single();
            if (row) {
              const r = row as unknown as { prepper_id: string; total: number; items: { quantity: number }[] };
              void supabase.functions.invoke('notify-order-placed', {
                body: {
                  order_id: orderId,
                  prepper_id: r.prepper_id,
                  customer_name: 'A customer',
                  meal_count: r.items.reduce((s, i) => s + i.quantity, 0),
                  total: r.total,
                },
              });
            }
          }
        } catch {
          // Notification errors are non-fatal.
        }
      })();
      return orderId;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['cart', v.userId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}
