import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// ─── Bid expiry helper ────────────────────────────────────────────────────────

export type BidExpiry = { label: string; urgent: boolean; expired: boolean };

/** Returns expiry state for a bid. Falls back to created_at + 48 h when no expires_at. */
export function getBidExpiry(createdAt: string, expiresAt: string | null): BidExpiry {
  const expiry = expiresAt ? new Date(expiresAt) : new Date(new Date(createdAt).getTime() + 48 * 3600 * 1000);
  const diffMs = expiry.getTime() - Date.now();
  if (diffMs <= 0) return { label: 'expired', urgent: false, expired: true };
  const diffH = diffMs / 3600000;
  if (diffH < 24) return { label: `expires in ${Math.ceil(diffH)}h`, urgent: true, expired: false };
  const diffD = Math.floor(diffH / 24);
  return { label: `expires in ${diffD}d`, urgent: false, expired: false };
}

export type MealRequest = {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  servings: number;
  budget_per_serving: number | null;
  cuisine: string | null;
  deadline: string | null;
  status: 'open' | 'fulfilled' | 'cancelled';
  created_at: string;
  poster: string;
  bid_count: number;
};

export type RequestBid = {
  id: string;
  request_id: string;
  prepper_id: string;
  price_per_serving: number;
  note: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  prepper_name: string;
};

const REQUEST_SELECT =
  'id,customer_id,title,description,servings,budget_per_serving,cuisine,deadline,status,created_at,' +
  'poster:profiles(full_name,email),' +
  'bid_count:meal_request_bids(count)';

type RequestRow = {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  servings: number;
  budget_per_serving: string | number | null;
  cuisine: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
  poster: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  bid_count: { count: number }[] | null;
};

function mapRequest(r: RequestRow): MealRequest {
  const poster = Array.isArray(r.poster) ? r.poster[0] : r.poster;
  const name = poster?.full_name ?? poster?.email?.split('@')[0] ?? 'customer';
  const bids = Array.isArray(r.bid_count) ? (r.bid_count[0]?.count ?? 0) : 0;
  return {
    id: r.id,
    customer_id: r.customer_id,
    title: r.title,
    description: r.description,
    servings: r.servings,
    budget_per_serving: r.budget_per_serving != null ? Number(r.budget_per_serving) : null,
    cuisine: r.cuisine,
    deadline: r.deadline,
    status: r.status as MealRequest['status'],
    created_at: r.created_at,
    poster: name,
    bid_count: bids,
  };
}

/** Open meal requests — visible to approved preppers only (RLS enforced). */
export function useMealRequests() {
  return useQuery({
    queryKey: ['meal-requests', 'open'],
    queryFn: async (): Promise<MealRequest[]> => {
      const { data, error } = await supabase
        .from('meal_requests')
        .select(REQUEST_SELECT)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as unknown as RequestRow[]).map(mapRequest);
    },
  });
}

/** Requests posted by the signed-in customer. */
export function useMyRequests(userId?: string | null) {
  return useQuery({
    queryKey: ['meal-requests', 'mine', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<MealRequest[]> => {
      const { data, error } = await supabase
        .from('meal_requests')
        .select(REQUEST_SELECT)
        .eq('customer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as RequestRow[]).map(mapRequest);
    },
  });
}

/** Post a new meal request (customer only). */
export function usePostMealRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      customerId: string;
      title: string;
      description?: string;
      servings: number;
      budgetPerServing?: number;
      cuisine?: string;
      deadline?: string;
    }) => {
      const { error } = await supabase.from('meal_requests').insert({
        customer_id: v.customerId,
        title: v.title.trim(),
        description: v.description?.trim() || null,
        servings: v.servings,
        budget_per_serving: v.budgetPerServing ?? null,
        cuisine: v.cuisine?.trim() || null,
        deadline: v.deadline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-requests', 'open'] });
      qc.invalidateQueries({ queryKey: ['meal-requests', 'mine'] });
    },
  });
}

/** Bids on a specific request (readable by the request owner + the bidding prepper). */
export function useRequestBids(requestId?: string | null) {
  return useQuery({
    queryKey: ['meal-request-bids', requestId ?? 'none'],
    enabled: !!requestId,
    queryFn: async (): Promise<RequestBid[]> => {
      const { data, error } = await supabase
        .from('meal_request_bids')
        .select('id,request_id,prepper_id,price_per_serving,note,status,created_at,prepper:prepper_profiles(display_name)')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as {
        id: string; request_id: string; prepper_id: string;
        price_per_serving: number; note: string | null; status: string;
        created_at: string; prepper: { display_name: string } | { display_name: string }[] | null;
      }[]).map((b) => ({
        id: b.id,
        request_id: b.request_id,
        prepper_id: b.prepper_id,
        price_per_serving: Number(b.price_per_serving),
        note: b.note,
        status: b.status as RequestBid['status'],
        created_at: b.created_at,
        prepper_name: (Array.isArray(b.prepper) ? b.prepper[0]?.display_name : b.prepper?.display_name) ?? 'prepper',
      }));
    },
  });
}

