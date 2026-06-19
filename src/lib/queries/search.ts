import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// ─── Autocomplete ─────────────────────────────────────────────────────────────

export type SuggestionItem = { type: 'meal' | 'kitchen'; label: string };

/**
 * Live autocomplete: up to 5 meal titles + 3 kitchen names matching the partial
 * query. Enabled only when the user has typed 2+ characters.
 */
export function useSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ['search-suggestions', query.trim().toLowerCase()],
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<SuggestionItem[]> => {
      const q = query.trim();

      const [{ data: meals }, { data: preppers }] = await Promise.all([
        supabase
          .from('meals')
          .select('title')
          .ilike('title', `%${q}%`)
          .eq('status', 'published')
          .limit(5),
        supabase
          .from('prepper_profiles')
          .select('display_name')
          .ilike('display_name', `%${q}%`)
          .limit(3),
      ]);

      const mealItems: SuggestionItem[] = (meals ?? []).map(
        (m: { title: string }) => ({ type: 'meal', label: m.title }),
      );
      const kitchenItems: SuggestionItem[] = (preppers ?? []).map(
        (p: { display_name: string }) => ({ type: 'kitchen', label: p.display_name }),
      );

      // Meal suggestions first, then kitchens, de-duplicated by label
      const seen = new Set<string>();
      const out: SuggestionItem[] = [];
      for (const item of [...mealItems, ...kitchenItems]) {
        const key = item.label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        if (out.length >= 7) break;
      }
      return out;
    },
  });
}

// ─── Trending ─────────────────────────────────────────────────────────────────

const STATIC_TRENDING = [
  'Jollof Rice', 'Pepper Soup', 'Suya', 'Egusi', 'Plantain', 'Fufu', 'Puff Puff',
];

/**
 * Trending search terms derived from order_items over the past 7 days.
 * Falls back to a static list when fewer than 3 DB results come back.
 * Long stale-time (1 hour) keeps network calls minimal.
 */
export function useTrendingSearches() {
  return useQuery({
    queryKey: ['trending-searches'],
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { data } = await supabase
        .from('order_items')
        .select('meal:meals(title)')
        .gte('created_at', since.toISOString())
        .limit(60);

      type MealTitleRow = { meal: { title: string } | { title: string }[] | null };
      const counts: Record<string, number> = {};
      for (const row of (data as unknown as MealTitleRow[] | null ?? [])) {
        const meal = Array.isArray(row.meal) ? row.meal[0] : row.meal;
        const title = meal?.title;
        if (title) counts[title] = (counts[title] ?? 0) + 1;
      }

      const dbTrending = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([label]) => label);

      return dbTrending.length >= 3 ? dbTrending : STATIC_TRENDING;
    },
  });
}
