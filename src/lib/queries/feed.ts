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
  /** true = standalone prepper post (feed_posts), false = live meal listing */
  isPost?: boolean;
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

const POST_SELECT =
  'id,caption,thumbnail_url,video_url,tags,created_at,' +
  'prepper:prepper_profiles(display_name,verified)';

type PostRow = {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  tags: string[];
  created_at: string;
  prepper: { display_name: string; verified: boolean } | { display_name: string; verified: boolean }[] | null;
};

/**
 * The vertical "feeds" stream — published meal drops + standalone prepper posts,
 * newest first. Prepper posts from feed_posts are merged in and labelled isPost=true
 * so the feed renderer can display them differently (no price, caption instead of title).
 */
export function useFeed(limit = 30) {
  return useQuery({
    queryKey: ['feed', limit],
    queryFn: async (): Promise<FeedItem[]> => {
      const [mealsRes, postsRes] = await Promise.all([
        supabase
          .from('meals')
          .select(SELECT)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('feed_posts')
          .select(POST_SELECT)
          .order('created_at', { ascending: false })
          .limit(Math.floor(limit / 3)),
      ]);
      if (mealsRes.error) throw mealsRes.error;

      const mealItems = ((mealsRes.data ?? []) as unknown as Row[])
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
            isPost: false,
          };
        })
        .filter((i) => i.image || i.thumbnail);

      const postItems: FeedItem[] = ((postsRes.data ?? []) as unknown as PostRow[])
        .filter((p) => p.thumbnail_url || p.video_url)
        .map((p): FeedItem => {
          const prepper = one(p.prepper as never) as { display_name: string; verified: boolean } | undefined;
          return {
            id: `post:${p.id}`,
            title: p.caption ?? '',
            price: 0,
            prepper: prepper?.display_name ?? 'preppa',
            verified: !!prepper?.verified,
            rating: 0,
            reviews: 0,
            image: p.thumbnail_url ?? '',
            videoUrl: p.video_url ?? null,
            thumbnail: p.thumbnail_url ?? null,
            isPost: true,
          };
        });

      // Interleave: every 4th item is a post (if available)
      const result: FeedItem[] = [];
      let pi = 0;
      for (let i = 0; i < mealItems.length; i++) {
        result.push(mealItems[i]);
        if ((i + 1) % 4 === 0 && pi < postItems.length) {
          result.push(postItems[pi++]);
        }
      }
      // Append remaining posts
      while (pi < postItems.length) result.push(postItems[pi++]);
      return result;
    },
  });
}
