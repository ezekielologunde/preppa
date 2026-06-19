import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type HomeCookRequest = {
  id: string;
  customerId: string;
  prepperId: string;
  requestedDate: string;
  requestedTime: 'morning' | 'afternoon' | 'evening' | 'late_night';
  address: string;
  guestCount: number;
  cuisine: string | null;
  menuIdeas: string | null;
  ingredientBudget: number;
  cookingFee: number | null;
  travelFee: number | null;
  status: 'pending' | 'negotiating' | 'confirmed' | 'cancelled';
  orderId: string | null;
  conversationId: string | null;
  createdAt: string;
  customerName: string | null;
};

const HC_SELECT =
  'id,customer_id,prepper_id,requested_date,requested_time,address,guest_count,cuisine,menu_ideas,' +
  'ingredient_budget,cooking_fee,travel_fee,status,order_id,conversation_id,created_at,' +
  'customer:profiles(full_name)';

type HCRow = {
  id: string; customer_id: string; prepper_id: string; requested_date: string;
  requested_time: string; address: string; guest_count: number; cuisine: string | null;
  menu_ideas: string | null; ingredient_budget: number | string; cooking_fee: number | string | null;
  travel_fee: number | string | null; status: string; order_id: string | null;
  conversation_id: string | null; created_at: string;
  customer: { full_name: string | null } | { full_name: string | null }[] | null;
};

function mapRow(r: HCRow): HomeCookRequest {
  const c = Array.isArray(r.customer) ? r.customer[0] : r.customer;
  return {
    id: r.id,
    customerId: r.customer_id,
    prepperId: r.prepper_id,
    requestedDate: r.requested_date,
    requestedTime: r.requested_time as HomeCookRequest['requestedTime'],
    address: r.address,
    guestCount: r.guest_count,
    cuisine: r.cuisine,
    menuIdeas: r.menu_ideas,
    ingredientBudget: Number(r.ingredient_budget),
    cookingFee: r.cooking_fee != null ? Number(r.cooking_fee) : null,
    travelFee: r.travel_fee != null ? Number(r.travel_fee) : null,
    status: r.status as HomeCookRequest['status'],
    orderId: r.order_id,
    conversationId: r.conversation_id,
    createdAt: r.created_at,
    customerName: c?.full_name ?? null,
  };
}

/** Customer's own home cook requests (all statuses). */
export function useMyHomeCookRequests(userId?: string | null) {
  return useQuery({
    queryKey: ['home-cook', 'mine', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<HomeCookRequest[]> => {
      const { data, error } = await supabase
        .from('home_cook_requests')
        .select(HC_SELECT)
        .eq('customer_id', userId!)
        .in('status', ['pending', 'negotiating', 'confirmed'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as HCRow[]).map(mapRow);
    },
  });
}

/** Prepper's incoming home cook requests awaiting action (pending + negotiating). */
export function usePrepperHomeCookRequests(prepperId?: string | null) {
  return useQuery({
    queryKey: ['home-cook', 'prepper', prepperId ?? 'none'],
    enabled: !!prepperId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<HomeCookRequest[]> => {
      const { data, error } = await supabase
        .from('home_cook_requests')
        .select(HC_SELECT)
        .eq('prepper_id', prepperId!)
        .in('status', ['pending', 'negotiating'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as HCRow[]).map(mapRow);
    },
  });
}

/** Submit a new home cook request (customer). */
export function useCreateHomeCookRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      prepperId: string;
      requestedDate: string;
      requestedTime: string;
      address: string;
      guestCount: number;
      cuisine?: string;
      menuIdeas?: string;
      ingredientBudget: number;
    }): Promise<{ requestId: string; conversationId: string | null }> => {
      const { data, error } = await supabase.rpc('create_home_cook_request', {
        p_prepper_id: v.prepperId,
        p_requested_date: v.requestedDate,
        p_requested_time: v.requestedTime,
        p_address: v.address,
        p_guest_count: v.guestCount,
        p_cuisine: v.cuisine?.trim().slice(0, 50) || null,
        p_menu_ideas: v.menuIdeas?.trim().slice(0, 1000) || null,
        p_ingredient_budget: v.ingredientBudget,
      });
      if (error) throw error;
      const requestId = data as string;
      const { data: req } = await supabase
        .from('home_cook_requests')
        .select('conversation_id')
        .eq('id', requestId)
        .maybeSingle();
      return { requestId, conversationId: (req as { conversation_id: string | null } | null)?.conversation_id ?? null };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['home-cook', 'mine'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/** Prepper proposes cooking fee + travel fee (moves status to 'negotiating'). */
export function useProposeHomeCookTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { requestId: string; cookingFee: number; travelFee: number }) => {
      const { error } = await supabase.rpc('propose_home_cook_terms', {
        p_request_id: v.requestId,
        p_cooking_fee: v.cookingFee,
        p_travel_fee: v.travelFee,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['home-cook'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/** Customer accepts terms → creates confirmed order and holds payment. */
export function useConfirmHomeCookBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('confirm_home_cook_booking', { p_request_id: requestId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['home-cook'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/** Either party cancels a pending/negotiating request. */
export function useCancelHomeCookRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { requestId: string; reason?: string }) => {
      const { error } = await supabase.rpc('cancel_home_cook_request', {
        p_request_id: v.requestId,
        p_reason: v.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['home-cook'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/**
 * Prepper captures the card hold after the customer verifies their handoff PIN.
 * Fire-and-forget — failure is logged but does not block order completion.
 */
export function useCaptureHomeCookPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.functions.invoke('stripe-capture-home-cook', { body: { orderId } });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['home-cook'] });
    },
    onError: (e) => console.error('[HC capture] failed:', e instanceof Error ? e.message : e),
  });
}

/**
 * After confirm_home_cook_booking returns an order_id, call the Stripe edge function
 * to create a PaymentIntent with capture_method:'manual' (card hold), then store
 * the intent ID on the request row. Actual capture happens when the session completes.
 */
export function useCreateHomeCookPaymentIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { requestId: string; orderId: string; amountCents: number }): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<{ clientSecret: string; paymentIntentId: string }>(
        'stripe-home-cook-payment',
        { body: { requestId: v.requestId, orderId: v.orderId, amountCents: v.amountCents } },
      );
      if (error) throw error;
      const intentId = data?.paymentIntentId;
      if (!intentId) throw new Error('No paymentIntentId returned from edge function');

      const { error: rpcError } = await supabase.rpc('set_home_cook_payment_intent', {
        p_request_id: v.requestId,
        p_payment_intent_id: intentId,
      });
      if (rpcError) throw rpcError;

      return data.clientSecret;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['home-cook'] });
    },
  });
}
