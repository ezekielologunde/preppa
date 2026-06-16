import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Meal } from '@/components/meal-card';
import { supabase } from '@/lib/supabase';
import type { CustomerBadgeKey, PrepperBadgeKey, PrepperStatus } from '@/types/database.types';

export type TopPrepper = {
  id: string;
  name: string;
  verified: boolean;
  rating: number;
  reviews: number;
  image: string;
  from: number | null;
  tags: string[];
  /** Reputation rank within the "Top kitchens" rail (1 = best). */
  rank?: number;
};

type RankedRow = {
  id: string;
  display_name: string;
  verified: boolean;
  specialties: string[] | null;
  average_rating: number | string | null;
  total_reviews: number | null;
  from_price: number | string | null;
  image_url: string | null;
  rank: number;
};

type Row = {
  id: string;
  display_name: string;
  verified: boolean;
  specialties: string[] | null;
  rating: { average_rating: number; total_reviews: number } | { average_rating: number; total_reviews: number }[] | null;
  meals: { base_price: number; images: { url: string }[] }[] | null;
};

const SELECT =
  'id,display_name,verified,specialties,' +
  'rating:prepper_rating_summary(average_rating,total_reviews),' +
  'meals(base_price,images:meal_images(url))';

function one<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

function mapPrepper(row: Row): TopPrepper {
  const rating = one(row.rating as never) as { average_rating: number; total_reviews: number } | undefined;
  const meals = row.meals ?? [];
  const prices = meals.map((m) => m.base_price).filter((p) => typeof p === 'number');
  const image = meals.flatMap((m) => m.images ?? []).map((i) => i.url)[0] ?? '';
  return {
    id: row.id,
    name: row.display_name,
    verified: row.verified,
    rating: rating?.average_rating ?? 0,
    reviews: rating?.total_reviews ?? 0,
    image,
    from: prices.length ? Math.min(...prices) : null,
    tags: row.specialties ?? [],
  };
}

export type PrepperStats = {
  completed_orders: number;
  unique_customers: number;
  repeat_customers: number;
  followers: number;
  completion_rate: number | null;
  member_since: string | null;
};

export type PrepperProfile = {
  id: string;
  userId: string;
  name: string;
  bio: string | null;
  avatar: string | null;
  city: string | null;
  verified: boolean;
  specialties: string[];
  certifications: string[];
  priceFrom: number | null;
  delivers: boolean;
  pickup: boolean;
  acceptingOrders: boolean;
  homeCookAvailable: boolean;
  rating: number;
  reviews: number;
  fiveStar: number;
  stats: PrepperStats | null;
  meals: Meal[];
};

