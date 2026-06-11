import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

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

/** Open meal requests — visible to everyone (customers + preppers). */
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
