import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BadgeCheck, CheckCircle, Heart, MonitorPlay, Play, Share2, ShoppingCart, Star, UserCheck, UserPlus, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedPromoCard, PROMOS, type PromoKind } from '@/components/feed-promo-card';
import { useAddToCart } from '@/lib/queries/cart';
import { useMyOrders } from '@/lib/queries/orders';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { toggleFavorite, useFavorite } from '@/lib/favorites';
import { useFeed, useFollowingFeed, type FeedItem } from '@/lib/queries/feed';
import { useMyFollowIds, useMyPrepperApplication, useToggleFollow } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;

// ─── Side action button ───────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon,
  label,
  caption,
  active,
  color = '#fff',
  onPress,
}: {
  icon: typeof Heart;
  label: string;
  caption?: string;
  active?: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 5 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={21} color={active ? Palette.danger : color} fill={active ? Palette.danger : 'transparent'} />
      </View>
      {caption ? (
        <Text style={{ fontFamily: Font.medium, fontSize: 11, color: 'rgba(255,255,255,0.88)', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
          {caption}
        </Text>
      ) : null}
    </PressableScale>
  );
}

function FollowBtn({ prepperId, followSet }: { prepperId: string; followSet: Set<string> }) {
  const { user } = useAuth();
  const toggle = useToggleFollow(prepperId, user?.id);
  const following = followSet.has(prepperId);
  function handlePress() {
    feedback.tap();
    toggle.mutate(following);
  }
  return (
    <ActionBtn
      icon={following ? UserCheck : UserPlus}
      label={following ? 'Unfollow kitchen' : 'Follow kitchen'}
      caption={following ? 'following' : 'follow'}
      active={false}
      color={following ? ORANGE : '#fff'}
      onPress={handlePress}
    />
  );
}

// ─── Countdown utilities (mirrors meal-card.tsx) ─────────────────────────────

function computeCountdown(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMins = Math.floor(ms / 60_000);
  if (totalMins > 60 * 24 * 7) return null;
  if (totalMins > 60 * 24) {
    const days = Math.floor(totalMins / (60 * 24));
    const hrs = Math.floor((totalMins % (60 * 24)) / 60);
    return `${days}d ${hrs}h left`;
  }
  if (totalMins > 60) {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}h ${mins}m left`;
  }
  return `${totalMins}m left`;
}

function urgencyColor(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms < 3_600_000) return '#ef4444';
  if (ms < 86_400_000) return Palette.brand;
  return '#8b5cf6';
}

function useCountdownLabel(expiresAt?: string | null): string | null {
  const [label, setLabel] = useState<string | null>(() => computeCountdown(expiresAt));
  useEffect(() => {
    setLabel(computeCountdown(expiresAt));
    if (!expiresAt) return;
    const id = setInterval(() => setLabel(computeCountdown(expiresAt)), 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return label;
}

// ─── Unified feed card ────────────────────────────────────────────────────────

function FeedCard({ item, height, bottomInset, followSet }: { item: FeedItem; height: number; bottomInset: number; followSet: Set<string> }) {
  const router = useRouter();
  const { user } = useAuth();
  const isSaved = useFavorite(`meal:${item.id}`);
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added'>('idle');
  const addToCart = useAddToCart();
  const source = item.thumbnail ?? item.image;
  const countdown = useCountdownLabel(item.isLimited && !item.isPost ? (item.expiresAt ?? null) : null);

  async function handleAddToCart() {
    if (!user) { feedback.tap(); router.push('/auth?mode=signup'); return; }
    feedback.tap();
    setAddState('adding');
    try {
      await addToCart.mutateAsync({ userId: user.id, mealId: item.id, price: item.price });
      feedback.success();
      setAddState('added');
      setTimeout(() => setAddState('idle'), 1800);
    } catch {
      setAddState('idle');
      feedback.error();
    }
  }

  async function handleShare() {
    feedback.tap();
    try {
      const msg = item.isPost
        ? `${item.prepper} on Preppa: "${item.title}"`
        : `Try "${item.title}" by ${item.prepper} — $${item.price.toFixed(2)} on Preppa`;
      await Share.share({ message: msg });
    } catch {}
  }

  function handleSave() {
    feedback.tap();
    toggleFavorite(`meal:${item.id}`);
  }

  function goToPrepper() {
    feedback.tap();
    if (item.prepper_id) router.push(`/prepper?id=${item.prepper_id}`);
  }

  return (
    <View style={{ height, width: '100%', backgroundColor: '#000' }}>
      {source ? (
        <Image source={source} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} />
      ) : null}

      {/* Scrim — ensures legible text over any image */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.84)']}
        locations={[0, 0.42, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {item.videoUrl && !item.isLive ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={28} color="#fff" fill="#fff" />
          </View>
        </View>
      ) : null}
      {item.isLive ? (
        <MotiView
          from={{ opacity: 0.55 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 700, loop: true, repeatReverse: true }}
          style={{ position: 'absolute', top: 56, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}
          pointerEvents="none">
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' }} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff', letterSpacing: 0.7 }}>LIVE</Text>
        </MotiView>
      ) : countdown && item.expiresAt ? (
        <View
          style={{ position: 'absolute', top: 56, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: urgencyColor(item.expiresAt) + 'DD', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}
          pointerEvents="none">
          <Zap size={11} color="#fff" fill="#fff" />
          <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff' }}>{countdown}</Text>
        </View>
      ) : null}

      {/* Side action panel */}
      <View style={{ position: 'absolute', right: 14, bottom: bottomInset + 56, gap: 16, alignItems: 'center' }}>
        <ActionBtn icon={Heart} label={isSaved ? 'Unsave' : 'Save meal'} caption={isSaved ? 'saved' : 'save'} active={isSaved} onPress={handleSave} />
        {item.prepper_id ? <FollowBtn prepperId={item.prepper_id} followSet={followSet} /> : null}
        <ActionBtn icon={Share2} label="Share" caption="share" onPress={handleShare} />
      </View>

      {/* Bottom content — right edge reserved for side panel */}
      <View style={{ position: 'absolute', left: 16, right: 80, bottom: bottomInset + 16, gap: 9 }}>
        {/* Prepper row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <PressableScale onPress={goToPrepper} accessibilityRole="button" accessibilityLabel={`View ${item.prepper}'s kitchen`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: 'rgba(255,255,255,0.95)' }}>{item.prepper}</Text>
            {item.verified ? <BadgeCheck size={14} color="#fff" fill={ORANGE} stroke="#fff" /> : null}
          </PressableScale>
          {!item.isPost && item.rating > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 2 }}>
              <Star size={11} color={Palette.amber} fill={Palette.amber} />
              <Text style={{ fontFamily: Font.medium, fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>{item.rating.toFixed(1)}</Text>
              {item.reviews > 0 ? (
                <Text style={{ fontFamily: Font.medium, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>({item.reviews})</Text>
              ) : null}
            </View>
          ) : null}
          {item.isPost ? (
            <View style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.16)' }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 11, color: '#fff' }}>post</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        {item.title ? (
          <Text
            numberOfLines={3}
            style={{
              fontFamily: item.isPost ? Font.body : Font.display,
              fontSize: item.isPost ? 15 : 26,
              color: '#fff',
              letterSpacing: item.isPost ? 0 : -0.5,
              lineHeight: item.isPost ? 22 : 30,
            }}>
            {item.title}
          </Text>
        ) : null}

        {/* CTA row */}
        {item.isPost ? (
          <PressableScale
            onPress={goToPrepper}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.prepper}'s kitchen`}
            style={{ alignSelf: 'flex-start', height: 42, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>View kitchen</Text>
          </PressableScale>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff', fontVariant: ['tabular-nums'], flexShrink: 0 }}>
              ${item.price.toFixed(2)}
            </Text>
            <PressableScale
              onPress={item.isLive ? () => { feedback.tap(); router.push(`/meal?id=${item.id}`); } : handleAddToCart}
              disabled={addState === 'adding'}
              accessibilityRole="button"
              accessibilityLabel={item.isLive ? `View ${item.title} live drop` : addState === 'added' ? 'Added to cart' : `Add ${item.title} to cart`}
              style={{ flex: 1, height: 50, borderRadius: Radius.pill, backgroundColor: addState === 'added' ? '#16a34a' : ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              {addState === 'adding' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : addState === 'added' ? (
                <CheckCircle size={16} color="#fff" />
              ) : item.isLive ? null : (
                <ShoppingCart size={16} color="#fff" />
              )}
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>
                {addState === 'added' ? 'Added!' : addState === 'adding' ? 'Adding…' : item.isLive ? 'Join live drop' : 'Add to cart'}
              </Text>
            </PressableScale>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Scroll position dots ─────────────────────────────────────────────────────

function PositionDots({ total, current }: { total: number; current: number }) {
  const MAX = 7;
  const shown = Math.min(total, MAX);
  return (
    <View style={{ position: 'absolute', top: 60, right: 14, gap: 4, alignItems: 'center' }}>
      {Array.from({ length: shown }, (_, i) => {
        const active = i === Math.min(current, MAX - 1);
        return (
          <MotiView
            key={i}
            animate={{ width: active ? 4 : 3, height: active ? 18 : 8, opacity: active ? 1 : 0.28 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ borderRadius: 2, backgroundColor: '#fff' }}
          />
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

// ─── Tab bar (overlaid over feed) ────────────────────────────────────────────

function FeedTabs({ tab, onTab }: { tab: 'following' | 'explore'; onTab: (t: 'following' | 'explore') => void }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, alignItems: 'center', paddingTop: 14 }} pointerEvents="box-none">
      <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: Radius.pill, padding: 3, gap: 2 }}>
        {(['following', 'explore'] as const).map((t) => (
          <PressableScale key={t} onPress={() => onTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} accessibilityLabel={t === 'following' ? 'Following feed' : 'Explore all meals'}>
            <MotiView
              animate={{ backgroundColor: tab === t ? 'rgba(255,255,255,0.18)' : 'transparent' }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ paddingHorizontal: 18, paddingVertical: 7, borderRadius: Radius.pill }}>
              <Text style={{ fontFamily: tab === t ? Font.semibold : Font.medium, fontSize: 13.5, color: tab === t ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                {t === 'following' ? 'following' : 'for you'}
              </Text>
            </MotiView>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

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
  const { data: exploreItems, isLoading: exploreLoading } = useFeed();
  const { data: followingItems, isLoading: followingLoading } = useFollowingFeed(user?.id);
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
  const items = tab === 'following' ? followingItems : exploreItems;
  const isLoading = tab === 'following' ? followingLoading : exploreLoading;
  const stream = useMemo(() => buildStream(items ?? [], promoSeq), [items, promoSeq]);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= BP.desktop;
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const [cardHeight, setCardHeight] = useState(windowHeight);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const p = Math.round(e.nativeEvent.contentOffset.y / cardHeight);
    setPage(p);
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <FeedTabs tab={tab} onTab={(t) => { setTab(t); setPage(0); }} />
        <ActivityIndicator color={ORANGE} />
      </View>
    );
  }

  if (!items?.length) {
    const isFollowingEmpty = tab === 'following';
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0D', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <FeedTabs tab={tab} onTab={(t) => { setTab(t); setPage(0); }} />
        <MotiView from={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 180 }}>
          <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(241,95,34,0.16)', alignItems: 'center', justifyContent: 'center' }}>
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
      </ScrollView>
      <PositionDots total={stream.length} current={page} />
    </View>
  );
}
