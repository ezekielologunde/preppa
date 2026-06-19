import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type UserPrefs = {
  /** Lower-cased dietary tags, e.g. ['halal', 'vegan'] */
  dietary: string[];
  /** Raw cuisine labels as entered during onboarding, e.g. ['Nigerian', 'Caribbean'] */
  cuisines: string[];
};

const EMPTY: UserPrefs = { dietary: [], cuisines: [] };

/**
 * Returns the current user's dietary and cuisine preferences.
 * Preferences are stored in Supabase auth user_metadata during onboarding
 * (step-4 calls supabase.auth.updateUser({ data: { dietary, cuisines } })).
 *
 * Lower-cases dietary tags so they can be compared against meal.dietaryTags
 * which are stored lower-case in the DB (e.g. 'halal', 'vegan').
 */
export function useUserPrefs(userId?: string | null): {
  data: UserPrefs;
  isLoading: boolean;
} {
  const result = useQuery({
    queryKey: ['user-prefs', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 300_000,
    gcTime: 600_000,
    queryFn: async (): Promise<UserPrefs> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return EMPTY;

      const meta = user.user_metadata ?? {};
      const rawDietary = (meta.dietary as string[] | undefined) ?? [];
      const rawCuisines = (meta.cuisines as string[] | undefined) ?? [];

      return {
        dietary: rawDietary.map((t) => t.toLowerCase()),
        cuisines: rawCuisines,
      };
    },
  });

  return {
    data: result.data ?? EMPTY,
    isLoading: result.isLoading,
  };
}

/**
 * Mutation to update dietary and cuisine preferences.
 * Writes to auth user_metadata (same location as onboarding step-4) and
 * mirrors to profiles table columns if they exist.
 * Invalidates ['user-prefs'] and ['for-you-meals'] on success.
 */
export function useUpdateUserPrefs(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: UserPrefs) => {
      const { error } = await supabase.auth.updateUser({
        data: {
          dietary: prefs.dietary,
          cuisines: prefs.cuisines,
        },
      });
      if (error) throw error;

      if (userId) {
        await supabase
          .from('profiles')
          .update({
            dietary_preferences: prefs.dietary,
            cuisine_preferences: prefs.cuisines,
          } as never)
          .eq('id', userId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-prefs', userId ?? 'anon'] });
      qc.invalidateQueries({ queryKey: ['for-you-meals'] });
    },
  });
}
