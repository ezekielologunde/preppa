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
  images: string[];
  videoUrls: string[];
  is_limited: boolean;
  expires_at: string | null;
  allergens: string[];
  ingredients: string[];
  available_days: string[] | null;
};

type Row = Omit<MyMeal, 'image' | 'images' | 'videoUrls'> & {
  images: { url: string; order_index: number }[] | null;
  videos: { url: string; order_index: number }[] | null;
};

/** Every meal in the signed-in prepper's kitchen, all statuses (RLS-scoped). */
export function useMyMeals(prepperId?: string | null) {
  return useQuery({
    queryKey: ['my-meals', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<MyMeal[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select('id,title,description,base_price,prep_time_min,category_id,status,is_limited,expires_at,allergens,ingredients,available_days,images:meal_images(url,order_index),videos:meal_videos(url,order_index)')
        .eq('prepper_id', prepperId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map((r) => {
        const sorted = [...(r.images ?? [])].sort((a, b) => a.order_index - b.order_index).map((i) => i.url);
        const sortedVideos = [...(r.videos ?? [])].sort((a, b) => a.order_index - b.order_index).map((v) => v.url);
        return { ...r, image: sorted[0] ?? null, images: sorted, videoUrls: sortedVideos };
      });
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
  imageUrls: string[];
  videoUrls?: string[];
  is_limited?: boolean;
  expires_at?: string | null;
  allergens?: string[];
  ingredients?: string[];
  calories?: number | null;
  available_days?: string[];
  dietary_tags?: string[];
};

/** Create or update a meal (and its primary photo). New meals start as drafts. */
export function useSaveMeal(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: MealDraft): Promise<string> => {
      if (!prepperId) throw new Error('No kitchen for this account');
      const fields = {
        title: v.title.trim().slice(0, 100),
        description: v.description.trim().slice(0, 2000) || null,
        base_price: v.base_price,
        prep_time_min: v.prep_time_min,
        category_id: v.category_id,
        is_limited: v.is_limited ?? false,
        expires_at: v.expires_at ?? null,
        allergens: v.allergens ?? [],
        ingredients: v.ingredients ?? [],
        available_days: v.available_days && v.available_days.length > 0 ? v.available_days : null,
        dietary_tags: v.dietary_tags && v.dietary_tags.length > 0 ? v.dietary_tags : null,
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
      const urls = v.imageUrls.map((u) => u.trim()).filter(Boolean);
      if (urls.length > 0) {
        await supabase.from('meal_images').delete().eq('meal_id', mealId!);
        const { error } = await supabase
          .from('meal_images')
          .insert(urls.map((url, i) => ({ meal_id: mealId!, url, order_index: i })));
        if (error) throw error;
      }
      const videoUrls = (v.videoUrls ?? []).map((u) => u.trim()).filter(Boolean);
      if (videoUrls.length > 0 || v.id) {
        await supabase.from('meal_videos').delete().eq('meal_id', mealId!);
        if (videoUrls.length > 0) {
          const { error: vErr } = await supabase
            .from('meal_videos')
            .insert(videoUrls.map((url, i) => ({ meal_id: mealId!, url, order_index: i })));
          if (vErr) throw vErr;
        }
      }
      return mealId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-meals'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}

/** Publish / pause / archive a meal. Fires push notifications to followers on publish. */
export function useSetMealStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; status: MealStatus; prepperId?: string; prepperName?: string; mealTitle?: string }) => {
      const { error } = await supabase.from('meals').update({ status: v.status }).eq('id', v.id);
      if (error) throw error;

      // When publishing, push-notify all followers.
      if (v.status === 'published' && v.prepperId) {
        const { data: follows } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('prepper_id', v.prepperId);
        const followerIds = ((follows ?? []) as { follower_id: string }[]).map((f) => f.follower_id);
        if (followerIds.length > 0) {
          const prepperName = v.prepperName ?? 'Your kitchen';
          const mealTitle = v.mealTitle ?? 'a new meal';
          supabase.functions.invoke('notify', {
            body: {
              user_ids: followerIds,
              title: 'New meal drop 🍽',
              body: `${prepperName} just dropped a new meal: ${mealTitle}`,
              data: { type: 'meal_drop', meal_id: v.id, prepper_id: v.prepperId },
            },
          }).catch(() => {}); // fire-and-forget; don't block the status update
        }
      }
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
