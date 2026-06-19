import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { isKitchenOpenNow, type CookSchedule } from '@/lib/queries/schedule';

// Inline type — mirrors TopPrepper from preppers.ts; avoids circular import.
type TopPrepper = {
  id: string; name: string; verified: boolean; isPro?: boolean;
  rating: number; reviews: number; image: string; from: number | null; tags: string[];
  rank?: number; lat?: number | null; lng?: number | null; distanceKm?: number;
  isOpenNow: boolean;
};

// Minimal helpers for useFollowedPreppers (mirrors internals in preppers.ts).
type FollowRow = {
  id: string; display_name: string; verified: boolean; specialties: string[] | null;
  cook_schedule: CookSchedule | null;
  rating: { average_rating: number; total_reviews: number } | { average_rating: number; total_reviews: number }[] | null;
  meals: { base_price: number; images: { url: string }[] }[] | null;
  prepper_memberships: { tier: string; status: string }[] | null;
};

const FOLLOW_SELECT =
  'id,display_name,verified,specialties,cook_schedule,' +
  'rating:prepper_rating_summary(average_rating,total_reviews),' +
  'meals(base_price,images:meal_images(url)),' +
  'prepper_memberships(tier,status)';

function oneVal<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

function mapFollowRow(row: FollowRow): TopPrepper {
  const rating = oneVal(row.rating as never) as { average_rating: number; total_reviews: number } | undefined;
  const meals = row.meals ?? [];
  const prices = meals.map((m) => m.base_price).filter((p) => typeof p === 'number');
  const image = meals.flatMap((m) => m.images ?? []).map((i) => i.url)[0] ?? '';
  const isPro = (row.prepper_memberships ?? []).some((m) => m.tier === 'pro' && m.status === 'active');
  return {
    id: row.id, name: row.display_name, verified: row.verified, isPro,
    rating: rating?.average_rating ?? 0, reviews: rating?.total_reviews ?? 0,
    image, from: prices.length ? Math.min(...prices) : null, tags: row.specialties ?? [],
    isOpenNow: isKitchenOpenNow(row.cook_schedule),
  };
}

export type FollowedKitchen = { prepperId: string; displayName: string; avatarUrl: string | null; city: string | null; rating: number; mealCount: number; followedAt: string };

/** Rich following list for the /following screen — avatar, city, rating, meal count. */
export function useFollowingList(userId?: string | null) {
  return useQuery({
    queryKey: ['following-list', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<FollowedKitchen[]> => {
      const { data, error } = await supabase
        .from('follows')
        .select(`
          created_at,
          prepper:prepper_profiles(
            id, display_name, avatar_url, city,
            rating:prepper_rating_summary(average_rating),
            meals(count)
          )
        `)
        .eq('follower_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => {
        const r = row as { created_at: string; prepper: unknown };
        const p = Array.isArray(r.prepper) ? r.prepper[0] : r.prepper;
        if (!p) return null;
        const pr = p as { id: string; display_name: string; avatar_url: string | null; city: string | null; rating: unknown; meals: unknown[] | null };
        const ratingObj = Array.isArray(pr.rating) ? pr.rating[0] : pr.rating;
        const ratingVal = (ratingObj as { average_rating?: number } | null)?.average_rating ?? 0;
        const mealsArr = pr.meals ?? [];
        const mealCount = mealsArr.length > 0 ? ((mealsArr[0] as { count?: number }).count ?? 0) : 0;
        return {
          prepperId: pr.id,
          displayName: pr.display_name,
          avatarUrl: pr.avatar_url,
          city: pr.city,
          rating: Number(ratingVal),
          mealCount,
          followedAt: r.created_at,
        };
      }).filter(Boolean) as FollowedKitchen[];
    },
  });
}

/** Remove a follow — invalidates list + toggle queries. */
export function useUnfollowKitchen(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prepperId: string) => {
      if (!userId) throw new Error('Sign in to unfollow');
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('prepper_id', prepperId);
      if (error) throw error;
    },
    onSuccess: (_d, prepperId) => {
      qc.invalidateQueries({ queryKey: ['following-list', userId ?? 'anon'] });
      qc.invalidateQueries({ queryKey: ['follows', 'preppers', userId ?? 'anon'] });
      qc.invalidateQueries({ queryKey: ['follows', 'mine', userId ?? 'anon'] });
      qc.invalidateQueries({ queryKey: ['follow', prepperId, userId ?? 'anon'] });
    },
  });
}

/** All prepper IDs the signed-in user follows — one query for the whole feed. */
export function useMyFollowIds(userId?: string | null) {
  return useQuery({
    queryKey: ['follows', 'mine', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('follows')
        .select('prepper_id')
        .eq('follower_id', userId!);
      if (error) throw error;
      return (data ?? []).map((r) => (r as { prepper_id: string }).prepper_id);
    },
  });
}

/** Whether the signed-in user follows this kitchen (own follow row is readable). */
export function useIsFollowing(prepperId?: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ['follow', prepperId ?? 'none', userId ?? 'anon'],
    enabled: !!prepperId && !!userId,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from('follows')
        .select('prepper_id', { count: 'exact', head: true })
        .eq('prepper_id', prepperId!)
        .eq('follower_id', userId!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

/** Follow / unfollow a kitchen. Optimistic; refreshes follower count + state. */
export function useToggleFollow(prepperId: string, userId?: string | null) {
  const qc = useQueryClient();
  const key = ['follow', prepperId, userId ?? 'anon'];
  return useMutation({
    mutationFn: async (following: boolean): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in to follow kitchens');
      if (following) {
        const { error } = await supabase.from('follows').delete().eq('prepper_id', prepperId).eq('follower_id', user.id);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from('follows').insert({ prepper_id: prepperId, follower_id: user.id });
      if (error && error.code !== '23505') throw error; // ignore duplicate (already following)

      // Push-notify the prepper: look up their user_id and the follower's display name.
      const [prepperRes, followerRes] = await Promise.all([
        supabase.from('prepper_profiles').select('user_id').eq('id', prepperId).single(),
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      ]);
      const prepperUserId = (prepperRes.data as { user_id: string } | null)?.user_id;
      const followerName = (followerRes.data as { full_name: string | null } | null)?.full_name ?? 'Someone';
      if (prepperUserId) {
        supabase.functions.invoke('notify', {
          body: {
            user_id: prepperUserId,
            title: 'New follower',
            body: `🎉 ${followerName} started following your kitchen!`,
            data: { type: 'new_follower', follower_id: userId },
          },
        }).catch(() => {}); // fire-and-forget; don't block the follow action
      }

      return true;
    },
    onMutate: async (following) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<boolean>(key);
      qc.setQueryData(key, !following);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx) qc.setQueryData(key, ctx.prev); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile', prepperId] });
      qc.invalidateQueries({ queryKey: ['follows', 'mine', userId ?? 'anon'] });
      qc.invalidateQueries({ queryKey: ['follows', 'preppers', userId ?? 'anon'] });
    },
  });
}

/** Preppers the signed-in user follows, ordered by when they were followed. */
export function useFollowedPreppers(userId?: string | null) {
  return useQuery({
    queryKey: ['follows', 'preppers', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<TopPrepper[]> => {
      const { data, error } = await supabase
        .from('follows')
        .select(`prepper:prepper_profiles(${FOLLOW_SELECT})`)
        .eq('follower_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.prepper)
        .filter(Boolean)
        .map((p: FollowRow) => mapFollowRow(p));
    },
  });
}
