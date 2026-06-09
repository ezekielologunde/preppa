import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type FeedItem = {
  id: string;
  title: string;
  price: number;
  prepper: string;
  verified: boolean;
  rating: number;
  reviews: number;
  image: string;
  videoUrl: string | null;
  thumbnail: string | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

type Row = {
  id: string;
  title: string;
  base_price: number;
  description: string | null;
  prepper:
    | { display_name: string; verified: boolean; rating: { average_rating: number; total_reviews: number } | { average_rating: number; total_reviews: number }[] | null }
    | { display_name: string; verified: boolean; rating: unknown }[]
    | null;
  images: { url: string }[] | null;
  videos: { video_url: string; thumbnail_url: string | null }[] | null;
};

const SELECT =
  'id,title,base_price,created_at,' +
  'prepper:prepper_profiles(display_name,verified,rating:prepper_rating_summary(average_rating,total_reviews)),' +
  'images:meal_images(url),' +
  'videos:meal_videos(video_url,thumbnail_url)';

/**
 * The vertical "feeds" stream — published meal drops, newest first. Each item is
 * full-bleed food imagery (the design mandate's hero); when a prepper has uploaded
 * a meal video it auto-upgrades to play. Public read via RLS on published meals.
 */
export function useFeed(limit = 30) {
  return useQuery({
    queryKey: ['feed', limit],
    queryFn: async (): Promise<FeedItem[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select(SELECT)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[])
        .map((r): FeedItem => {
          const prepper = one(r.prepper as never) as { display_name?: string; verified?: boolean; rating?: unknown } | undefined;
          const rating = one(prepper?.rating as never) as { average_rating: number; total_reviews: number } | undefined;
          const video = one(r.videos);
          return {
            id: r.id,
            title: r.title,
            price: r.base_price,
            prepper: prepper?.display_name ?? 'preppa',
            verified: !!prepper?.verified,
            rating: rating?.average_rating ?? 0,
            reviews: rating?.total_reviews ?? 0,
            image: r.images?.[0]?.url ?? '',
            videoUrl: video?.video_url ?? null,
            thumbnail: video?.thumbnail_url ?? null,
          };
        })
        .filter((i) => i.image || i.thumbnail);
    },
  });
}
