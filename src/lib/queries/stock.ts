import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type MealStock = {
  mealId: string;
  date: string;
  qtyTotal: number;
  qtySold: number;
  qtyRemaining: number;
};

/** Fetch today's stock for a list of meal IDs — keyed by meal ID. */
export function useTodayStock(mealIds: string[]) {
  return useQuery({
    queryKey: ['meal-stock', 'today', mealIds],
    enabled: mealIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Record<string, MealStock>> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('meal_stock')
        .select('meal_id, qty_total, qty_sold')
        .eq('date', today)
        .in('meal_id', mealIds);

      const result: Record<string, MealStock> = {};
      for (const row of (data ?? []) as { meal_id: string; qty_total: number; qty_sold: number }[]) {
        result[row.meal_id] = {
          mealId: row.meal_id,
          date: today,
          qtyTotal: row.qty_total,
          qtySold: row.qty_sold,
          qtyRemaining: row.qty_total - row.qty_sold,
        };
      }
      return result;
    },
  });
}

/** Fetch today's stock for a single meal — used in the editor form. */
export function useTodaySingleStock(mealId?: string) {
  return useQuery({
    queryKey: ['meal-stock', 'today', mealId ? [mealId] : []],
    enabled: !!mealId,
    staleTime: 30_000,
    queryFn: async (): Promise<MealStock | null> => {
      if (!mealId) return null;
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('meal_stock')
        .select('meal_id, qty_total, qty_sold')
        .eq('meal_id', mealId)
        .eq('date', today)
        .maybeSingle();
      if (!data) return null;
      const row = data as { meal_id: string; qty_total: number; qty_sold: number };
      return {
        mealId: row.meal_id,
        date: today,
        qtyTotal: row.qty_total,
        qtySold: row.qty_sold,
        qtyRemaining: row.qty_total - row.qty_sold,
      };
    },
  });
}

/** Upsert today's stock for one meal. qty_sold is managed by the orders system. */
export function useSetMealStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mealId, qty }: { mealId: string; qty: number }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('meal_stock').upsert(
        { meal_id: mealId, date: today, qty_total: qty },
        { onConflict: 'meal_id,date', ignoreDuplicates: false },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-stock'] });
    },
  });
}
