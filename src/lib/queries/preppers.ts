import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { PrepperStatus } from '@/types/database.types';

export type TopPrepper = {
  id: string;
  name: string;
  verified: boolean;
  rating: number;
  reviews: number;
  image: string;
  from: number | null;
  tags: string[];
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

/** Verified preppers with their rating + a sample meal image / starting price. */
export function useTopPreppers(limit = 10) {
  return useQuery({
    queryKey: ['preppers', 'top', limit],
    queryFn: async (): Promise<TopPrepper[]> => {
      const { data, error } = await supabase
        .from('prepper_profiles')
        .select(SELECT)
        .eq('verified', true)
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(mapPrepper);
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
    mutationFn: async (v: { userId: string; displayName: string; bio: string; specialties: string[] }) => {
      const { error } = await supabase.from('prepper_profiles').insert({
        user_id: v.userId,
        display_name: v.displayName,
        bio: v.bio || null,
        specialties: v.specialties.length ? v.specialties : null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['prepper', 'mine', v.userId] }),
  });
}