/** Place a bid on a request (approved preppers only). */
export function usePlaceBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { requestId: string; prepperId: string; pricePerServing: number; note?: string }) => {
      const { error } = await supabase.from('meal_request_bids').insert({
        request_id: v.requestId,
        prepper_id: v.prepperId,
        price_per_serving: v.pricePerServing,
        note: v.note?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['meal-requests', 'open'] });
      qc.invalidateQueries({ queryKey: ['meal-request-bids', v.requestId] });
    },
  });
}

// ─── Customer view: own requests with full bid details ────────────────────────

export type MyMealRequest = Omit<MealRequest, 'bid_count'> & {
  bids: Array<{
    id: string;
    prepperId: string;
    pricePerServing: number;
    note: string | null;
    status: RequestBid['status'];
    prepperName: string;
    created_at: string;
  }>;
};

const MY_REQUEST_SELECT =
  'id,customer_id,title,description,servings,budget_per_serving,cuisine,deadline,status,created_at,' +
  'poster:profiles(full_name,email),' +
  'bids:meal_request_bids(id,prepper_id,price_per_serving,note,status,created_at,prepper:prepper_profiles(display_name))';

/** Customer's own requests including all incoming bids. */
export function useMyRequestsWithBids(userId?: string | null) {
  return useQuery({
    queryKey: ['meal-requests', 'mine-bids', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<MyMealRequest[]> => {
      const { data, error } = await supabase
        .from('meal_requests')
        .select(MY_REQUEST_SELECT)
        .eq('customer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      type BidRow = { id: string; prepper_id: string; price_per_serving: number; note: string | null; status: string; created_at: string; prepper: { display_name: string } | { display_name: string }[] | null };
      type Row = Omit<RequestRow, 'bid_count'> & { bids: BidRow[] };
      return ((data ?? []) as unknown as Row[]).map((r) => {
        const poster = Array.isArray(r.poster) ? r.poster[0] : r.poster;
        return {
          id: r.id,
          customer_id: r.customer_id,
          title: r.title,
          description: r.description,
          servings: r.servings,
          budget_per_serving: r.budget_per_serving != null ? Number(r.budget_per_serving) : null,
          cuisine: r.cuisine,
          deadline: r.deadline,
          status: r.status as MealRequest['status'],
          created_at: r.created_at,
          poster: poster?.full_name ?? poster?.email?.split('@')[0] ?? 'customer',
          bids: (r.bids ?? []).map((b) => ({
            id: b.id,
            prepperId: b.prepper_id,
            pricePerServing: Number(b.price_per_serving),
            note: b.note,
            status: b.status as RequestBid['status'],
            prepperName: (Array.isArray(b.prepper) ? b.prepper[0]?.display_name : b.prepper?.display_name) ?? 'Prepper',
            created_at: b.created_at,
          })),
        };
      });
    },
  });
}

/** Accept a meal request bid — atomically accepts bid, rejects others, closes request, creates order. */
export function useAcceptMealBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { bidId: string; requestId: string; customerId?: string }) => {
      const { error } = await supabase.rpc('create_order_from_meal_bid', { p_bid_id: v.bidId });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['meal-requests', 'mine-bids'] });
      qc.invalidateQueries({ queryKey: ['meal-request-bids', v.requestId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      if (v.customerId) {
        supabase.functions.invoke('notify', {
          body: {
            user_id: v.customerId,
            title: 'Bid accepted!',
            body: 'Your bid was accepted — pay now to unlock the proposal.',
            data: { type: 'bid_accepted', bid_id: v.bidId },
          },
        }).catch(() => {});
      }
    },
  });
}

/** Start a Stripe Checkout for a bid payment (bid price + 10% service fee).
 *  Returns the hosted checkout URL to open in an in-app browser.
 *  The edge function receives the bidId and computes the amount server-side. */
export function useBidStripeCheckout() {
  return useMutation({
    mutationFn: async (v: { bidId: string; amountCents: number }): Promise<string> => {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { type: 'bid_payment', bidId: v.bidId, amount: v.amountCents },
      });
      if (error) throw error;
      const d = data as { url?: string; error?: string };
      if (!d?.url) throw new Error(d?.error ?? 'Could not start checkout.');
      return d.url;
    },
  });
}

// ─── Bid message thread ───────────────────────────────────────────────────────

export type BidMessage = { id: string; sender_id: string; body: string; created_at: string };

/** Fetches messages for a single bid, polling every 15 s when expanded. */
export function useBidMessages(bidId?: string | null) {
  return useQuery({
    queryKey: ['bid-messages', bidId ?? 'none'],
    enabled: !!bidId,
    refetchInterval: 15_000,
    queryFn: async (): Promise<BidMessage[]> => {
      const { data, error } = await supabase
        .from('bid_messages')
        .select('id,sender_id,body,created_at')
        .eq('bid_id', bidId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BidMessage[];
    },
  });
}

/** Sends a message in a bid thread and invalidates the message list. */
export function useSendBidMessage(bidId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ senderId, body }: { senderId: string; body: string }) => {
      const { error } = await supabase
        .from('bid_messages')
        .insert({ bid_id: bidId!, sender_id: senderId, body });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bid-messages', bidId] }),
  });
}
