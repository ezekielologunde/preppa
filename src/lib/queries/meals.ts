import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Meal } from '@/components/meal-card';
import { supabase } from '@/lib/supabase';
import type { UserPrefs } from '@/lib/queries/user-prefs';
import { DETAIL_SELECT } from '@/lib/queries/meals-types';
export type { MealDetail, TrendingMeal, SearchFilters, SurpriseFilters } from '@/lib/queries/meals-types';
import type { MealDetail, TrendingMeal, SearchFilters, SurpriseFilters } from '@/lib/queries/meals-types';

type PrepperRating = { average_rating: number; total_reviews: number };
/** Shape returned by the meals select with embedded prepper + rating + images. */
type MealRow = {
  id: string; title: string; base_price: number; prep_time_min: number | null;
  created_at: string | null; is_limited: boolean; limited_qty: number | null;
  expires_at: string | null; available_days: string[] | null; dietary_tags: string[] | null;
  /** Computed by meal_remaining_qty(meals): null = unlimited, 0 = sold out, n = remaining. */
  remaining_qty: number | null;
  prepper: { display_name: string; verified: boolean; city: string | null; delivers: boolean | null; pickup: boolean | null; rating: PrepperRating | PrepperRating[] | null } | { display_name: string; verified: boolean; city: string | null; delivers: boolean | null; pickup: boolean | null; rating: unknown }[] | null;
  images: { url: string }[];
  category: { key: string } | { key: string }[] | null;
};

const SELECT =
  'id,title,base_price,prep_time_min,created_at,is_limited,limited_qty,expires_at,available_days,dietary_tags,' +
  'remaining_qty:meal_remaining_qty,' +
  'prepper:prepper_profiles!inner(display_name,verified,city,delivers,pickup,rating:prepper_rating_summary(average_rating,total_reviews)),' +
  'images:meal_images(url),' +
  'category:meal_categories(key)';

// Inner join variant — used when filtering by city so only meals from preppers
// in that city are returned. Falls back to SELECT (outer join) when < 3 results.
const SELECT_CITY_INNER = SELECT;

// For-you feed: adds prepper.id so we can match against follows.prepper_id.
const SELECT_FOR_YOU = SELECT.replace(
  'prepper_profiles!inner(display_name',
  'prepper_profiles!inner(id,display_name',
);

// One badge per card. Priority: social proof > diet > freshness.
function deriveBadge(row: MealRow, rating?: { average_rating: number; total_reviews: number }): Meal['badge'] {
  if (row.is_limited) return { label: 'limited drop', color: '#8b5cf6' };
  if ((rating?.average_rating ?? 0) >= 4.85 && (rating?.total_reviews ?? 0) >= 90) return { label: 'popular', color: '#E8611A' };
  const cat = one(row.category as never) as { key: string } | undefined;
  if (cat?.key === 'healthy') return { label: 'healthy', color: '#16a34a' };
  if (cat?.key === 'vegan') return { label: 'vegan', color: '#8b5cf6' };
  if (cat?.key === 'breakfast') return { label: 'breakfast', color: '#f59e0b' };
  const created = row.created_at ? new Date(row.created_at).getTime() : 0;
  if (created && Date.now() - created < 14 * 864e5) return { label: 'new', color: '#22c55e' };
  return undefined;
}

function one<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

function mapMeal(row: MealRow): Meal {
  const prepper = one(row.prepper as never);
  const rating = one((prepper as { rating?: unknown } | undefined)?.rating as never) as
    | { average_rating: number; total_reviews: number }
    | undefined;
  const prep = row.prep_time_min;
  const images = (row.images ?? []).map((i) => i.url).filter(Boolean);
  const cat = one(row.category as never) as { key: string } | undefined;
  return {
    id: row.id,
    title: row.title,
    prepper: (prepper as { display_name?: string } | undefined)?.display_name ?? 'preppa',
    rating: rating?.average_rating ?? 0,
    reviews: rating?.total_reviews ?? 0,
    price: row.base_price,
    time: prep ? `${Math.max(prep - 5, 5)}–${prep + 5} min` : '20–30 min',
    image: images[0] ?? '',
    images,
    category: cat?.key ?? null,
    badge: deriveBadge(row, rating),
    expiresAt: row.expires_at ?? null,
    inStock: row.remaining_qty !== null && row.remaining_qty <= 0 ? false : undefined,
    prepperCity: (prepper as { city?: string | null } | undefined)?.city ?? null,
    availableDays: row.available_days ?? null,
    dietaryTags: row.dietary_tags ?? null,
    delivers: (prepper as { delivers?: boolean | null } | undefined)?.delivers ?? undefined,
    pickup: (prepper as { pickup?: boolean | null } | undefined)?.pickup ?? undefined,
  };
}

