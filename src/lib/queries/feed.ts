import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type FeedItem = {
  id: string;
  title: string;
  price: number;
  prepper: string;
  prepper_id?: string;
  verified: boolean;
  isPro?: boolean;
  rating: number;
  reviews: number;
  image: string;
  videoUrl: string | null;
  thumbnail: string | null;
  /** ISO timestamp when this limited drop expires; null = no expiry or not a limited drop. */
  expiresAt?: string | null;
  /** true = is_limited meal; drives countdown badge in FeedCard. */
  isLimited?: boolean;
  /** true = standalone prepper post (feed_posts), false = live meal listing */
  isPost?: boolean;
  /** ISO created_at — used as pagination cursor; not rendered. */
  created_at?: string;
};

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

type Row = {
  id: string;
  title: string;
  base_price: number;
  description: string | null;
  is_limited: boolean;
  expires_at: string | null;
  created_at: string;
  prepper:
    | { id: string; display_name: string; verified: boolean; rating: { average_rating: number; total_reviews: number } | { average_rating: number; total_reviews: number }[] | null; prepper_memberships: { tier: string; status: string }[] | null }
    | { id: string; display_name: string; verified: boolean; rating: unknown; prepper_memberships: { tier: string; status: string }[] | null }[]
    | null;
  images: { url: string }[] | null;
  videos: { video_url: string; thumbnail_url: string | null }[] | null;
};

const SELECT =
  'id,title,base_price,created_at,is_limited,expires_at,' +
  'prepper:prepper_profiles(id,display_name,verified,rating:prepper_rating_summary(average_rating,total_reviews),prepper_memberships(tier,status)),' +
  'images:meal_images(url),' +
  'videos:meal_videos(video_url,thumbnail_url)';

const POST_SELECT =
  'id,caption,thumbnail_url,video_url,tags,created_at,' +
  'prepper:prepper_profiles(id,display_name,verified,prepper_memberships(tier,status))';

type PostRow = {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  tags: string[];
  created_at: string;
  prepper: { id: string; display_name: string; verified: boolean; prepper_memberships: { tier: string; status: string }[] | null } | { id: string; display_name: string; verified: boolean; prepper_memberships: { tier: string; status: string }[] | null }[] | null;
};

async function buildFeedItems(
  mealItems: FeedItem[],
  postItems: FeedItem[],
): Promise<FeedItem[]> {
  const result: FeedItem[] = [];
  let pi = 0;
  for (let i = 0; i < mealItems.length; i++) {
    result.push(mealItems[i]);
    if ((i + 1) % 4 === 0 && pi < postItems.length) result.push(postItems[pi++]);
  }
  while (pi < postItems.length) result.push(postItems[pi++]);
  return result;
}

function mapMealRows(rows: Row[]): FeedItem[] {
  return (rows as unknown as Row[])
    .map((r): FeedItem => {
      const prepper = one(r.prepper as never) as { id?: string; display_name?: string; verified?: boolean; rating?: unknown; prepper_memberships?: { tier: string; status: string }[] | null } | undefined;
      const rating = one(prepper?.rating as never) as { average_rating: number; total_reviews: number } | undefined;
      const video = one(r.videos);
      const isPro = (prepper?.prepper_memberships ?? []).some((m) => m.tier === 'pro' && m.status === 'active');
      return {
        id: r.id,
        title: r.title,
        price: r.base_price,
        prepper: prepper?.display_name ?? 'preppa',
        prepper_id: prepper?.id,
        verified: !!prepper?.verified,
        isPro,
        rating: rating?.average_rating ?? 0,
        reviews: rating?.total_reviews ?? 0,
        image: r.images?.[0]?.url ?? '',
        videoUrl: video?.video_url ?? null,
        thumbnail: video?.thumbnail_url ?? null,
        isLimited: r.is_limited ?? false,
        expiresAt: r.expires_at ?? null,
        isPost: false,
        created_at: r.created_at,
      };
    })
    .filter((i) => i.image || i.thumbnail);
}

function mapPostRows(rows: PostRow[]): FeedItem[] {
  return rows
    .filter((p) => p.thumbnail_url || p.video_url)
    .map((p): FeedItem => {
      const prepper = one(p.prepper as never) as { id?: string; display_name: string; verified: boolean; prepper_memberships?: { tier: string; status: string }[] | null } | undefined;
      const isPro = (prepper?.prepper_memberships ?? []).some((m) => m.tier === 'pro' && m.status === 'active');
      return {
        id: `post:${p.id}`,
        title: p.caption ?? '',
        price: 0,
        prepper: prepper?.display_name ?? 'preppa',
        prepper_id: prepper?.id,
        verified: !!prepper?.verified,
        isPro,
        rating: 0,
        reviews: 0,
        image: p.thumbnail_url ?? '',
        videoUrl: p.video_url ?? null,
        thumbnail: p.thumbnail_url ?? null,
        isPost: true,
        created_at: p.created_at,
      };
    });
}

const PAGE_SIZE = 10;

/**
 * The vertical "feeds" stream — published meal drops + standalone prepper posts,
 * newest first. Prepper posts from feed_posts are merged in and labelled isPost=true
 * so the feed renderer can display them differently (no price, caption instead of title).
 *
 * Returns an InfiniteQuery — callers must use `.pages.flat()` to get a flat FeedItem[].
 */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<FeedItem[]> => {
      let mealsQ = supabase
        .from('meals')
        .select(SELECT)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) mealsQ = mealsQ.lt('created_at', pageParam);

      let postsQ = supabase
        .from('feed_posts')
        .select(POST_SELECT)
        .order('created_at', { ascending: false })
        .limit(Math.floor(PAGE_SIZE / 3));
      if (pageParam) postsQ = postsQ.lt('created_at', pageParam);

      const [mealsRes, postsRes] = await Promise.all([mealsQ, postsQ]);
      if (mealsRes.error) throw mealsRes.error;
      if (postsRes.error) throw postsRes.error;
      return buildFeedItems(
        mapMealRows(mealsRes.data as unknown as Row[]),
        mapPostRows(postsRes.data as unknown as PostRow[]),
      );
    },
    getNextPageParam: (lastPage) => lastPage[lastPage.length - 1]?.created_at ?? undefined,
  });
}

/**
 * Personalized feed: drops only from kitchens the signed-in user follows.
 * Returns an empty array (not an error) when the user follows nobody yet.
 */
export function useFollowingFeed(userId?: string | null, limit = 30) {
  return useQuery({
    queryKey: ['feed', 'following', userId ?? 'anon', limit],
    enabled: !!userId,
    queryFn: async (): Promise<FeedItem[]> => {
      const { data: follows, error: followsErr } = await supabase
        .from('follows')
        .select('prepper_id')
        .eq('follower_id', userId!);
      if (followsErr) throw followsErr;
      const ids = (follows ?? []).map((f: { prepper_id: string }) => f.prepper_id);
      if (!ids.length) return [];
      const [mealsRes, postsRes] = await Promise.all([
        supabase.from('meals').select(SELECT).eq('status', 'published').in('prepper_id', ids).order('created_at', { ascending: false }).limit(limit),
        supabase.from('feed_posts').select(POST_SELECT).in('prepper_id', ids).order('created_at', { ascending: false }).limit(Math.floor(limit / 3)),
      ]);
      if (mealsRes.error) throw mealsRes.error;
      if (postsRes.error) throw postsRes.error;
      return buildFeedItems(
        mapMealRows(mealsRes.data as unknown as Row[]),
        mapPostRows(postsRes.data as unknown as PostRow[]),
      );
    },
  });
}
