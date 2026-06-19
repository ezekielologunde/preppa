import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type MyPrepperProfileData = {
  id: string;
  display_name: string;
  bio: string | null;
  tagline: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  city: string | null;
  cuisine_type: string | null;
  specialties: string[] | null;
  delivers: boolean;
  pickup: boolean;
  delivery_fee: number;
  delivery_radius_km: number | null;
};

/** The signed-in prepper's own editable profile fields (fetched by user_id). */
export function useMyPrepperProfile(userId?: string | null) {
  return useQuery({
    queryKey: ['my-prepper-profile', userId ?? 'none'],
    enabled: !!userId,
    queryFn: async (): Promise<MyPrepperProfileData | null> => {
      const { data, error } = await supabase
        .from('prepper_profiles')
        .select('id,display_name,bio,tagline,avatar_url,cover_url,city,cuisine_type,specialties,delivers,pickup,delivery_fee,delivery_radius_km')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as MyPrepperProfileData | null) ?? null;
    },
  });
}

export type PrepperProfileUpdates = {
  display_name?: string;
  bio?: string | null;
  tagline?: string | null;
  city?: string | null;
  cuisine_type?: string | null;
  specialties?: string[] | null;
  delivers?: boolean;
  pickup?: boolean;
  delivery_fee?: number;
  delivery_radius_km?: number | null;
};

/** Update the signed-in prepper's kitchen profile fields. */
export function useUpdatePrepperProfile(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: PrepperProfileUpdates) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('prepper_profiles')
        .update(updates)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-prepper-profile', userId] });
      qc.invalidateQueries({ queryKey: ['prepper', 'mine'] });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile'] });
      qc.invalidateQueries({ queryKey: ['preppers'] });
    },
  });
}

/** Update avatar_url on the prepper's profile. */
export function useUpdatePrepperAvatar(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (avatarUrl: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('prepper_profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-prepper-profile', userId] });
      qc.invalidateQueries({ queryKey: ['prepper', 'mine'] });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile'] });
    },
  });
}

/** Update cover_url on the prepper's profile. */
export function useUpdatePrepperCover(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (coverUrl: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('prepper_profiles')
        .update({ cover_url: coverUrl })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-prepper-profile', userId] });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile'] });
    },
  });
}
