import { useRouter } from 'expo-router';
import { MonitorPlay } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedCard } from '@/components/feed-card';
import { FeedTabs, PositionDots } from '@/components/feed-ui';
import { FeedPromoCard, PROMOS, type PromoKind } from '@/components/feed-promo-card';
import { useMyOrders } from '@/lib/queries/orders';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { useFeed, useFollowingFeed, useLiveFeedItems, type FeedItem } from '@/lib/queries/feed';
import { useMyFollowIds, useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;

// ─── Feed stream: real items + interleaved promo cards ───────────────────────

type StreamEntry =
  | { kind: 'item'; item: FeedItem; key: string }
  | { kind: 'promo'; promo: PromoKind; key: string };

/**
 * Weave promo cards into the data feed: first after 3 drops, then every 5.
 * Any promos not placed (short feeds) are appended so all CTAs surface at least once.
 * `promoSeq` is computed at call-site to allow contextual promos (e.g. order_tracking
 * only when the user has an active order).
 */
function buildStream(items: FeedItem[], promoSeq: PromoKind[]): StreamEntry[] {
  if (!promoSeq.length) return items.map((item) => ({ kind: 'item', item, key: item.id }));
  const out: StreamEntry[] = [];
  const FIRST_AT = 3;
  const EVERY = 5;
  let p = 0;
  items.forEach((item, i) => {
    out.push({ kind: 'item', item, key: item.id });
    const pos = i + 1;
    if (pos === FIRST_AT || (pos > FIRST_AT && (pos - FIRST_AT) % EVERY === 0)) {
      out.push({ kind: 'promo', promo: promoSeq[p % promoSeq.length], key: `promo-${p}` });
      p++;
    }
  });
  while (p < promoSeq.length) {
    out.push({ kind: 'promo', promo: promoSeq[p % promoSeq.length], key: `promo-tail-${p}` });
    p++;
  }
  return out;
}

export default function FeedsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);

  // Approved preppers reach here only via deep link or history — redirect them to their dashboard.
  useEffect(() => {
    if (prepper?.status === 'approved') {
      router.replace('/dashboard');
    }
  }, [prepper?.status, router]);

  const [tab, setTab] = useState<'following' | 'explore'>('following');
  const { data: liveItems = [] } = useLiveFeedItems();
  const {
    data: exploreData,
    isLoading: exploreLoading,
    isError: exploreError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed();
  const exploreItems = exploreData?.pages.flat();
  const { data: followingItems, isLoading: followingLoading, isError: followingError } = useFollowingFeed(user?.id);
  const { data: followIds } = useMyFollowIds(user?.id);
  const followSet = useMemo(() => new Set(followIds ?? []), [followIds]);
  const { data: myOrders } = useMyOrders(user?.id);
  const hasActiveOrder = useMemo(
    () => (myOrders ?? []).some((o) => !['completed', 'cancelled', 'refunded'].includes(o.status)),
    [myOrders],
  );
  const promoSeq = useMemo((): PromoKind[] => [
    'meal_plans',
    ...(hasActiveOrder ? ['order_tracking' as const] : []),
    'post_request',
    'become_prepper',
    'dietary_profile',
  ], [hasActiveOrder]);
  const baseItems = tab === 'following' ? followingItems : exploreItems;
  const items = useMemo(
    () => (liveItems.length ? [...liveItems, ...(baseItems ?? [])] : baseItems ?? []),
    [liveItems, baseItems],
  );
  const isLoading = tab === 'following' ? followingLoading : exploreLoading;
  const isError = tab === 'following' ? followingError : exploreError;
  const stream = useMemo(() => buildStream(items, promoSeq), [items, promoSeq]);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= BP.desktop;
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const [cardHeight, setCardHeight] = useState(windowHeight);

  // Trigger next page when 2 cards from the end on the explore tab
  useEffect(() => {
    if (tab === 'explore' && hasNextPage && !isFetchingNextPage && page >= stream.length - 2) {
      fetchNextPage();
    }
  }, [tab, page, stream.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.y / cardHeight);
    setPage(p);
  }, [cardHeight]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <FeedTabs tab={tab} onTab={(t) => { setTab(t); setPage(0); }} />
        <ActivityIndicator color={ORANGE} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0D', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
        <FeedTabs tab={tab} onTab={(t) => { setTab(t); setPage(0); }} />
        <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
          Could not load feed. Try again.
        </Text>
      </View>
    );
  }

  if (!items?.length) {
    const isFollowingEmpty = tab === 'following';
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0D', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <FeedTabs tab={tab} onTab={(t) => { setTab(t); setPage(0); }} />
        <MotiView from={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 180 }}>
          <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(232,97,26,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <MonitorPlay size={40} color={ORANGE} />
          </View>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 28, color: '#fff', letterSpacing: -0.6 }}>
            {isFollowingEmpty ? 'your feed' : 'nothing here'}
          </Text>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 290, lineHeight: 22 }}>
            {isFollowingEmpty
              ? user
                ? 'Follow local kitchens to see their meal drops here.'
                : 'Sign in and follow kitchens to see their drops here.'
              : 'No meal drops published yet.'}
          </Text>
        </MotiView>
        {isFollowingEmpty ? (
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 280 }}>
            {user ? (
              <PressableScale
                onPress={() => { feedback.tap(); router.push('/explore'); }}
                accessibilityRole="button"
                accessibilityLabel="Discover kitchens to follow"
                style={{ marginTop: 8, paddingHorizontal: 24, height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>discover kitchens</Text>
              </PressableScale>
            ) : (
              <PressableScale
                onPress={() => { feedback.tap(); router.push('/auth?mode=signup'); }}
                accessibilityRole="button"
                accessibilityLabel="Sign in to follow kitchens"
                style={{ marginTop: 8, paddingHorizontal: 24, height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>sign in to follow kitchens</Text>
              </PressableScale>
            )}
          </MotiView>
        ) : null}
      </View>
    );
  }

  const currentEntry = stream.length ? stream[Math.min(page, stream.length - 1)] : undefined;
  const currentItem = currentEntry?.kind === 'item' ? currentEntry.item : undefined;
  const currentPromo = currentEntry?.kind === 'promo' ? PROMOS[currentEntry.promo] : undefined;

  function renderEntry(entry: StreamEntry) {
    return entry.kind === 'item'
      ? <FeedCard key={entry.key} item={entry.item} height={cardHeight} bottomInset={insets.bottom} followSet={followSet} />
      : <FeedPromoCard key={entry.key} kind={entry.promo} height={cardHeight} bottomInset={insets.bottom} />;
  }

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0B0B0D' }}>
        {/* Constrained feed column — TikTok-style vertical scroll */}
        <View style={{ width: 480, alignSelf: 'stretch' }} onLayout={e => setCardHeight(e.nativeEvent.layout.height)}>
          <FeedTabs tab={tab} onTab={(t) => { setTab(t); setPage(0); }} />
          <ScrollView
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={cardHeight}
            snapToAlignment="start"
            onScroll={onScroll}
            scrollEventThrottle={cardHeight / 2}>
            {stream.map(renderEntry)}
            {tab === 'explore' && isFetchingNextPage ? (
              <View style={{ height: cardHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                <ActivityIndicator color={ORANGE} />
              </View>
            ) : null}
          </ScrollView>
          <PositionDots total={stream.length} current={page} />
        </View>

        {/* Sidebar: info about the current card */}
        <View style={{ flex: 1, padding: 40, justifyContent: 'center', gap: 20 }}>
          {currentItem ? (
            <>
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  now playing
                </Text>
                <Text style={{ fontFamily: Font.heading, fontSize: 20, color: '#fff' }} numberOfLines={1}>
                  {currentItem.prepper}
                </Text>
                {currentItem.title ? (
                  <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 21 }} numberOfLines={3}>
                    {currentItem.title}
                  </Text>
                ) : null}
                {!currentItem.isPost ? (
                  <Text style={{ fontFamily: Font.display, fontSize: 26, color: Palette.brand, marginTop: 4 }}>
                    ${currentItem.price.toFixed(2)}
                  </Text>
                ) : null}
              </View>
              {!currentItem.isPost ? (
                <PressableScale
                  onPress={() => { feedback.tap(); router.push(`/meal?id=${currentItem.id}`); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${currentItem.title}`}
                  style={{ height: 52, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                    Order now · ${currentItem.price.toFixed(2)}
                  </Text>
                </PressableScale>
              ) : (
                <PressableScale
                  onPress={() => { feedback.tap(); if (currentItem.prepper_id) router.push(`/prepper?id=${currentItem.prepper_id}`); }}
                  accessibilityRole="button"
                  accessibilityLabel="View kitchen"
                  style={{ height: 52, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: '#fff' }}>View kitchen</Text>
                </PressableScale>
              )}
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            </>
          ) : currentPromo ? (
            <>
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.brand, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {currentPromo.eyebrow}
                </Text>
                <Text style={{ fontFamily: Font.display, fontSize: 26, color: '#fff', letterSpacing: -0.5 }}>
                  {currentPromo.title.replace('\n', ' ')}
                </Text>
                <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 21 }}>
                  {currentPromo.subtitle}
                </Text>
              </View>
              <PressableScale
                onPress={() => { feedback.tap(); router.push(currentPromo.route); }}
                accessibilityRole="button"
                accessibilityLabel={currentPromo.cta}
                style={{ height: 52, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{currentPromo.cta}</Text>
              </PressableScale>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            </>
          ) : null}
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/explore'); }}
            accessibilityRole="button"
            accessibilityLabel="Discover kitchens"
            style={{ height: 46, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
              Discover kitchens
            </Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={e => setCardHeight(e.nativeEvent.layout.height)}>
      <FeedTabs tab={tab} onTab={(t) => { setTab(t); setPage(0); }} />
      <ScrollView
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardHeight}
        snapToAlignment="start"
        onScroll={onScroll}
        scrollEventThrottle={cardHeight / 2}>
        {stream.map(renderEntry)}
        {tab === 'explore' && isFetchingNextPage ? (
          <View style={{ height: cardHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
            <ActivityIndicator color={ORANGE} />
          </View>
        ) : null}
      </ScrollView>
      <PositionDots total={stream.length} current={page} />
    </View>
  );
}
