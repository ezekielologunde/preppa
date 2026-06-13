import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BadgeCheck, Heart, MonitorPlay, Play, Share2, Star, UserCheck, UserPlus } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
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

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { toggleFavorite, useFavorite } from '@/lib/favorites';
import { useFeed, type FeedItem } from '@/lib/queries/feed';
import { useIsFollowing, useToggleFollow } from '@/lib/queries/preppers';
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

function FollowBtn({ prepperId }: { prepperId: string }) {
  const { user } = useAuth();
  const { data: isFollowing } = useIsFollowing(prepperId, user?.id);
  const toggle = useToggleFollow(prepperId, user?.id);
  const following = isFollowing ?? false;
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

// ─── Unified feed card ────────────────────────────────────────────────────────

function FeedCard({ item, height, bottomInset }: { item: FeedItem; height: number; bottomInset: number }) {
  const router = useRouter();
  const isSaved = useFavorite(`meal:${item.id}`);
  const source = item.thumbnail ?? item.image;

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

      {item.videoUrl ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={28} color="#fff" fill="#fff" />
          </View>
        </View>
      ) : null}

      {/* Side action panel */}
      <View style={{ position: 'absolute', right: 14, bottom: bottomInset + 56, gap: 16, alignItems: 'center' }}>
        <ActionBtn icon={Heart} label={isSaved ? 'Unsave' : 'Save meal'} caption={isSaved ? 'saved' : 'save'} active={isSaved} onPress={handleSave} />
        {item.prepper_id ? <FollowBtn prepperId={item.prepper_id} /> : null}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff', fontVariant: ['tabular-nums'] }}>
              ${item.price.toFixed(2)}
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); router.push(`/meal?id=${item.id}`); }}
              accessibilityRole="button"
              accessibilityLabel={`Preorder ${item.title}`}
              style={{ flex: 1, height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Preorder</Text>
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

export default function FeedsScreen() {
  const router = useRouter();
  const { data: items, isLoading } = useFeed();
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
        <ActivityIndicator color={ORANGE} />
      </View>
    );
  }

  if (!items?.length) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0D', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <MotiView from={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 180 }}>
          <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(241,95,34,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <MonitorPlay size={40} color={ORANGE} />
          </View>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 28, color: '#fff', letterSpacing: -0.6 }}>your feed</Text>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 290, lineHeight: 22 }}>
            Meal drops from the kitchens you follow will appear here.
          </Text>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 280 }}>
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/explore'); }}
            accessibilityRole="button"
            accessibilityLabel="Discover kitchens to follow"
            style={{ marginTop: 8, paddingHorizontal: 24, height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>discover kitchens</Text>
          </PressableScale>
        </MotiView>
      </View>
    );
  }

  const currentItem = items[Math.min(page, items.length - 1)];

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0B0B0D' }}>
        {/* Constrained feed column — TikTok-style vertical scroll */}
        <View style={{ width: 480, alignSelf: 'stretch' }} onLayout={e => setCardHeight(e.nativeEvent.layout.height)}>
          <ScrollView
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={cardHeight}
            snapToAlignment="start"
            onScroll={onScroll}
            scrollEventThrottle={cardHeight / 2}>
            {items.map((item) => (
              <FeedCard key={item.id} item={item} height={cardHeight} bottomInset={insets.bottom} />
            ))}
          </ScrollView>
          <PositionDots total={items.length} current={page} />
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
                  accessibilityLabel={`Preorder ${currentItem.title}`}
                  style={{ height: 52, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                    Preorder · ${currentItem.price.toFixed(2)}
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
      <ScrollView
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardHeight}
        snapToAlignment="start"
        onScroll={onScroll}
        scrollEventThrottle={cardHeight / 2}>
        {items.map((item) => (
          <FeedCard key={item.id} item={item} height={cardHeight} bottomInset={insets.bottom} />
        ))}
      </ScrollView>
      <PositionDots total={items.length} current={page} />
    </View>
  );
}
