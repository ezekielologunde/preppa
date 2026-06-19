import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type FeaturedKitchen = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  city: string | null;
  rating: number | null;
  cuisine: string | null;
  featuredAt: string;
};

/** Approved kitchens that an admin has marked as featured — shown on the home feed. */
export function useFeaturedKitchens() {
  return useQuery({
    queryKey: ['featured-kitchens'],
    staleTime: 300_000,
    queryFn: async (): Promise<FeaturedKitchen[]> => {
      const { data } = await supabase
        .from('prepper_profiles')
        .select('id, display_name, avatar_url, cover_url, city, cuisine_type, featured_at, rating:prepper_rating_summary(average_rating)')
        .eq('is_featured', true)
        .eq('status', 'approved')
        .order('featured_at', { ascending: false })
        .limit(10);

      return ((data ?? []) as unknown as {
        id: string;
        display_name: string;
        avatar_url: string | null;
        cover_url: string | null;
        city: string | null;
        cuisine_type: string | null;
        featured_at: string;
        rating: { average_rating: number } | { average_rating: number }[] | null;
      }[]).map((r) => {
        const ratingObj = Array.isArray(r.rating) ? r.rating[0] : r.rating;
        return {
          id: r.id,
          displayName: r.display_name,
          avatarUrl: r.avatar_url,
          coverUrl: r.cover_url,
          city: r.city,
          rating: ratingObj?.average_rating ?? null,
          cuisine: r.cuisine_type,
          featuredAt: r.featured_at,
        };
      });
    },
  });
}

/** Admin: toggle the featured flag for a prepper profile. No confirmation needed — easily reversible. */
export function useAdminToggleFeatured() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ prepperId, featured }: { prepperId: string; featured: boolean }) => {
      const { error } = await supabase
        .from('prepper_profiles')
        .update({
          is_featured: featured,
          featured_at: featured ? new Date().toISOString() : null,
        })
        .eq('id', prepperId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['featured-kitchens'] });
      qc.invalidateQueries({ queryKey: ['admin', 'preppers'] });
    },
  });
}
