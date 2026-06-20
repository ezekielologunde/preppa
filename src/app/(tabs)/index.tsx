import { MotiView } from 'moti';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Bell, ChevronRight, Flame, MapPin, Search, ShoppingCart, SlidersHorizontal, UtensilsCrossed,
} from 'lucide-react-native';
import { Platform, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionSplitter, CategoryIconsRow, MyPlansSection,
  RewardsBanner, SurpriseMeBanner,
} from '@/components/home-extras';
import {
  ChefsInActionFeed, FreshDropsSection, FollowingKitchensSection, MealPlansDiscoverySection,
  TrendingSection,
} from '@/components/home-feed';
import { FeaturedKitchensSection, ForYouSection, RecentlyViewedSection, TrendingNowSection } from '@/components/home-sections';
import { BecomePrepperNudge } from '@/components/home-nudges';
import { Font } from '@/constants/fonts';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { greeting } from '@/lib/greeting';
import { useCart } from '@/lib/queries/cart';
import { useFeaturedMeals } from '@/lib/queries/meals';
import { useAddresses } from '@/lib/queries/addresses';
import { useDeviceLocation, usePurgeGpsAddresses } from '@/lib/use-location';
import { useMyOrders } from '@/lib/queries/orders';
import { useNotifications } from '@/lib/queries/notifications';
import { usePersonalizedMeals } from '@/lib/queries/recommend';
import { useTodayStock } from '@/lib/queries/stock';
import { BP, useHomeColumns } from '@/lib/layout';
import { useAuth } from '@/providers/auth-provider';
import { feedback } from '@/lib/feedback';
import { getCurrentRush, getNextRush, getRushUrgency } from '@/lib/rush-hour';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const MUTED = Palette.textSecondary;

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Preorder placed — awaiting kitchen',
  confirmed: 'Preorder confirmed',
  preparing: 'Being prepped now',
  ready: 'Your preorder is ready for pickup',
  out_for_delivery: 'On the way to you',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeaderIconButton({
  Icon, badge, onPress, label,
}: {
  Icon: ComponentType<{ size?: number; color?: string }>;
  badge: number;
  onPress: () => void;
  label: string;
}) {
  return (
    <PressableScale onPress={() => { feedback.tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
      <Icon size={21} color={INK} />
      {badge > 0 ? (
        <MotiView from={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          style={{ position: 'absolute', top: 6, right: 6, minWidth: 17, height: 17, borderRadius: 8.5, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: Palette.canvas }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 9.5, color: '#fff' }}>{badge > 99 ? '99+' : badge}</Text>
        </MotiView>
      ) : null}
    </PressableScale>
  );
}

function ActiveOrderBanner({ order }: { order: NonNullable<ReturnType<typeof useMyOrders>['data']>[number] }) {
  const router = useRouter();
  const label = ORDER_STATUS_LABEL[order.status] ?? 'Preorder in progress';
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
      <PressableScale onPress={() => { feedback.tap(); router.push('/orders'); }} accessibilityRole="button"
        accessibilityLabel={`Track your preorder — ${label}`}
        style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: INK, borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <MotiView from={{ opacity: 0.5 }} animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
          <UtensilsCrossed size={19} color="#fff" />
        </MotiView>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }} numberOfLines={1}>{label}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.65)' }} numberOfLines={1}>
            {order.prepper} · tap to track
          </Text>
        </View>
        <ChevronRight size={20} color="rgba(255,255,255,0.55)" />
      </PressableScale>
    </MotiView>
  );
}

