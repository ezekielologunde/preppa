import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Meal } from '@/components/meal-card';
import { supabase } from '@/lib/supabase';
import { isKitchenOpenNow, type CookSchedule } from '@/lib/queries/schedule';
import type { CustomerBadgeKey, PrepperBadgeKey, PrepperStatus } from '@/types/database.types';

export type TopPrepper = {
  id: string; name: string; verified: boolean; isPro?: boolean;
  rating: number; reviews: number; image: string; from: number | null; tags: string[];
  rank?: number;        // reputation rank within "Top kitchens" rail (1 = best)
  lat?: number | null;  // kitchen geo-coordinates
  lng?: number | null;
  distanceKm?: number;  // client-side computed via sortByDistance()
  isOpenNow: boolean;
};

type RankedRow = {
  id: string; display_name: string; verified: boolean; specialties: string[] | null;
  average_rating: number | string | null; total_reviews: number | null;
  from_price: number | string | null; image_url: string | null; rank: number;
  is_pro?: boolean; lat?: number | null; lng?: number | null;
};

type Row = {
  id: string;
  display_name: string;
  verified: boolean;
  specialties: string[] | null;
  cook_schedule: CookSchedule | null;
  rating: { average_rating: number; total_reviews: number } | { average_rating: number; total_reviews: number }[] | null;
  meals: { base_price: number; images: { url: string }[] }[] | null;
  prepper_memberships: { tier: string; status: string }[] | null;
};

const SELECT =
  'id,display_name,verified,specialties,cook_schedule,' +
  'rating:prepper_rating_summary(average_rating,total_reviews),' +
  'meals(base_price,images:meal_images(url)),' +
  'prepper_memberships(tier,status)';

function one<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

function mapPrepper(row: Row): TopPrepper {
  const rating = one(row.rating as never) as { average_rating: number; total_reviews: number } | undefined;
  const meals = row.meals ?? [];
  const prices = meals.map((m) => m.base_price).filter((p) => typeof p === 'number');
  const image = meals.flatMap((m) => m.images ?? []).map((i) => i.url)[0] ?? '';
  const isPro = (row.prepper_memberships ?? []).some((m) => m.tier === 'pro' && m.status === 'active');
  return {
    id: row.id,
    name: row.display_name,
    verified: row.verified,
    isPro,
    rating: rating?.average_rating ?? 0,
    reviews: rating?.total_reviews ?? 0,
    image,
    from: prices.length ? Math.min(...prices) : null,
    tags: row.specialties ?? [],
    isOpenNow: isKitchenOpenNow(row.cook_schedule),
  };
}

export type PrepperStats = {
  completed_orders: number; unique_customers: number; repeat_customers: number;
  followers: number; completion_rate: number | null; member_since: string | null;
};

export type PrepperProfile = {
  id: string; userId: string; name: string; bio: string | null; avatar: string | null;
  city: string | null; lat: number | null; lng: number | null;
  verified: boolean; isPro: boolean; specialties: string[]; certifications: string[];
  priceFrom: number | null; delivers: boolean; pickup: boolean;
  deliveryFee: number; deliveryRadius: number | null;
  acceptingOrders: boolean; homeCookAvailable: boolean;
  rating: number; reviews: number; fiveStar: number;
  stats: PrepperStats | null; meals: Meal[];
};

/** A public prepper profile: identity, trust stats, and their live menu. */
export function usePrepperProfile(prepperId?: string | null) {
  return useQuery({
    queryKey: ['prepper', 'profile', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<PrepperProfile> => {
      const [profileRes, mealsRes, statsRes, membershipRes] = await Promise.all([
        supabase
          .from('prepper_profiles')
          .select('id,user_id,display_name,bio,avatar_url,city,lat,lng,verified,specialties,certifications,price_from,delivers,pickup,delivery_fee,delivery_radius_km,accepting_orders,home_cook_available,rating:prepper_rating_summary(average_rating,total_reviews,five_star)')
          .eq('id', prepperId!)
          .single(),
        supabase
          .from('meals')
          .select('id,title,base_price,prep_time_min,created_at,images:meal_images(url),category:meal_categories(key)')
          .eq('prepper_id', prepperId!)
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase.rpc('prepper_public_stats', { p_prepper: prepperId! }),
        supabase
          .from('prepper_memberships')
          .select('tier,status')
          .eq('prepper_id', prepperId!)
          .eq('status', 'active')
          .maybeSingle(),
      ]);
      if (profileRes.error) throw profileRes.error;
      const membershipRow = membershipRes.data as { tier: string; status: string } | null;
      const isPro = membershipRow?.tier === 'pro' && membershipRow?.status === 'active';
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
        lat: (p.lat as number | null) ?? null,
        lng: (p.lng as number | null) ?? null,
        verified: !!p.verified,
        isPro,
        specialties: (p.specialties as string[] | null) ?? [],
        certifications: (p.certifications as string[] | null) ?? [],
        priceFrom: (p.price_from as number | null) ?? null,
        delivers: !!p.delivers,
        pickup: !!p.pickup,
        deliveryFee: Number(p.delivery_fee ?? 0),
        deliveryRadius: p.delivery_radius_km != null ? Number(p.delivery_radius_km) : null,
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
        isPro: r.is_pro === true,
        rating: Number(r.average_rating ?? 0),
        reviews: r.total_reviews ?? 0,
        image: r.image_url ?? '',
        from: r.from_price != null ? Number(r.from_price) : null,
        tags: r.specialties ?? [],
        rank: r.rank,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        isOpenNow: true, // RPC doesn't return schedule; treat as always available
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
  const q = query.trim().replace(/[,(){}]/g, ' ').replace(/\s+/g, ' ').trim();
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

// Follow/unfollow queries live in follows.ts — re-exported here for back-compat.
export { useMyFollowIds, useIsFollowing, useToggleFollow, useFollowedPreppers } from '@/lib/queries/follows';

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
  delivers: boolean; pickup: boolean; fee: number; minOrder: number;
  radius: number | null; days: number[] | null;
  windowStart: string | null; windowEnd: string | null;
  city: string | null; state: string | null;
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

type UpdateDeliverySettingsInput = {
  delivers: boolean; pickup: boolean; fee: number; minOrder: number;
  radius: number | null; days: number[] | null; windowStart: string | null;
  windowEnd: string | null; city?: string | null; state?: string | null;
};

/** Save a prepper's fulfillment configuration (full replace — pass all fields). */
export function useUpdateDeliverySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: UpdateDeliverySettingsInput) => {
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

type UpdateKitchenProfileInput = {
  displayName: string; bio: string | null; avatarUrl: string | null;
  specialties: string[]; city: string | null;
};

/** Update the signed-in prepper's kitchen profile (name, bio, avatar, specialties, city). */
export function useUpdateKitchenProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: UpdateKitchenProfileInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('prepper_profiles')
        .update({
          display_name: v.displayName,
          bio: v.bio || null,
          avatar_url: v.avatarUrl,
          specialties: v.specialties.length ? v.specialties : null,
          city: v.city || null,
        })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prepper', 'mine'] });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile'] });
      qc.invalidateQueries({ queryKey: ['preppers'] });
    },
  });
}

/** Set of prepper IDs with an active live session — polled every 30 s. */
export function useActiveLiveSessions() {
  return useQuery({
    queryKey: ['live-sessions-active'],
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('live_sessions')
        .select('prepper_id')
        .is('ended_at', null);
      return new Set(((data ?? []) as { prepper_id: string }[]).map((r) => r.prepper_id));
    },
  });
}