/** Live published meals for the Home/Explore carousels (RLS: public read).
 *  Pass `city` to prioritise local kitchens — falls back to global feed when
 *  fewer than 3 local results exist (empty-city guard for new markets). */
export function useFeaturedMeals(limit = 10, city?: string | null) {
  return useQuery({
    queryKey: ['meals', 'featured', limit, city ?? 'all'],
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Meal[]> => {
      if (city) {
        const { data: local, error: localErr } = await supabase
          .from('meals')
          .select(SELECT_CITY_INNER)
          .eq('status', 'published')
          .eq('prepper.city', city)
          .limit(limit);
        if (!localErr && (local?.length ?? 0) >= 3) {
          return (local as unknown as MealRow[]).map(mapMeal);
        }
      }
      const { data, error } = await supabase
        .from('meals')
        .select(SELECT)
        .eq('status', 'published')
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as MealRow[]).map(mapMeal);
    },
  });
}

/** @deprecated Use useFollowingFeed from `@/lib/queries/feed` (includes feed_posts). */
export function useFollowingFeed(userId?: string | null, limit = 12) {
  return useQuery({
    queryKey: ['meals', 'following-feed', userId ?? 'anon', limit],
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Meal[]> => {
      // RLS lets a user read their own follow rows.
      const { data: follows, error: fErr } = await supabase
        .from('follows')
        .select('prepper_id')
        .eq('follower_id', userId!);
      if (fErr) throw fErr;
      const ids = (follows ?? []).map((f) => (f as { prepper_id: string }).prepper_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('meals')
        .select(SELECT)
        .eq('status', 'published')
        .in('prepper_id', ids)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as MealRow[]).map(mapMeal);
    },
  });
}

/** Live published meals filtered by category key (e.g. "dinner"); "all"/undefined = no filter. */
export function useMealsByCategory(categoryKey?: string, limit = 40) {
  const key = categoryKey && categoryKey !== 'all' ? categoryKey : undefined;
  return useQuery({
    queryKey: ['meals', 'category', key ?? 'all', limit],
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Meal[]> => {
      // Inner-join meal_categories so we can filter on its key; falls back to all when no key.
      const select = key
        ? SELECT.replace('category:meal_categories(key)', 'category:meal_categories!inner(key)')
        : SELECT;
      let q = supabase.from('meals').select(select).eq('status', 'published');
      if (key) q = q.eq('category.key', key);
      const { data, error } = await q.limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as MealRow[]).map(mapMeal);
    },
  });
}

/**
 * Search published meals by text and/or filters (RLS: public read).
 * Active with 2+ characters OR any filter — filters alone browse the catalog.
 */
export function useMealSearch(query: string, filters: SearchFilters = {}) {
  // PostgREST or() syntax breaks on commas/parens — strip them from user text.
  const q = query.trim().replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
  const { categoryId = null, priceMin = null, priceMax = null } = filters;
  const hasFilters = categoryId !== null || priceMin !== null || priceMax !== null;
  return useQuery({
    queryKey: ['meals', 'search', q, categoryId, priceMin, priceMax],
    enabled: q.length >= 2 || hasFilters,
    queryFn: async (): Promise<Meal[]> => {
      let req = supabase.from('meals').select(SELECT).eq('status', 'published');
      if (q.length >= 2) req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      if (categoryId !== null) req = req.eq('category_id', categoryId);
      if (priceMin !== null) req = req.gte('base_price', priceMin);
      if (priceMax !== null) req = req.lte('base_price', priceMax);
      const { data, error } = await req.limit(30);
      if (error) throw error;
      return ((data ?? []) as unknown as MealRow[]).map(mapMeal);
    },
  });
}

