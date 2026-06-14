import { Image } from 'expo-image';
import { MotiView } from 'moti';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  Coffee,
  Flame,
  Gift,
  LayoutGrid,
  Leaf,
  MapPin,
  Moon,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Platform, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { PreppaLogo } from '@/components/preppa-logo';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { Font } from '@/constants/fonts';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { greeting } from '@/lib/greeting';
import { useCart } from '@/lib/queries/cart';
import { useFeaturedMeals } from '@/lib/queries/meals';
import { useAddresses } from '@/lib/queries/addresses';
import { useMealPlans, useMySubscriptions } from '@/lib/queries/meal-plans';
import { useMyOrders } from '@/lib/queries/orders';
import { useNotifications } from '@/lib/queries/notifications';
import { useFollowedPreppers, useTopPreppers } from '@/lib/queries/preppers';
import { usePersonalizedMeals } from '@/lib/queries/recommend';
import { BP, useCarouselCardWidth, useContentWidth, usePagePadding, gridCardWidth, useHomeColumns } from '@/lib/layout';
import { useAuth } from '@/providers/auth-provider';
import { feedback } from '@/lib/feedback';
import { getCurrentRush, getNextRush, getRushUrgency } from '@/lib/rush-hour';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Preorder placed — awaiting kitchen',
  confirmed: 'Preorder confirmed',
  preparing: 'Being prepped now',
  ready: 'Your preorder is ready for pickup',
  out_for_delivery: 'On the way to you',
};

const HOME_CATS = [
  { key: 'breakfast', label: 'breakfast', Icon: Coffee, color: Palette.amber },
  { key: 'lunch', label: 'lunch', Icon: UtensilsCrossed, color: Palette.success },
  { key: 'dinner', label: 'dinner', Icon: Moon, color: ORANGE },
  { key: 'healthy', label: 'healthy', Icon: Leaf, color: '#22C55E' },
  { key: 'vegan', label: 'vegan', Icon: Sprout, color: '#8B5CF6' },
  { key: 'more', label: 'more', Icon: LayoutGrid, color: MUTED },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Header utility toggle (bell, cart). 48×48 physical hit target with a soft
 * squircle clip, brand-tinted scale micro-interaction (via PressableScale), and
 * an optional count badge that reads instantly from live query state.
 */
function HeaderIconButton({
  Icon,
  badge,
  onPress,
  label,
}: {
  Icon: ComponentType<{ size?: number; color?: string }>;
  badge: number;
  onPress: () => void;
  label: string;
}) {
  return (
    <PressableScale
      onPress={() => { feedback.tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
      <Icon size={21} color={INK} />
      {badge > 0 ? (
        <MotiView
          from={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          style={{ position: 'absolute', top: 6, right: 6, minWidth: 17, height: 17, borderRadius: 8.5, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: Palette.canvas }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 9.5, color: '#fff' }}>{badge > 99 ? '99+' : badge}</Text>
        </MotiView>
      ) : null}
    </PressableScale>
  );
}

function SectionHeader({ title, linkLabel, onLink }: { title: string; linkLabel?: string; onLink?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 8, marginBottom: 10 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, letterSpacing: -0.4 }}>{title}</Text>
      {onLink ? (
        <PressableScale onPress={onLink} accessibilityRole="button" accessibilityLabel={linkLabel ?? 'See all'}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>{linkLabel ?? 'see all'}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function CategoryIconsRow() {
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 10 }}>
      {HOME_CATS.map((c, i) => (
        <MotiView key={c.key} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200, delay: 80 + i * 28 }}>
          <PressableScale
            onPress={() => { feedback.tap(); router.push(c.key === 'more' ? '/explore' : `/category?key=${c.key}&label=${c.label}`); }}
            accessibilityRole="button"
            accessibilityLabel={`Browse ${c.label}`}
            style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: 60, height: 60, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <c.Icon size={26} color={c.color} />
            </View>
            <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary }}>{c.label}</Text>
          </PressableScale>
        </MotiView>
      ))}
    </ScrollView>
  );
}

