import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

// Review authors are public (shown on the meal page to everyone). profiles.full_name
// is PII, so display only "First L." instead of the reviewer's full legal name.
const maskName = (full?: string | null): string | null => {
  const t = (full ?? '').trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

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
  photos: string[];
  prepper_reply: string | null;
  replied_at: string | null;
};

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  photos: string[] | null;
  created_at: string;
  prepper_reply: string | null;
  replied_at: string | null;
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
        .select('id,rating,body,photos,created_at,prepper_reply,replied_at,author:profiles(display_name:full_name)')
        .eq('prepper_id', prepperId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as ReviewRow[]).map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        author: maskName(one(r.author)?.display_name) ?? 'a customer',
        created_at: r.created_at,
        photos: r.photos ?? [],
        prepper_reply: r.prepper_reply,
        replied_at: r.replied_at,
      }));
    },
  });
}

/** Prepper posts or edits a public reply on one of their reviews. */
export function useSubmitReply(reviewId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reply: string) => {
      const { error } = await supabase
        .from('reviews')
        .update({ prepper_reply: reply.trim().slice(0, 2000), replied_at: new Date().toISOString() })
        .eq('id', reviewId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      feedback.success();
    },
    onError: () => feedback.error(),
  });
}

export type ReviewDraft = {
  orderId: string;
  mealId: string;
  prepperId: string;
  rating: number;
  body: string;
  photos: string[];
};

/** Submit a review for a completed order — used by the review-order screen. */
export function useSubmitOrderReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: ReviewDraft) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('reviews').insert({
        order_id: draft.orderId,
        meal_id: draft.mealId || null,
        prepper_id: draft.prepperId,
        author_id: user.id,
        rating: draft.rating,
        body: draft.body.trim().slice(0, 2000) || null,
        photos: draft.photos.length ? draft.photos : [],
      });
      if (error) throw error;
    },
    onSuccess: (_d, draft) => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order-review', draft.orderId] });
    },
  });
}

/** Check whether the signed-in customer already reviewed a specific order. */
export function useOrderReview(orderId: string) {
  return useQuery({
    queryKey: ['order-review', orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, body')
        .eq('order_id', orderId)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
}

/** Submit a review for a completed order (RLS enforces completed + ownership). */
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { orderId: string; prepperId: string; mealId: string | null; rating: number; body: string; photos?: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('reviews').insert({
        order_id: v.orderId,
        author_id: user.id,
        prepper_id: v.prepperId,
        meal_id: v.mealId,
        rating: v.rating,
        body: v.body.trim().slice(0, 2000) || null,
        photos: v.photos?.length ? v.photos : [],
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
