import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

export type ReviewableOrder = {
  orderId: string;
  prepperId: string;
  prepper: string;
  mealId: string | null;
  summary: string; // e.g. "Jerk Chicken Bowl +2 more"
  created_at: string;
};

type ReviewableRow = {
  id: string;
  prepper_id: string;
  created_at: string;
  prepper: { display_name: string } | { display_name: string }[] | null;
  items: { meal_id: string; meal: { title: string } | { title: string }[] | null }[] | null;
  review: { id: string }[] | null;
};

/** Completed orders the signed-in customer hasn't reviewed yet. */
export function useReviewableOrders(userId?: string | null) {
  return useQuery({
    queryKey: ['reviews', 'reviewable', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<ReviewableOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('id,prepper_id,created_at,prepper:prepper_profiles(display_name),items:order_items(meal_id,meal:meals(title)),review:reviews(id)')
        .eq('customer_id', userId!)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as ReviewableRow[])
        .filter((r) => !(r.review && r.review.length))
        .map((r) => {
          const items = r.items ?? [];
          const first = one(items[0]?.meal);
          const more = items.length > 1 ? ` +${items.length - 1} more` : '';
          return {
            orderId: r.id,
            prepperId: r.prepper_id,
            prepper: one(r.prepper)?.display_name ?? 'preppa',
            mealId: items[0]?.meal_id ?? null,
            summary: (first?.title ?? 'your order') + more,
            created_at: r.created_at,
          };
        });
    },
  });
}

export type ReviewCard = {
  id: string;
  rating: number;
  body: string | null;
  author: string;
  created_at: string;
};

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  author: { display_name: string } | { display_name: string }[] | null;
};

/** Recent reviews for a prepper, newest first. */
export function usePrepperReviews(prepperId?: string | null, limit = 20) {
  return useQuery({
    queryKey: ['reviews', 'prepper', prepperId ?? 'none', limit],
    enabled: !!prepperId,
    queryFn: async (): Promise<ReviewCard[]> => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id,rating,body,created_at,author:profiles(display_name)')
        .eq('prepper_id', prepperId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as ReviewRow[]).map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        author: one(r.author)?.display_name ?? 'a customer',
        created_at: r.created_at,
      }));
    },
  });
}

/** Submit a review for a completed order (RLS enforces completed + ownership). */
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { orderId: string; authorId: string; prepperId: string; mealId: string | null; rating: number; body: string }) => {
      const { error } = await supabase.from('reviews').insert({
        order_id: v.orderId,
        author_id: v.authorId,
        prepper_id: v.prepperId,
        meal_id: v.mealId,
        rating: v.rating,
        body: v.body.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      void v;
    },
  });
}