function RewardsBanner() {
  const router = useRouter();
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 200 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/rewards'); }}
        accessibilityRole="button"
        accessibilityLabel="View your rewards"
        style={{ marginHorizontal: 20, backgroundColor: '#EDFBF1', borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#C6F0D4' }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
          <Gift size={19} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>earn rewards on every preorder</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>unlock discounts & free meals</Text>
        </View>
        <ChevronRight size={16} color={Palette.success} />
      </PressableScale>
    </MotiView>
  );
}

function ActiveOrderBanner({ order }: { order: NonNullable<ReturnType<typeof useMyOrders>['data']>[number] }) {
  const router = useRouter();
  const label = ORDER_STATUS_LABEL[order.status] ?? 'Preorder in progress';
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/orders'); }}
        accessibilityRole="button"
        accessibilityLabel={`Track your preorder — ${label}`}
        style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: INK, borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <MotiView
          from={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
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

function MyPlansSection({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: subs } = useMySubscriptions(userId);
  const hasSubs = subs && subs.length > 0;

  if (!hasSubs) {
    return (
      <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
        <SectionHeader title="your plans" />
        <PressableScale
          onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
          accessibilityRole="button"
          accessibilityLabel="Subscribe to a weekly meal plan"
          style={{ marginHorizontal: 20, backgroundColor: Palette.brandTint, borderRadius: Radius.lg, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>subscribe to a weekly plan</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>real meals, on repeat — no hassle</Text>
          </View>
          <ChevronRight size={16} color={ORANGE} />
        </PressableScale>
      </MotiView>
    );
  }

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
      <SectionHeader title="your plans" linkLabel="manage →" onLink={() => { feedback.tap(); router.push('/meal-plans'); }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
        {subs.map((sub, i) => {
          const nextDate = sub.next_billing_at
            ? new Date(sub.next_billing_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : null;
          const isActive = sub.status === 'active';
          return (
            <MotiView key={sub.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
              accessibilityRole="button"
              accessibilityLabel={`${sub.plan_name} plan, ${sub.status}`}
              style={{ width: 200, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 14, gap: 6, ...Shadow.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: INK, flex: 1 }}>{sub.plan_name}</Text>
                <View style={{ backgroundColor: isActive ? Palette.success + '22' : Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: isActive ? Palette.success : MUTED }}>{sub.status}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>{sub.prepper?.display_name ?? 'kitchen'}</Text>
              {nextDate ? (
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary }}>next: {nextDate}</Text>
              ) : null}
            </PressableScale>
            </MotiView>
          );
        })}
      </ScrollView>
    </MotiView>
  );
}

function FollowingKitchensSection({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: preppers } = useFollowedPreppers(userId);
  if (!preppers?.length) return null;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
      <SectionHeader title="kitchens you follow" linkLabel="see all →" onLink={() => { feedback.tap(); router.push('/following'); }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
        {preppers.map((prepper, i) => (
          <MotiView key={prepper.id} from={{ opacity: 0, translateX: 10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
            <PrepperCard prepper={prepper} />
          </MotiView>
        ))}
      </ScrollView>
    </MotiView>
  );
}

function NearbyPreppersSection() {
  const router = useRouter();
  const { data: preppers, isLoading } = useTopPreppers(8);

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
      <SectionHeader title="local kitchens near you" linkLabel="see all →" onLink={() => { feedback.tap(); router.push('/explore'); }} />
      {isLoading ? (
        <CardRowSkeleton count={3} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {(preppers ?? []).map((prepper, i) => (
            <MotiView key={prepper.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
              <PrepperCard prepper={prepper} showRank />
            </MotiView>
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}

function FeaturedMealsSection({ meals, isLoading, isTablet }: { meals: ReturnType<typeof useFeaturedMeals>['data']; isLoading: boolean; isTablet: boolean }) {
  const router = useRouter();
  const contentWidth = useContentWidth();
  const pad = usePagePadding();
  const carouselCardWidth = useCarouselCardWidth();
  const list = meals ?? [];
  const [hero, ...rest] = list;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 180 }}>
      <SectionHeader title="recommended for you" linkLabel="see all →" onLink={() => { feedback.tap(); router.push('/search'); }} />
      {isLoading ? (
        <CardRowSkeleton count={3} />
      ) : isTablet ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: pad, paddingBottom: 4 }}>
          {list.map((m, i) => (
            <MotiView key={m.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 28 }}>
              <MealCard meal={m} width={gridCardWidth(contentWidth, pad)} />
            </MotiView>
          ))}
        </View>
      ) : (
        <>
          {hero ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }} style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <MealCard meal={hero} width={null} variant="big" />
            </MotiView>
          ) : null}
          {rest.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
              {rest.map((m, i) => (
                <MotiView key={m.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 28 }}>
                  <MealCard meal={m} width={carouselCardWidth} />
                </MotiView>
              ))}
            </ScrollView>
          ) : null}
        </>
      )}
    </MotiView>
  );
}

function MealPlansDiscoverySection() {
  const router = useRouter();
  const { data: plans, isLoading } = useMealPlans();
  if (!isLoading && (!plans || plans.length === 0)) return null;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 180 }}>
      <SectionHeader title="meal plans" linkLabel="explore →" onLink={() => { feedback.tap(); router.push('/meal-plans'); }} />
      {isLoading ? (
        <CardRowSkeleton count={3} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {(plans ?? []).map((plan, i) => (
            <MotiView key={plan.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
              accessibilityRole="button"
              accessibilityLabel={`${plan.name} by ${plan.prepper}, $${plan.price} per week`}
              style={{ width: 190, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
              <View style={{ height: 100, backgroundColor: Palette.brandTint }}>
                {plan.image_url ? (
                  <Image source={{ uri: plan.image_url }} style={{ flex: 1 }} contentFit="cover" transition={200} />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <UtensilsCrossed size={32} color={ORANGE} />
                  </View>
                )}
              </View>
              <View style={{ padding: 12, gap: 4 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{plan.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>{plan.prepper}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>${plan.price.toFixed(0)}/wk</Text>
                  {plan.tags?.length ? (
                    <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: MUTED, flex: 1, textAlign: 'right' }}>{plan.tags[0]}</Text>
                  ) : null}
                </View>
              </View>
            </PressableScale>
            </MotiView>
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}

function SurpriseMeBanner() {
  const router = useRouter();
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 240 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/surprise'); }}
        accessibilityRole="button"
        accessibilityLabel="Chef surprise me — let us pick the perfect meal"
        style={{ marginHorizontal: 20 }}>
        <LinearGradient
          colors={['#FEF0E8', '#FDDFC8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', minHeight: 116 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 19, color: INK, letterSpacing: -0.5 }}>chef surprise me</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: '#7A5A45', marginTop: 5, lineHeight: 18 }}>
              tell us your mood,{'\n'}we'll pick the perfect meal
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, backgroundColor: INK, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' }}>
              <Sparkles size={13} color="#fff" />
              <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff' }}>surprise me</Text>
            </View>
          </View>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
            <UtensilsCrossed size={36} color={ORANGE} />
          </View>
        </LinearGradient>
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
  const tip = isLive
    ? win.buyerTip
    : `${win.label} starts in ~${minsAway} min — browse kitchens ahead of the rush.`;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 40 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/search'); }}
        accessibilityRole="button"
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
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>
            {isLive ? `${win.label} is on now` : `${win.label} soon`}
          </Text>
          <Text numberOfLines={2} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2, lineHeight: 17 }}>
            {tip}
          </Text>
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

  const { data: liveMeals, isLoading: mealsLoading, refetch: refetchMeals } = useFeaturedMeals();
  const rankedMeals = usePersonalizedMeals(liveMeals ?? [], user?.id, user?.user_metadata ?? null).map((s) => s.meal);
  const meals = rankedMeals.length > 0 ? rankedMeals : (liveMeals ?? []);

  const { data: addresses = [] } = useAddresses(user?.id);
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const locationLabel = defaultAddress
    ? [defaultAddress.city, defaultAddress.state].filter(Boolean).join(', ')
    : 'Set location';

  const { data: myOrders, refetch: refetchOrders } = useMyOrders(user?.id);
  const activeOrder = (myOrders ?? []).find((o) => o.status !== 'completed' && o.status !== 'cancelled');

  const { data: notifications, refetch: refetchNotifs } = useNotifications(user?.id);
  const unreadNotifs = (notifications ?? []).filter((n) => !n.read).length;
  const activeOrders = (myOrders ?? []).filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;
  const badgeCount = activeOrders + unreadNotifs;

  const { data: cart, refetch: refetchCart } = useCart(user?.id);
  const cartCount = cart?.count ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchMeals(), refetchOrders(), refetchNotifs(), refetchCart()]);
    setRefreshing(false);
  }

  const headerPad = isTablet ? 28 : 20;
  // Fluid single-line headline. adjustsFontSizeToFit is a no-op on web, so the
  // size must already fit the row: "what are you craving today?" (~27 chars at
  // ~0.56em each) against the *container* width minus padding. On desktop the
  // header lives in the narrower feed column, so size against that, not `width`.
  const headlineWidth = cols.twoCol ? cols.main : width;
  const cravingSize = Math.max(18, Math.min((headlineWidth - headerPad * 2) / 16, 26));

  // ─── Header (logo + greeting + bell/cart) — shared by both layouts ───────────
  const headerEl = (
          <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            {/* Control row: brand logo · greeting + location · bell + cart */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: headerPad, paddingTop: 8, gap: 12 }}>
              {/* Native Preppa mark — borderless, floats on the canvas (no ring/plate) */}
              <PressableScale
                onPress={() => { feedback.tap(); router.push('/profile'); }}
                accessibilityRole="button"
                accessibilityLabel="Your profile"
                hitSlop={8}>
                <PreppaLogo size={62} showTile={false} flameColor={ORANGE} />
              </PressableScale>

              {/* Greeting + tappable location */}
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>
                  {greeting()}{firstName ? `, ${firstName}` : ''}
                </Text>
                <PressableScale
                  onPress={() => { feedback.tap(); router.push('/addresses'); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delivery location: ${locationLabel}`}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' }}>
                  <MapPin size={12} color={ORANGE} />
                  <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 12, color: defaultAddress ? Palette.textSecondary : ORANGE }}>{locationLabel}</Text>
                </PressableScale>
              </View>

              {/* Control cluster: notifications + cart, adjacent */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <HeaderIconButton
                  Icon={Bell}
                  badge={badgeCount}
                  onPress={() => router.push('/messages')}
                  label={badgeCount ? `Inbox, ${badgeCount} unread` : 'Inbox'}
                />
                <HeaderIconButton
                  Icon={ShoppingCart}
                  badge={cartCount}
                  onPress={() => router.push('/cart')}
                  label={cartCount ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
                />
              </View>
            </View>

            {/* Headline: single fluid line — shrinks, never wraps */}
            <View style={{ paddingHorizontal: headerPad, marginTop: 12 }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={{ fontFamily: Font.display, fontSize: cravingSize, color: INK, letterSpacing: -0.6 }}>
                what are you <Text style={{ color: ORANGE }}>craving today?</Text>
              </Text>
            </View>
          </MotiView>

  );

  // ─── Search bar — shared by both layouts ────────────────────────────────────
  const searchEl = (
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 40 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/search'); }}
              accessibilityRole="search"
              accessibilityLabel="Search meals, cuisines, or preppers"
              style={{ marginHorizontal: 20, marginTop: 16, flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 18, backgroundColor: Palette.surface, paddingLeft: 16, paddingRight: 8, gap: 10, ...Shadow.card }}>
              <Search size={19} color={MUTED} />
              <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 14, color: MUTED }}>search meals, cuisines, or preppers…</Text>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <SlidersHorizontal size={17} color={ORANGE} />
              </View>
            </PressableScale>
          </MotiView>
  );

  // ─── Section blocks (composed differently per layout) ───────────────────────
  const rushBlock = !activeOrder ? <RushBanner /> : null;
  const activeOrderBlock = activeOrder ? <ActiveOrderBanner order={activeOrder} /> : null;
  const plansBlock = user?.id ? (
    <View style={{ marginTop: 24 }}><MyPlansSection userId={user.id} /></View>
  ) : null;
  const followingBlock = user?.id ? (
    <View style={{ marginTop: 24 }}><FollowingKitchensSection userId={user.id} /></View>
  ) : null;
  const nearbyBlock = (
    <View style={{ marginTop: 24 }}><NearbyPreppersSection /></View>
  );
  // On the desktop two-column layout the feed column is narrow, so the
  // "recommended" section stays a horizontal carousel instead of a wide grid.
  const featuredBlock = (
    <View style={{ marginTop: 24 }}>
      <FeaturedMealsSection meals={meals} isLoading={mealsLoading} isTablet={isTablet && !cols.twoCol} />
    </View>
  );
  const rewardsBlock = <View style={{ marginTop: 16 }}><RewardsBanner /></View>;
  const discoveryBlock = <View style={{ marginTop: 24 }}><MealPlansDiscoverySection /></View>;
  const surpriseBlock = <View style={{ marginTop: 24 }}><SurpriseMeBanner /></View>;

  // ─── Desktop: primary feed column + right rail ──────────────────────────────
  if (cols.twoCol) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 12, gap: cols.gap, justifyContent: 'center' }}>
            {/* Primary feed */}
            <View style={{ width: cols.main, maxWidth: cols.main }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 48 }}>
                {headerEl}
                {searchEl}
                <CategoryIconsRow />
                {rushBlock}
                {activeOrderBlock}
                {followingBlock}
                {nearbyBlock}
                {featuredBlock}
              </ScrollView>
            </View>

            {/* Right rail — secondary surfaces */}
            <View style={{ width: cols.rail }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12, paddingBottom: 48, gap: 4 }}>
                {plansBlock}
                {rewardsBlock}
                {discoveryBlock}
                {surpriseBlock}
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Mobile / iPad: single column (unchanged) ───────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 12 : 0, paddingBottom: 40 }}>
          {headerEl}
          {searchEl}
          <CategoryIconsRow />
          {rushBlock}
          {activeOrderBlock}
          {plansBlock}
          {followingBlock}
          {nearbyBlock}
          {featuredBlock}
          {rewardsBlock}
          {discoveryBlock}
          {surpriseBlock}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
