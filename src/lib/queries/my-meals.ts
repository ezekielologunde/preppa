import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { MealStatus } from '@/types/database.types';

export type MyMeal = {
  id: string;
  title: string;
  description: string | null;
  base_price: number;
  prep_time_min: number | null;
  category_id: number | null;
  status: MealStatus;
  image: string | null;
};

type Row = Omit<MyMeal, 'image'> & { images: { url: string }[] | null };

/** Every meal in the signed-in prepper's kitchen, all statuses (RLS-scoped). */
export function useMyMeals(prepperId?: string | null) {
  return useQuery({
    queryKey: ['my-meals', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<MyMeal[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select('id,title,description,base_price,prep_time_min,category_id,status,images:meal_images(url)')
        .eq('prepper_id', prepperId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, image: r.images?.[0]?.url ?? null }));
    },
  });
}

export type MealDraft = {
  id?: string; // present = edit, absent = create
  title: string;
  description: string;
  base_price: number;
  prep_time_min: number | null;
  category_id: number | null;
  imageUrl: string;
};

/** Create or update a meal (and its primary photo). New meals start as drafts. */
export function useSaveMeal(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: MealDraft): Promise<string> => {
      if (!prepperId) throw new Error('No kitchen for this account');
      const fields = {
        title: v.title.trim(),
        description: v.description.trim() || null,
        base_price: v.base_price,
        prep_time_min: v.prep_time_min,
        category_id: v.category_id,
      };
      let mealId = v.id;
      if (mealId) {
        const { error } = await supabase.from('meals').update(fields).eq('id', mealId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('meals')
          .insert({ ...fields, prepper_id: prepperId })
          .select('id')
          .single();
        if (error) throw error;
        mealId = (data as { id: string }).id;
      }
      const url = v.imageUrl.trim();
      if (url) {
        // Replace the primary photo (order_index 0) without touching extras.
        await supabase.from('meal_images').delete().eq('meal_id', mealId).eq('order_index', 0);
        const { error } = await supabase.from('meal_images').insert({ meal_id: mealId, url, order_index: 0 });
        if (error) throw error;
      }
      return mealId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-meals'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}

/** Publish / pause / archive a meal. */
export function useSetMealStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; status: MealStatus }) => {
      const { error } = await supabase.from('meals').update({ status: v.status }).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-meals'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}

export type MealCategory = { id: number; key: string; name: string };

/** Lookup categories for the editor's picker. */
export function useMealCategories() {
  return useQuery({
    queryKey: ['meal-categories'],
    queryFn: async (): Promise<MealCategory[]> => {
      const { data, error } = await supabase.from('meal_categories').select('id,key,name').order('id');
      if (error) throw error;
      return (data ?? []) as MealCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