/** A public prepper profile: identity, trust stats, and their live menu. */
export function usePrepperProfile(prepperId?: string | null) {
  return useQuery({
    queryKey: ['prepper', 'profile', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<PrepperProfile> => {
      const [profileRes, mealsRes, statsRes] = await Promise.all([
        supabase
          .from('prepper_profiles')
          .select('id,user_id,display_name,bio,avatar_url,city,verified,specialties,certifications,price_from,delivers,pickup,accepting_orders,home_cook_available,rating:prepper_rating_summary(average_rating,total_reviews,five_star)')
          .eq('id', prepperId!)
          .single(),
        supabase
          .from('meals')
          .select('id,title,base_price,prep_time_min,created_at,images:meal_images(url),category:meal_categories(key)')
          .eq('prepper_id', prepperId!)
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase.rpc('prepper_public_stats', { p_prepper: prepperId! }),
      ]);
      if (profileRes.error) throw profileRes.error;
      const p = profileRes.data as unknown as Record<string, unknown>;
      const rating = one(p.rating as never) as { average_rating: number; total_reviews: number; five_star: number } | undefined;
      const mealRows = (mealsRes.data ?? []) as unknown as {
        id: string; title: string; base_price: number; prep_time_min: number | null;
        images: { url: string }[] | null; category: { key: string } | { key: string }[] | null;
      }[];
      const meals: Meal[] = mealRows.map((m) => {
        const imgs = (m.images ?? []).map((i) => i.url).filter(Boolean);
        const cat = one(m.category as never) as { key: string } | undefined;
        return {
          id: m.id,
          title: m.title,
          prepper: (p.display_name as string) ?? 'preppa',
          rating: rating?.average_rating ?? 0,
          reviews: rating?.total_reviews ?? 0,
          price: m.base_price,
          time: m.prep_time_min ? `${Math.max(m.prep_time_min - 5, 5)}–${m.prep_time_min + 5} min` : '20–30 min',
          image: imgs[0] ?? '',
          images: imgs,
          category: cat?.key ?? null,
        };
      });
      return {
        id: p.id as string,
        userId: (p.user_id as string) ?? '',
        name: (p.display_name as string) ?? 'preppa',
        bio: (p.bio as string | null) ?? null,
        avatar: (p.avatar_url as string | null) ?? null,
        city: (p.city as string | null) ?? null,
        verified: !!p.verified,
        specialties: (p.specialties as string[] | null) ?? [],
        certifications: (p.certifications as string[] | null) ?? [],
        priceFrom: (p.price_from as number | null) ?? null,
        delivers: !!p.delivers,
        pickup: !!p.pickup,
        acceptingOrders: p.accepting_orders !== false,
        homeCookAvailable: !!p.home_cook_available,
        rating: rating?.average_rating ?? 0,
        reviews: rating?.total_reviews ?? 0,
        fiveStar: rating?.five_star ?? 0,
        stats: (statsRes.data as PrepperStats) ?? null,
        meals,
      };
    },
  });
}

/** Verified preppers with their rating + a sample meal image / starting price. */
export function useTopPreppers(limit = 10) {
  return useQuery({
    queryKey: ['preppers', 'top', limit],
    queryFn: async (): Promise<TopPrepper[]> => {
      // Reputation-ranked (Bayesian rating + order volume + repeat-buyer rate).
      const { data, error } = await supabase.rpc('top_preppers_ranked', { p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as unknown as RankedRow[]).map((r) => ({
        id: r.id,
        name: r.display_name,
        verified: r.verified,
        rating: Number(r.average_rating ?? 0),
        reviews: r.total_reviews ?? 0,
        image: r.image_url ?? '',
        from: r.from_price != null ? Number(r.from_price) : null,
        tags: r.specialties ?? [],
        rank: r.rank,
      }));
    },
  });
}

/** Distinct discovery tags across approved kitchens, with counts (most first). */
export function useKitchenTags() {
  return useQuery({
    queryKey: ['preppers', 'tags'],
    queryFn: async (): Promise<{ tag: string; count: number }[]> => {
      const { data, error } = await supabase
        .from('prepper_profiles')
        .select('specialties')
        .eq('status', 'approved');
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { specialties: string[] | null }[]) {
        for (const t of row.specialties ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    },
  });
}

/** Approved kitchens carrying a given tag (identity/diet/cuisine). Public read. */
export function useKitchensByTag(tag?: string | null) {
  return useQuery({
    queryKey: ['preppers', 'by-tag', tag ?? 'all'],
    queryFn: async (): Promise<TopPrepper[]> => {
      let q = supabase.from('prepper_profiles').select(SELECT).eq('status', 'approved').eq('accepting_orders', true);
      if (tag) q = q.contains('specialties', [tag]);
      const { data, error } = await q.limit(30);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(mapPrepper);
    },
  });
}

/** Search approved preppers by name or specialty (public read). */
export function usePrepperSearch(query: string) {
  const q = query.trim().replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
  return useQuery({
    queryKey: ['preppers', 'search', q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<TopPrepper[]> => {
      const { data, error } = await supabase
        .from('prepper_profiles')
        .select(SELECT)
        .eq('status', 'approved')
        .eq('accepting_orders', true)
        .or(`display_name.ilike.%${q}%,specialties.cs.{${q}}`)
        .limit(12);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(mapPrepper);
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
      if (!userId) throw new Error('Sign in to follow kitchens');
      if (following) {
        const { error } = await supabase.from('follows').delete().eq('prepper_id', prepperId).eq('follower_id', userId);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from('follows').insert({ prepper_id: prepperId, follower_id: userId });
      if (error && error.code !== '23505') throw error; // ignore duplicate (already following)
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

export type MyPrepperApplication = {
  id: string;
  display_name: string;
  bio: string | null;
  status: PrepperStatus;
  verified: boolean;
  rejection_note: string | null;
} | null;

/** The signed-in user's own prepper application (null if they haven't applied). */
export function useMyPrepperApplication(userId?: string | null) {
  return useQuery({
    queryKey: ['prepper', 'mine', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<MyPrepperApplication> => {
      const { data, error } = await supabase
        .from('prepper_profiles')
        .select('id,display_name,bio,status,verified,rejection_note')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as MyPrepperApplication) ?? null;
    },
  });
}

/** Submit a prepper application — creates a pending prepper_profiles row. */
export function useApplyAsPrepper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { userId: string; displayName: string; bio: string; specialties: string[]; applicationDocuments?: string[] }) => {
      const { error } = await supabase.from('prepper_profiles').insert({
        user_id: v.userId,
        display_name: v.displayName,
        bio: v.bio || null,
        specialties: v.specialties.length ? v.specialties : null,
        application_documents: v.applicationDocuments?.length ? v.applicationDocuments : [],
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['prepper', 'mine', v.userId] }),
  });
}

/** Computed achievement badges for a prepper profile. */
export function usePrepperBadges(prepperId?: string | null) {
  return useQuery({
    queryKey: ['badges', 'prepper', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<PrepperBadgeKey[]> => {
      const { data, error } = await supabase.rpc('prepper_badges', { p_prepper: prepperId! });
      if (error) throw error;
      return (data as PrepperBadgeKey[]) ?? [];
    },
  });
}

/** Computed achievement badges for a customer. */
export function useCustomerBadges(userId?: string | null) {
  return useQuery({
    queryKey: ['badges', 'customer', userId ?? 'none'],
    enabled: !!userId,
    queryFn: async (): Promise<CustomerBadgeKey[]> => {
      const { data, error } = await supabase.rpc('customer_badges', { p_user: userId! });
      if (error) throw error;
      return (data as CustomerBadgeKey[]) ?? [];
    },
  });
}

export type DeliverySettings = {
  delivers: boolean;
  pickup: boolean;
  fee: number;
  minOrder: number;
  radius: number | null;
  days: number[] | null;
  windowStart: string | null;
  windowEnd: string | null;
  city: string | null;
  state: string | null;
};

/** Lightweight query for a prepper's delivery configuration — used in cart checkout. */
export function useDeliverySettings(prepperId?: string | null) {
  return useQuery({
    queryKey: ['prepper', 'delivery-settings', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<DeliverySettings> => {
      const { data, error } = await supabase
        .from('prepper_profiles')
        .select('delivers,pickup,delivery_fee,delivery_min_order,delivery_radius_km,delivery_days,delivery_window_start,delivery_window_end,city,state')
        .eq('id', prepperId!)
        .single();
      if (error) throw error;
      const r = data as Record<string, unknown>;
      return {
        delivers: r.delivers !== false,
        pickup: r.pickup !== false,
        fee: Number(r.delivery_fee ?? 3.99),
        minOrder: Number(r.delivery_min_order ?? 0),
        radius: r.delivery_radius_km != null ? Number(r.delivery_radius_km) : null,
        days: (r.delivery_days as number[] | null) ?? null,
        windowStart: (r.delivery_window_start as string | null) ?? null,
        windowEnd: (r.delivery_window_end as string | null) ?? null,
        city: (r.city as string | null) ?? null,
        state: (r.state as string | null) ?? null,
      };
    },
  });
}

/** Save a prepper's fulfillment configuration (full replace — pass all fields). */
export function useUpdateDeliverySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      delivers: boolean; pickup: boolean; fee: number; minOrder: number;
      radius: number | null; days: number[] | null;
      windowStart: string | null; windowEnd: string | null;
      city?: string | null; state?: string | null;
    }) => {
      const { error } = await supabase.rpc('update_delivery_settings', {
        p_delivers: v.delivers,
        p_pickup: v.pickup,
        p_delivery_fee: v.fee,
        p_delivery_min_order: v.minOrder,
        p_delivery_radius_km: v.radius,
        p_delivery_days: v.days,
        p_delivery_window_start: v.windowStart,
        p_delivery_window_end: v.windowEnd,
        p_city: v.city ?? null,
        p_state: v.state ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prepper', 'delivery-settings'] });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile'] });
      qc.invalidateQueries({ queryKey: ['preppers'] });
    },
  });
}

/** Toggle whether the signed-in prepper's kitchen is open for orders. */
export function useToggleAvailability(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (open: boolean) => {
      const { error } = await supabase.rpc('set_kitchen_availability', { p_open: open });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prepper', 'mine'] });
      if (prepperId) qc.invalidateQueries({ queryKey: ['prepper', 'profile', prepperId] });
      qc.invalidateQueries({ queryKey: ['preppers'] });
    },
  });
}

/** Toggle whether the signed-in prepper offers cook-at-home / private chef services. */
export function useToggleHomeCookAvailability(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (available: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('prepper_profiles')
        .update({ home_cook_available: available })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (prepperId) qc.invalidateQueries({ queryKey: ['prepper', 'profile', prepperId] });
      qc.invalidateQueries({ queryKey: ['prepper', 'mine'] });
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
        .select(`prepper:prepper_profiles(${SELECT})`)
        .eq('follower_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.prepper)
        .filter(Boolean)
        .map((p: Row) => mapPrepper(p));
    },
  });
}
