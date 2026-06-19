import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type SavedMealItem = {
  savedId: string;
  savedAt: string;
  id: string;
  title: string;
  price: number;
  images: string[];
  rating: number;
  time: string;
  prepper: string;
};

/** All meals saved/bookmarked by a user, newest-first. */
export function useSavedMeals(userId?: string | null) {
  return useQuery({
    queryKey: ['saved-meals', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<SavedMealItem[]> => {
      const { data } = await supabase
        .from('saved_meals')
        .select(
          'id,created_at,' +
          'meal:meals(id,title,base_price,prep_time_min,' +
          'prepper:prepper_profiles(display_name),' +
          'images:meal_images(url),' +
          'rating:prepper_rating_summary(average_rating))'
        )
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      return (data ?? [])
        .map((row: unknown) => {
          const r = row as Record<string, unknown>;
          const m = (Array.isArray(r.meal) ? r.meal[0] : r.meal) as Record<string, unknown> | undefined;
          if (!m) return null;
          const prepperRaw = Array.isArray(m.prepper) ? m.prepper[0] : m.prepper;
          const prepperName = (prepperRaw as { display_name?: string } | undefined)?.display_name ?? 'preppa';
          const imgs = ((m.images ?? []) as { url: string }[]).map((i) => i.url).filter(Boolean);
          const ratingRaw = Array.isArray(m.rating) ? m.rating[0] : m.rating;
          const avgRating = (ratingRaw as { average_rating?: number } | undefined)?.average_rating ?? 0;
          const prep = m.prep_time_min as number | null;
          return {
            savedId: r.id as string,
            savedAt: r.created_at as string,
            id: m.id as string,
            title: m.title as string,
            price: m.base_price as number,
            images: imgs,
            rating: avgRating,
            time: prep ? `${Math.max(prep - 5, 5)}–${prep + 5} min` : '20–30 min',
            prepper: prepperName,
          } satisfies SavedMealItem;
        })
        .filter((x): x is SavedMealItem => x !== null);
    },
  });
}

/** Unsave a specific meal (delete-only, faster than the toggle for list actions). */
export function useUnsaveMeal(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mealId: string) => {
      await supabase.from('saved_meals').delete().eq('user_id', userId!).eq('meal_id', mealId);
    },
    onSuccess: (_data, mealId) => {
      qc.invalidateQueries({ queryKey: ['saved-meals', userId ?? 'anon'] });
      qc.invalidateQueries({ queryKey: ['saved-meal', userId, mealId] });
    },
  });
}