/** Full detail for one meal (RLS: published meals are public). */
export function useMeal(id?: string) {
  return useQuery({
    queryKey: ['meal', id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<MealDetail> => {
      const { data, error } = await supabase.from('meals').select(DETAIL_SELECT).eq('id', id!).single();
      if (error) throw error;
      const row = data as unknown as Record<string, unknown>;
      const prepper = one(row.prepper as never) as
        | { id: string; user_id: string; display_name: string; verified: boolean; bio: string | null; city: string | null; delivers: boolean | null; pickup: boolean | null; delivery_fee: number | null; delivery_radius_km: number | null; rating: unknown }
        | undefined;
      const rating = one(prepper?.rating as never) as { average_rating: number; total_reviews: number } | undefined;
      const prep = row.prep_time_min as number | null;
      const images = ((row.images as { url: string; order_index: number }[]) ?? [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((i) => i.url);
      const videoUrls = ((row.videos as { url: string; order_index: number }[]) ?? [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((v) => v.url);
      const nutrition = one(row.nutrition as never) as MealDetail['nutrition'] | undefined;
      return {
        id: row.id as string,
        title: row.title as string,
        description: (row.description as string | null) ?? null,
        price: row.base_price as number,
        time: prep ? `${Math.max(prep - 5, 5)}–${prep + 5} min` : '20–30 min',
        prepperId: prepper?.id ?? '',
        prepperUserId: prepper?.user_id ?? null,
        prepper: prepper?.display_name ?? 'preppa',
        prepperVerified: prepper?.verified ?? false,
        prepperBio: prepper?.bio ?? null,
        prepperCity: prepper?.city ?? null,
        prepperDelivers: prepper?.delivers !== false && prepper?.delivers != null ? !!prepper.delivers : false,
        prepperPickup: prepper?.pickup !== false && prepper?.pickup != null ? !!prepper.pickup : false,
        prepperDeliveryFee: Number(prepper?.delivery_fee ?? 0),
        prepperDeliveryRadius: prepper?.delivery_radius_km != null ? Number(prepper.delivery_radius_km) : null,
        rating: rating?.average_rating ?? 0,
        reviews: rating?.total_reviews ?? 0,
        images,
        videoUrls,
        nutrition: nutrition ?? null,
        isLimited: (row.is_limited as boolean) ?? false,
        expiresAt: (row.expires_at as string | null) ?? null,
        allergens: (row.allergens as string[] | null) ?? [],
        ingredients: (row.ingredients as string[] | null) ?? [],
        availableDays: (row.available_days as string[] | null) ?? null,
        dietaryTags: (row.dietary_tags as string[] | null) ?? null,
      } satisfies MealDetail;
    },
  });
}

/** Active limited drops — published meals where is_limited=true, not yet expired. */
export function useLimitedDrops(limit = 10) {
  return useQuery({
    queryKey: ['meals', 'limited-drops', limit],
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Meal[]> => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('meals')
        .select(SELECT)
        .eq('status', 'published')
        .eq('is_limited', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .or(`drops_at.is.null,drops_at.lte.${now}`)
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as MealRow[]).map(mapMeal);
    },
  });
}

/** Random published meal(s) matching the given budget + taste filters. */
export function useSurpriseMeals(filters: SurpriseFilters, enabled = true) {
  return useQuery({
    queryKey: ['meals', 'surprise', filters.maxPrice, filters.tags?.join(','), filters.categoryKey],
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Meal[]> => {
      let q = supabase.from('meals').select(SELECT).eq('status', 'published');
      if (filters.maxPrice) q = q.lte('base_price', filters.maxPrice);
      if (filters.categoryKey) {
        const sel = SELECT.replace('category:meal_categories(key)', 'category:meal_categories!inner(key)');
        q = supabase.from('meals').select(sel).eq('status', 'published').eq('category.key', filters.categoryKey);
        if (filters.maxPrice) q = q.lte('base_price', filters.maxPrice);
      }
      const { data, error } = await q.limit(50);
      if (error) throw error;
      const pool = ((data ?? []) as unknown as MealRow[]).map(mapMeal);
      if (!pool.length) return [];
      // Client-side shuffle + pick 3 for the surprise reveal
      const shuffled = pool.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(3, shuffled.length));
    },
  });
}

/** Newest published meals sorted by creation date — powers the "just dropped" feed section. */
export function useNewestMeals(limit = 8, city?: string | null) {
  return useQuery({
    queryKey: ['meals', 'newest', limit, city ?? 'all'],
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Meal[]> => {
      if (city) {
        const { data: local, error: localErr } = await supabase
          .from('meals')
          .select(SELECT_CITY_INNER)
          .eq('status', 'published')
          .eq('prepper.city', city)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (!localErr && (local?.length ?? 0) >= 3) {
          return (local as unknown as MealRow[]).map(mapMeal);
        }
      }
      const { data, error } = await supabase
        .from('meals')
        .select(SELECT)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as MealRow[]).map(mapMeal);
    },
  });
}

/** Other published meals from the same prepper, excluding the current one. Used for "more from this kitchen" carousel. */
export function useMealsByPrepper(prepperId?: string | null, excludeId?: string | null, limit = 6) {
  return useQuery({
    queryKey: ['meals', 'by-prepper', prepperId ?? 'none', excludeId ?? '', limit],
    enabled: !!prepperId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Meal[]> => {
      let q = supabase
        .from('meals')
        .select(SELECT)
        .eq('status', 'published')
        .eq('prepper_id', prepperId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (excludeId) q = q.neq('id', excludeId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as MealRow[]).map(mapMeal);
    },
  });
}

/** Fetch a specific set of meals by their IDs, preserving input order (favorites, recently-viewed, etc).
 *  No status filter — saved/viewed meals should appear even if later unpublished. */
export function useMealsByIds(ids: string[]) {
  return useQuery({
    queryKey: ['meals', 'by-ids', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Meal[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select(SELECT)
        .in('id', ids);
      if (error) throw error;
      const mapped = ((data ?? []) as unknown as MealRow[]).map(mapMeal);
      const byId = new Map(mapped.map((m) => [m.id, m]));
      return ids.map((id) => byId.get(id)).filter(Boolean) as Meal[];
    },
  });
}

/** Returns true when the given user has saved/wishlisted this meal. */
export function useIsMealSaved(userId?: string, mealId?: string) {
  return useQuery({
    queryKey: ['saved-meal', userId, mealId],
    enabled: !!userId && !!mealId,
    queryFn: async () => {
      const { data } = await supabase
        .from('saved_meals')
        .select('id')
        .eq('user_id', userId!)
        .eq('meal_id', mealId!)
        .maybeSingle();
      return !!data;
    },
  });
}

/** Toggle saved state — inserts when not saved, deletes when saved. */
export function useToggleSavedMeal(userId?: string, mealId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (isSaved: boolean) => {
      if (isSaved) {
        await supabase.from('saved_meals').delete().eq('user_id', userId!).eq('meal_id', mealId!);
      } else {
        await supabase.from('saved_meals').insert({ user_id: userId!, meal_id: mealId! });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-meal', userId, mealId] });
      qc.invalidateQueries({ queryKey: ['saved-meals', userId ?? 'anon'] });
    },
  });
}

// +3 per matching dietary tag; +2 if meal category matches a preferred cuisine.
function prefScore(meal: Meal, prefs: UserPrefs): number {
  let score = 0;
  if (prefs.dietary.length > 0 && meal.dietaryTags) {
    for (const tag of meal.dietaryTags) {
      if (prefs.dietary.includes(tag.toLowerCase())) score += 3;
    }
  }
  if (prefs.cuisines.length > 0 && meal.category) {
    const cat = meal.category.toLowerCase();
    if (prefs.cuisines.some((c) => c.toLowerCase() === cat)) score += 2;
  }
  return score;
}

/** Personalized feed: dietary + cuisine preferences boost first, then followed kitchens, then rating.
 *  Anon users receive the newest published meals. */
export function useForYouMeals(userId?: string | null, prefs?: UserPrefs) {
  return useQuery({
    queryKey: [
      'for-you',
      userId ?? 'anon',
      prefs?.dietary.join(',') ?? '',
      prefs?.cuisines.join(',') ?? '',
    ],
    staleTime: 300_000,
    queryFn: async (): Promise<Meal[]> => {
      if (!userId) {
        const { data } = await supabase
          .from('meals')
          .select(SELECT)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(8);
        return ((data ?? []) as unknown as MealRow[]).map(mapMeal);
      }

      const [followRes, mealsRes] = await Promise.all([
        supabase.from('follows').select('prepper_id').eq('follower_id', userId),
        supabase.from('meals').select(SELECT_FOR_YOU).eq('status', 'published')
          .order('created_at', { ascending: false }).limit(20),
      ]);

      const followedPrepperIds = new Set(
        (followRes.data ?? []).map((f: { prepper_id: string }) => f.prepper_id),
      );

      const rows = (mealsRes.data ?? []) as unknown as MealRow[];
      const activePrefs = prefs ?? { dietary: [], cuisines: [] };

      const scored = rows.map((row) => {
        const meal = mapMeal(row);
        const prepperRaw = one(row.prepper as never) as { id?: string } | undefined;
        const isFollowed = followedPrepperIds.has(prepperRaw?.id ?? '');
        let score = prefScore(meal, activePrefs);
        if (isFollowed) score += 1;
        score += meal.rating * 0.1;
        return { meal, score };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((s) => s.meal);
    },
  });
}

const TRENDING_SELECT = `meal_id, meal:meals!inner(${SELECT})`;
/** Most-ordered published meals in the last 7 days, ranked by order volume. */
export function useTrendingNowMeals() {
  return useQuery({
    queryKey: ['trending-now-meals'],
    staleTime: 300_000,
    queryFn: async (): Promise<TrendingMeal[]> => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data } = await supabase
        .from('order_items')
        .select(TRENDING_SELECT)
        .gte('created_at', since);
      const counts: Record<string, { count: number; meal: MealRow }> = {};
      for (const row of ((data ?? []) as unknown as { meal_id: string; meal: MealRow | MealRow[] }[])) {
        const meal = Array.isArray(row.meal) ? row.meal[0] : row.meal;
        if (!meal) continue;
        if (!counts[row.meal_id]) counts[row.meal_id] = { count: 0, meal };
        counts[row.meal_id].count++;
      }
      return Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map(({ meal, count }) => ({ ...mapMeal(meal), orderCount: count }));
    },
  });
}
