import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  Search,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Platform, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PreppaLogo } from '@/components/preppa-logo';
import { Font } from '@/constants/fonts';
import { recommendedMeals } from '@/constants/mock';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { greeting } from '@/lib/greeting';
import { useFeaturedMeals } from '@/lib/queries/meals';
import { useMealPlans, useMySubscriptions } from '@/lib/queries/meal-plans';
import { useMyOrders } from '@/lib/queries/orders';
import { useNotifications } from '@/lib/queries/notifications';
import { useTopPreppers } from '@/lib/queries/preppers';
import { useCarouselCardWidth, useBreakpoint, useContentWidth, usePagePadding, gridCardWidth } from '@/lib/layout';
import { useAuth } from '@/providers/auth-provider';
import { feedback } from '@/lib/feedback';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Order placed — awaiting kitchen',
  confirmed: 'Order confirmed',
  preparing: 'Being prepped now',
  ready: 'Your order is ready',
  out_for_delivery: 'On the way to you',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  linkLabel,
  onLink,
}: {
  title: string;
  linkLabel?: string;
  onLink?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 8, marginBottom: 10 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3 }}>{title}</Text>
      {onLink ? (
        <PressableScale onPress={onLink} accessibilityRole="button" accessibilityLabel={linkLabel ?? 'See all'}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>{linkLabel ?? 'see all'}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function ActiveOrderBanner({ order }: { order: NonNullable<ReturnType<typeof useMyOrders>['data']>[number] }) {
  const router = useRouter();
  const label = ORDER_STATUS_LABEL[order.status] ?? 'Order in progress';
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/orders'); }}
        accessibilityRole="button"
        accessibilityLabel={`Track your order — ${label}`}
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
        {subs.map((sub) => {
          const nextDate = sub.next_billing_at
            ? new Date(sub.next_billing_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : null;
          const isActive = sub.status === 'active';
          return (
            <PressableScale
              key={sub.id}
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
          );
        })}
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

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 180 }}>
      <SectionHeader title="today's picks" linkLabel="see all →" onLink={() => { feedback.tap(); router.push('/search'); }} />
      {isLoading ? (
        <CardRowSkeleton count={3} />
      ) : isTablet ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: pad, paddingBottom: 4 }}>
          {(meals ?? []).map((m, i) => (
            <MotiView key={m.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 28 }}>
              <MealCard meal={m} width={gridCardWidth(contentWidth, pad)} />
            </MotiView>
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {(meals ?? []).map((m) => (
            <MealCard key={m.id} meal={m} width={carouselCardWidth} />
          ))}
        </ScrollView>
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
          {(plans ?? []).map((plan) => (
            <PressableScale
              key={plan.id}
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
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}

function ExperiencesBanner() {
  const router = useRouter();
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 240 }}>
      <View style={{ marginHorizontal: 20, marginTop: 8, borderRadius: Radius.lg, overflow: 'hidden' }}>
        <LinearGradient
          colors={[ORANGE, '#C94A0F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 20, gap: 10 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.5 }}>book a private chef</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>cooking classes, catering &amp; pop-up dinners near you</Text>
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/experiences'); }}
            accessibilityRole="button"
            accessibilityLabel="Explore experiences"
            style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>explore experiences</Text>
            <ChevronRight size={14} color={ORANGE} />
          </PressableScale>
        </LinearGradient>
      </View>
    </MotiView>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const bp = useBreakpoint();

  const rawFirst = (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0];
  const firstName = rawFirst ? rawFirst.toLowerCase() : null;

  const { data: liveMeals, isLoading: mealsLoading, refetch: refetchMeals } = useFeaturedMeals();
  const meals = liveMeals && liveMeals.length > 0 ? liveMeals : recommendedMeals;

  const { data: myOrders, refetch: refetchOrders } = useMyOrders(user?.id);
  const activeOrder = (myOrders ?? []).find((o) => o.status !== 'completed' && o.status !== 'cancelled');

  const { data: notifications, refetch: refetchNotifs } = useNotifications(user?.id);
  const unreadNotifs = (notifications ?? []).filter((n) => !n.read).length;
  const activeOrders = (myOrders ?? []).filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;
  const badgeCount = activeOrders + unreadNotifs;

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchMeals(), refetchOrders(), refetchNotifs()]);
    setRefreshing(false);
  }

  const headerPad = isTablet ? 28 : 20;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 12 : 0, paddingBottom: 40 }}>

          {/* 1. Header */}
          <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: headerPad, paddingTop: 8, gap: 12 }}>
              {/* Greeting */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>{greeting()}{firstName ? `, ${firstName}` : ''}</Text>
                <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.8, lineHeight: 34, marginTop: 2 }}>
                  what can I{'\n'}<Text style={{ color: ORANGE }}>preorder today?</Text>
                </Text>
              </View>
              {/* Actions */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                <PressableScale
                  onPress={() => { feedback.tap(); router.push('/search'); }}
                  accessibilityRole="button"
                  accessibilityLabel="Search"
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={20} color={INK} />
                </PressableScale>
                <PressableScale
                  onPress={() => { feedback.tap(); router.push('/messages'); }}
                  accessibilityRole="button"
                  accessibilityLabel={badgeCount ? `Inbox, ${badgeCount} unread` : 'Inbox'}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Bell size={20} color={INK} />
                  {badgeCount > 0 ? (
                    <View style={{ position: 'absolute', top: 8, right: 9, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: '#fff' }}>{badgeCount}</Text>
                    </View>
                  ) : null}
                </PressableScale>
              </View>
            </View>
          </MotiView>

          {/* 2. Active Order Tracker */}
          {activeOrder ? <ActiveOrderBanner order={activeOrder} /> : null}

          {/* 3. My Meal Plans */}
          {user?.id ? (
            <View style={{ marginTop: 24 }}>
              <MyPlansSection userId={user.id} />
            </View>
          ) : null}

          {/* 4. Nearby Preppers */}
          <View style={{ marginTop: 24 }}>
            <NearbyPreppersSection />
          </View>

          {/* 5. Featured Meals */}
          <View style={{ marginTop: 24 }}>
            <FeaturedMealsSection meals={meals} isLoading={mealsLoading} isTablet={isTablet} />
          </View>

          {/* 6. Meal Plans Discovery */}
          <View style={{ marginTop: 24 }}>
            <MealPlansDiscoverySection />
          </View>

          {/* 7. Experiences Teaser */}
          <View style={{ marginTop: 24 }}>
            <ExperiencesBanner />
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
