import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type PlannerMeal = {
  id: string;
  name: string;
  category: string | null;
  availableDays: string[];
};

/** All published meals for a prepper with their available_days — powers the weekly planner. */
export function usePlannerMeals(prepperId: string) {
  return useQuery({
    queryKey: ['meal-planner', prepperId],
    enabled: !!prepperId,
    staleTime: 60_000,
    queryFn: async (): Promise<PlannerMeal[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select('id,title,available_days,category:meal_categories(key)')
        .eq('prepper_id', prepperId)
        .eq('status', 'published')
        .order('title');
      if (error) throw error;
      type Row = { id: string; title: string; available_days: string[] | null; category: { key: string } | { key: string }[] | null };
      return ((data ?? []) as unknown as Row[]).map((m) => ({
        id: m.id,
        name: m.title,
        category: (Array.isArray(m.category) ? m.category[0]?.key : m.category?.key) ?? null,
        availableDays: m.available_days ?? [],
      }));
    },
  });
}

/** Toggle a day on/off for a meal by updating available_days on the meals row.
 *  Pass `currentDays` from local state for optimistic updates; mutation result is the new array. */
export function useToggleMealDay(prepperId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mealId, day, currentDays }: { mealId: string; day: string; currentDays: string[] }): Promise<string[]> => {
      const next = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day];
      const { error } = await supabase
        .from('meals')
        .update({ available_days: next.length > 0 ? next : null })
        .eq('id', mealId);
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-planner', prepperId] });
      qc.invalidateQueries({ queryKey: ['my-meals', prepperId] });
    },
  });
}
