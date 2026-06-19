import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type FeatureFlag = {
  key: string;
  label: string;
  description: string | null;
  category: string;
  enabled: boolean;
};

/** Known flag keys the client gates UI on. Mirrors the seed in migration 0004. */
export type FlagKey =
  | 'ordering'
  | 'meal_plans'
  | 'experiences'
  | 'live_feeds'
  | 'prepper_signups'
  | 'reviews'
  | 'payments'
  | 'home_cook'
  | 'require_govt_id'
  | 'require_food_safety'
  | 'require_kitchen_photos'
  | 'require_fridge_photos';

/**
 * All feature flags as a { key: enabled } map. Public read (RLS allows select).
 * Defaults to enabled for unknown keys so a missing flag never hides a shipped
 * feature — only an explicit `false` switches something off.
 */
export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, boolean>> => {
      const { data, error } = await supabase.from('feature_flags').select('key,enabled');
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const row of data ?? []) map[row.key] = row.enabled;
      return map;
    },
  });
}

/** Convenience: is a given feature on? Unknown/loading → treated as enabled. */
export function useFeatureEnabled(key: FlagKey): boolean {
  const { data } = useFeatureFlags();
  return data?.[key] ?? true;
}