function RushBanner() {
  const router = useRouter();
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const urgency = getRushUrgency(hour, minute);
  if (urgency === 'quiet' || urgency === 'upcoming') return null;
  const rush = getCurrentRush(hour);
  const next = rush ? null : getNextRush(hour);
  const win = rush ?? next?.window ?? null;
  if (!win) return null;
  const isLive = urgency === 'live';
  const minsAway = next ? Math.max(0, next.inMins - minute) : 0;
  const accent = win.color;
  const tip = isLive ? win.buyerTip : `${win.label} starts in ~${minsAway} min — browse kitchens ahead of the rush.`;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 40 }}>
      <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }} accessibilityRole="button"
        accessibilityLabel={isLive ? `${win.label} is on now — preorder now` : `${win.label} starting soon`}
        style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: accent + '12', borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: accent + '28' }}>
        <MotiView
          from={isLive ? { opacity: 0.55, scale: 0.9 } : { opacity: 1, scale: 1 }}
          animate={isLive ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
          transition={isLive ? { type: 'timing', duration: 900, loop: true, repeatReverse: true } : { type: 'timing', duration: 0 }}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: accent + '20', alignItems: 'center', justifyContent: 'center' }}>
          <Flame size={18} color={accent} />
        </MotiView>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{isLive ? `${win.label} is on now` : `${win.label} soon`}</Text>
          <Text numberOfLines={2} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2, lineHeight: 17 }}>{tip}</Text>
        </View>
        <ChevronRight size={16} color={accent} />
      </PressableScale>
    </MotiView>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= BP.tablet;
  const cols = useHomeColumns();

  const rawFirst = (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0];
  const firstName = rawFirst ? rawFirst.toLowerCase() : null;

  const { data: addresses = [] } = useAddresses(user?.id);
  const { loc, requestDeviceLocation } = useDeviceLocation();
  const locCapturing = loc.status === 'requesting';
  usePurgeGpsAddresses(user?.id);

  // Location: city for discovery feed filtering + display label
  const filterCity = loc.status === 'granted' && loc.city
    ? loc.city
    : (addresses.find((a) => a.isDefault) ?? addresses[0])?.city ?? null;
  const locationLabel = loc.status === 'granted' && loc.city
    ? [loc.city, loc.state].filter(Boolean).join(', ')
    : (() => {
        const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
        return defaultAddress ? [defaultAddress.city, defaultAddress.state].filter(Boolean).join(', ') : 'near you';
      })();

  const { data: liveMeals, isLoading: mealsLoading, refetch: refetchMeals } = useFeaturedMeals(10, filterCity);
  // usePersonalizedMeals already reads user?.user_metadata (which includes dietary prefs)
  // so personalization here picks up 'Vegan', 'Keto', etc. automatically via user_metadata.
  const rankedMeals = usePersonalizedMeals(liveMeals ?? [], user?.id, user?.user_metadata ?? null).map((s) => s.meal);
  const baseMeals = rankedMeals.length > 0 ? rankedMeals : (liveMeals ?? []);
  const homeMealIds = baseMeals.map((m) => m.id);
  const { data: homeStockMap = {} } = useTodayStock(homeMealIds);
  const meals = baseMeals.map((m) => ({ ...m, stockRemaining: homeStockMap[m.id]?.qtyRemaining ?? null }));

  const { data: myOrders, refetch: refetchOrders } = useMyOrders(user?.id);
  const activeOrder = (myOrders ?? []).find((o) => o.status !== 'completed' && o.status !== 'cancelled');

  const { data: notifications, refetch: refetchNotifs } = useNotifications(user?.id);
  const unreadNotifs = (notifications ?? []).filter((n) => !n.read).length;
  const activeOrders = (myOrders ?? []).filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;

  const { data: cart, refetch: refetchCart } = useCart(user?.id);
  const cartCount = cart?.count ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchMeals(), refetchOrders(), refetchNotifs(), refetchCart()]);
    setRefreshing(false);
  }

  async function handleLocationTap() {
    if (locCapturing) return;
    feedback.tap();
    if (!user) { router.push('/auth?mode=signup'); return; }
    const result = await requestDeviceLocation();
    if (result === 'denied') router.push('/addresses');
  }

  const headerPad = isTablet ? 28 : 20;
  const greet = greeting();
  const uid = user?.id;

  const headerEl = (
    <View style={{ paddingTop: 24 }}>
      {/* ── Greeting row + icon buttons ── */}
      <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 180 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: headerPad, gap: 12 }}>
          {/* Left: greeting + location */}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.5, lineHeight: 33 }}>
              {`${greet}, `}{firstName ?? 'there'}
            </Text>
            <PressableScale onPress={handleLocationTap} accessibilityRole="button"
              accessibilityLabel={`Location: ${locCapturing ? 'detecting' : locationLabel}. Tap to change.`}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4 }}>
              <MapPin size={12} color={Palette.textSecondary} />
              <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
                {locCapturing ? 'detecting...' : locationLabel}
              </Text>
            </PressableScale>
          </View>
          {/* Right: notification + cart */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
            <HeaderIconButton Icon={Bell} badge={unreadNotifs} onPress={() => router.push('/notifications')}
              label={unreadNotifs ? `Notifications, ${unreadNotifs} unread` : 'Notifications'} />
            <View>
              {cartCount > 0 ? (
                <MotiView
                  from={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.52, opacity: 0 }}
                  transition={{ type: 'timing', duration: 1400, loop: true }}
                  style={{ position: 'absolute', width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: ORANGE }}
                />
              ) : null}
              <HeaderIconButton Icon={ShoppingCart} badge={cartCount} onPress={() => router.push('/cart')}
                label={cartCount ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'} />
            </View>
          </View>
        </View>
      </MotiView>
    </View>
  );

  const searchEl = (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 200, delay: 130 }}>
      <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }} accessibilityRole="search"
        accessibilityLabel="Search meals, kitchens"
        style={{ marginHorizontal: 20, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, backgroundColor: Palette.surface, paddingHorizontal: 16, gap: 10, ...Shadow.card }}>
          <Search size={16} color={MUTED} />
          <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 14, color: MUTED }}>Search meals, kitchens…</Text>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <SlidersHorizontal size={15} color={ORANGE} />
          </View>
        </View>
      </PressableScale>
    </MotiView>
  );

  // ─── Desktop two-column layout ────────────────────────────────────────────
  if (cols.twoCol) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 12, gap: cols.gap, justifyContent: 'center' }}>
            <View style={{ width: cols.main, maxWidth: cols.main }}>
              <ScrollView showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 48 }}>
                {headerEl}
                {searchEl}
                <CategoryIconsRow />
                <View style={{ marginTop: 4 }}><TrendingSection meals={meals} isLoading={mealsLoading} isTablet={false} /></View>
                <View style={{ marginTop: 24 }}><FeaturedKitchensSection /></View>
                {!activeOrder ? <RushBanner /> : null}
                {activeOrder ? <ActiveOrderBanner order={activeOrder} /> : null}
                {activeOrder ? <View style={{ height: 8 }} /> : null}
                <ActionSplitter planImage={meals[0]?.image} dropImage={meals[1]?.image} />
                <ChefsInActionFeed />
                <View style={{ marginTop: 24 }}><FreshDropsSection /></View>
                <View style={{ marginTop: 24 }}><RecentlyViewedSection /></View>
                {uid ? <View style={{ marginTop: 24 }}><FollowingKitchensSection userId={uid} /></View> : null}
                <View style={{ marginTop: 24 }}><ForYouSection userId={uid} firstName={firstName} /></View>
                <View style={{ marginTop: 24 }}><TrendingNowSection /></View>
              </ScrollView>
            </View>
            <View style={{ width: cols.rail }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12, paddingBottom: 48, gap: 4 }}>
                {uid ? <View style={{ marginTop: 24 }}><MyPlansSection userId={uid} /></View> : null}
                <View style={{ marginTop: 16 }}><RewardsBanner /></View>
                <View style={{ marginTop: 24 }}><MealPlansDiscoverySection /></View>
                <View style={{ marginTop: 24 }}><SurpriseMeBanner /></View>
                <View style={{ marginTop: 16 }}><BecomePrepperNudge /></View>
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Mobile / single column ───────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 12 : 0, paddingBottom: 40 }}>
          {headerEl}
          {searchEl}
          <CategoryIconsRow />
          <View style={{ marginTop: 4 }}><TrendingSection meals={meals} isLoading={mealsLoading} isTablet={isTablet} /></View>
          <View style={{ marginTop: 24 }}><FeaturedKitchensSection /></View>
          {!activeOrder ? <RushBanner /> : null}
          {activeOrder ? <ActiveOrderBanner order={activeOrder} /> : null}
          {activeOrder ? <View style={{ height: 8 }} /> : null}
          <ActionSplitter planImage={meals[0]?.image} dropImage={meals[1]?.image} />
          <ChefsInActionFeed />
          <View style={{ marginTop: 24 }}><FreshDropsSection /></View>
          <View style={{ marginTop: 24 }}><RecentlyViewedSection /></View>
          {uid ? <View style={{ marginTop: 24 }}><FollowingKitchensSection userId={uid} /></View> : null}
          <View style={{ marginTop: 24 }}><ForYouSection userId={uid} firstName={firstName} /></View>
          <View style={{ marginTop: 24 }}><TrendingNowSection /></View>
          {uid ? <View style={{ marginTop: 24 }}><MyPlansSection userId={uid} /></View> : null}
          <View style={{ marginTop: 24 }}><MealPlansDiscoverySection /></View>
          <View style={{ marginTop: 24 }}><SurpriseMeBanner /></View>
          <View style={{ marginTop: 16 }}><RewardsBanner /></View>
          <View style={{ marginTop: 16 }}><BecomePrepperNudge /></View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
