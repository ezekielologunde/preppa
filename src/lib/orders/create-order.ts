import { supabase } from '@/lib/supabase';

export type FulfillmentMethod = 'pickup' | 'delivery' | 'meetup';

export type CreateOrderResult = {
  order_id: string;
  /** Plaintext handoff PIN — returned exactly once; never re-fetchable. */
  pin: string;
  total_pence: number;
};

export type CreateOrderParams = {
  listingId: string;
  quantity: number;
  fulfillmentMethod?: FulfillmentMethod;
  notes?: string;
};

// Maps the create_order RPC's raised exceptions to customer-friendly copy.
const ERROR_COPY: Record<string, string> = {
  not_authenticated:           'Please sign in to place an order.',
  invalid_quantity:            'Please choose a quantity between 1 and 10.',
  listing_unavailable:         'This meal is no longer available.',
  listing_has_no_kitchen:      'This meal is not ready to order yet.',
  self_purchase_not_allowed:   "You can't order from your own kitchen.",
  kitchen_not_accepting_orders:"This kitchen isn't taking orders right now.",
};

export function orderErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  // RPC errors arrive as "self_purchase_not_allowed" or "kitchen_not_accepting_orders: vacation"
  const key = raw.split(':')[0].trim();
  return ERROR_COPY[key] ?? 'Something went wrong placing your order. Please try again.';
}

/**
 * Places an order via the create_order RPC: atomically creates the order, its
 * item, a pending payment, and a one-time handoff PIN (returned once).
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { data, error } = await supabase.rpc('create_order', {
    p_listing_id:         params.listingId,
    p_quantity:           params.quantity,
    p_fulfillment_method: params.fulfillmentMethod ?? 'pickup',
    p_notes:              params.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as CreateOrderResult;
}

/**
 * Starts payment for an existing order. Returns a hosted Stripe Checkout URL the
 * caller opens; on success the webhook captures the payment into escrow.
 */
export async function payForOrder(orderId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { order_id: orderId },
  });
  if (error) throw new Error(error.message ?? 'Could not start checkout');
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error('No checkout URL returned');
  return url;
}
