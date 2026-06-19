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
export function useUpdatePrepperProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: PrepperProfileUpdates) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const sanitized: PrepperProfileUpdates = {
        ...updates,
        display_name: updates.display_name?.trim().slice(0, 60),
        bio: updates.bio?.trim().slice(0, 500) ?? null,
        tagline: updates.tagline?.trim().slice(0, 100) ?? null,
        city: updates.city?.trim().slice(0, 60) ?? null,
        cuisine_type: updates.cuisine_type?.trim().slice(0, 50) ?? null,
      };
      const { error } = await supabase
        .from('prepper_profiles')
        .update(sanitized)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-prepper-profile'] });
      qc.invalidateQueries({ queryKey: ['prepper', 'mine'] });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile'] });
      qc.invalidateQueries({ queryKey: ['preppers'] });
    },
  });
}

/** Update avatar_url on the prepper's profile. */
export function useUpdatePrepperAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (avatarUrl: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('prepper_profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-prepper-profile'] });
      qc.invalidateQueries({ queryKey: ['prepper', 'mine'] });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile'] });
    },
  });
}

/** Update cover_url on the prepper's profile. */
export function useUpdatePrepperCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (coverUrl: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('prepper_profiles')
        .update({ cover_url: coverUrl })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-prepper-profile'] });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile'] });
    },
  });
}
