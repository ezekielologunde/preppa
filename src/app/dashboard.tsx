import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefHat, ChevronLeft, Clock, ShieldX } from 'lucide-react-native';

import { Ring } from '@/components/dashboard-widgets';
import { PrepperBadgeShelf } from '@/components/badge-shelf';
import { TabletDashboardColumns } from '@/components/tablet/dashboard-columns';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileHealthCard } from '@/components/profile-health-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardFloatingBar } from '@/components/dashboard/dashboard-nav';
import { PrepperNextOrder } from '@/components/dashboard/prepper-next-order';
import { PrepperQuickActions } from '@/components/dashboard/prepper-quick-actions';
import { PrepperStatCards } from '@/components/dashboard/prepper-stat-cards';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';
import { usePrepperMembership } from '@/lib/queries/memberships';
import { useAdvanceOrder, usePrepperOrders, type OrderSummary } from '@/lib/queries/orders';
import {
  useMyPrepperApplication,
  usePrepperBadges,
  usePrepperProfile,
  useToggleAvailability,
  useToggleHomeCookAvailability,
} from '@/lib/queries/preppers';
import { usePrepperReviews } from '@/lib/queries/reviews';
import { useAuth } from '@/providers/auth-provider';
import type { OrderStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const YELLOW = Palette.amber;
const BG = Palette.canvas;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending: { next: 'confirmed', cta: 'confirm preorder' },
  confirmed: { next: 'preparing', cta: 'start prepping' },
  preparing: { next: 'ready', cta: 'mark ready' },
  ready: { next: 'completed', cta: 'mark complete' },
  out_for_delivery: { next: 'completed', cta: 'mark complete' },
};

function buildDailySpark(
  orders: OrderSummary[],
  n: number,
  getValue: (grp: OrderSummary[]) => number,
): number[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const start = now.getTime() - (n - 1 - i) * 86400000;
    const end = start + 86400000;
    return getValue(
      orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= start && t < end;
      }),
    );
  });
}

export default function DashboardScreen() {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const desktop = breakpoint === 'desktop';
  const isTablet = breakpoint === 'tablet';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: prepper, isLoading: appLoading, refetch: refetchPrepper } =
    useMyPrepperApplication(user?.id);
  const { data: prepperProfile } = usePrepperProfile(prepper?.id);
  const { data: prepperMembership, refetch: refetchMembership } =
    usePrepperMembership(prepper?.id);
  const isPro = prepperMembership?.isPro === true;
  const { data: prepperBadges, refetch: refetchBadges } = usePrepperBadges(prepper?.id);
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } =
    usePrepperOrders(prepper?.id);
  const statsLoading = appLoading || (prepper?.id != null && ordersLoading);
  const { data: reviews, refetch: refetchReviews } = usePrepperReviews(prepper?.id);

  const advance = useAdvanceOrder();
  const toggleAvailability = useToggleAvailability(prepper?.id);
  const toggleHomeCook = useToggleHomeCookAvailability(prepper?.id);

  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [homeCook, setHomeCook] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [advanceErr, setAdvanceErr] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      refetchPrepper(), refetchMembership(), refetchBadges(), refetchOrders(), refetchReviews(),
    ]);
    setRefreshing(false);
  }

  async function shareKitchen() {
    if (!prepper?.id) return;
    feedback.tap();
    const url = `https://app.preppa.live/prepper?id=${prepper.id}`;
    const title = prepper.display_name ?? 'My kitchen on Preppa';
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: 'Check out my kitchen on Preppa!', url });
      } else if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        feedback.success();
      } else {
        await Share.share({ title, message: `Check out my kitchen on Preppa! ${url}`, url });
      }
    } catch {
      // user dismissed — not an error
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (appLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  // ── Application status guard ──────────────────────────────────────────────
  if (!prepper || prepper.status !== 'approved') {
    const cfg =
      prepper?.status === 'pending'
        ? { Icon: Clock, tint: YELLOW, title: 'Application under review', body: "Our team is reviewing your kitchen. We'll notify you once you're approved — usually within 48 hours." }
        : prepper?.status === 'rejected'
          ? { Icon: ShieldX, tint: Palette.danger, title: 'Application not approved', body: prepper.rejection_note ?? 'Your application was not approved. Contact support to learn more or submit a new application.' }
          : prepper?.status === 'suspended'
            ? { Icon: ShieldX, tint: Palette.textSecondary, title: 'Kitchen paused', body: 'Your prepper account is currently paused. Contact support to reactivate.' }
            : { Icon: ChefHat, tint: ORANGE, title: 'Become a Prepper', body: "You haven't applied yet. Submit an application to start earning with your cooking." };

    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.canGoBack() ? router.back() : router.replace('/profile'); }}
              accessibilityRole="button" accessibilityLabel="Go back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
            >
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <MotiView from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 200 }}>
              <View style={{ width: 82, height: 82, borderRadius: 28, backgroundColor: cfg.tint + '1F', alignItems: 'center', justifyContent: 'center' }}>
                <cfg.Icon size={36} color={cfg.tint} />
              </View>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, textAlign: 'center', letterSpacing: -0.6 }}>{cfg.title}</Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 320 }}>{cfg.body}</Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
              <PressableScale
                onPress={() => { feedback.tap(); router.replace('/become-prepper'); }}
                accessibilityRole="button" accessibilityLabel="View application status"
                style={{ marginTop: 8, paddingHorizontal: 28, height: 52, borderRadius: Radius.pill, backgroundColor: cfg.tint, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                  {prepper ? 'view application status' : 'apply now'}
                </Text>
              </PressableScale>
            </MotiView>
          </View>
        </SafeAreaView>
      </View>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const isOpen =
    accepting !== null
      ? accepting
      : ((prepper as unknown as { accepting_orders?: boolean })?.accepting_orders !== false);
  const isHomeCookAvailable =
    homeCook !== null ? homeCook : (prepperProfile?.homeCookAvailable ?? false);

  const list: OrderSummary[] = orders ?? [];
  const newCount = list.filter((o) => o.status === 'pending').length;
  const revenue = list.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0);
  const subscribers = new Set(list.map((o) => o.customerId)).size;
  const reviewCount = reviews?.length ?? 0;
  const avgRating = reviewCount ? reviews!.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;

  const revenueSpark = buildDailySpark(list, 8, (g) =>
    g.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0),
  );
  const ordersSpark = buildDailySpark(list, 8, (g) => g.length);
  const customersSpark = buildDailySpark(list, 8, (g) => new Set(g.map((o) => o.customerId)).size);
  const ratingSpark = reviews && reviews.length >= 2 ? reviews.slice(-8).map((r) => r.rating) : [0];

  const active = list.filter((o) =>
    ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status),
  );
  const next = active.length ? active[active.length - 1] : null;
  const step = next ? NEXT[next.status] : undefined;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekCount = list.filter((o) => new Date(o.created_at) >= weekStart).length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRevenue = list
    .filter((o) => o.status === 'completed' && new Date(o.created_at) >= todayStart)
    .reduce((s, o) => s + o.total, 0);

  const avgDaily = revenueSpark.reduce((s, v) => s + v, 0) / (revenueSpark.length || 1);
  const dailyGoal = Math.max(50, Math.ceil((avgDaily * 1.25) / 50) * 50);
  const goalPct = Math.min(Math.round((todayRevenue / dailyGoal) * 100), 100);

  const weekDays = new Array<boolean>(7).fill(false);
  list
    .filter((o) => o.status === 'completed' && new Date(o.created_at) >= weekStart)
    .forEach((o) => { weekDays[(new Date(o.created_at).getDay() + 6) % 7] = true; });

  const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);

  const headerProps = {
    displayName:
      prepper?.display_name ?? (user?.user_metadata?.full_name as string | undefined),
    avatarUrl: user?.user_metadata?.avatar_url as string | undefined,
    newCount,
    isOpen,
    isHomeCookAvailable,
    router,
    onToggleOpen: () => {
      feedback.tap();
      const nxt = !isOpen;
      setAccepting(nxt);
      toggleAvailability.mutate(nxt, {
        onSuccess: () => feedback.success(),
        onError: () => { feedback.error(); setAccepting(!nxt); },
      });
    },
    onToggleHomeCook: () => {
      feedback.tap();
      const nxt = !isHomeCookAvailable;
      setHomeCook(nxt);
      toggleHomeCook.mutate(nxt, {
        onSuccess: () => feedback.success(),
        onError: () => { feedback.error(); setHomeCook(!nxt); },
      });
    },
  };

  // ── Tablet layout ─────────────────────────────────────────────────────────
  if (isTablet) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <DashboardHeader size="tablet" {...headerProps} />
          <TabletDashboardColumns
            isPro={isPro} prepper={prepper} revenue={revenue} orderCount={list.length}
            subscribers={subscribers} avgRating={avgRating} reviewCount={reviewCount}
            newCount={newCount} revenueSpark={revenueSpark} ordersSpark={ordersSpark}
            customersSpark={customersSpark} ratingSpark={ratingSpark} todayRevenue={todayRevenue}
            dailyGoal={dailyGoal} goalPct={goalPct} weekCount={weekCount} weekDays={weekDays}
            next={next} active={active} statsLoading={statsLoading}
            advancePending={advance.isPending} advanceErr={advanceErr}
            onAdvanceNext={(nextStatus) => {
              setAdvanceErr(null);
              advance.mutate({ orderId: next!.id, next: nextStatus }, {
                onSuccess: () => feedback.success(),
                onError: () => { feedback.error(); setAdvanceErr('Could not update order status. Please try again.'); },
              });
            }}
            onShareKitchen={() => void shareKitchen()}
            onDismissAdvanceErr={() => setAdvanceErr(null)}
            prepperBadges={prepperBadges} prepperProfile={prepperProfile}
          />
        </SafeAreaView>
      </View>
    );
  }

  // ── Mobile layout ─────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />
          }
          contentContainerStyle={{
            paddingTop: Platform.OS === 'web' ? 20 : 14,
            paddingBottom: Math.max(insets.bottom, 16) + 140,
          }}
        >
          <DashboardHeader size="mobile" {...headerProps} />

          <PrepperQuickActions
            isOpen={isOpen}
            isPro={isPro}
            hasPrepperId={!!prepper?.id}
            router={router}
            onToggleOpen={headerProps.onToggleOpen}
            onGoLive={() => router.push('/go-live')}
            onShareKitchen={() => void shareKitchen()}
          />

          <PrepperNextOrder
            next={next}
            step={step}
            activeCount={active.length}
            statsLoading={statsLoading}
            advancePending={advance.isPending}
            advanceErr={advanceErr}
            router={router}
            onAdvance={() => {
              setAdvanceErr(null);
              advance.mutate({ orderId: next!.id, next: step!.next }, {
                onSuccess: () => feedback.success(),
                onError: () => { feedback.error(); setAdvanceErr('Could not update order status. Please try again.'); },
              });
            }}
            onDismissErr={() => setAdvanceErr(null)}
          />

          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 140 }}>
            <PrepperStatCards
              statsLoading={statsLoading} isDesktop={desktop} revenue={revenue}
              orderCount={list.length} newCount={newCount} subscribers={subscribers}
              avgRating={avgRating} reviewCount={reviewCount} revenueSpark={revenueSpark}
              ordersSpark={ordersSpark} customersSpark={customersSpark} ratingSpark={ratingSpark}
              router={router}
            />
          </MotiView>

          {/* Today's progress */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 180 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, paddingHorizontal: 20, marginTop: 16, marginBottom: 6, letterSpacing: -0.3 }}>
              today's progress
            </Text>
            {statsLoading ? (
              <View style={{ marginHorizontal: 20, marginBottom: 8 }}>
                <Skeleton width="100%" height={100} radius={20} />
              </View>
            ) : (
              <PressableScale
                onPress={() => { feedback.tap(); router.push('/prepper-analytics'); }}
                accessibilityRole="button"
                accessibilityLabel="View analytics"
                style={{ marginHorizontal: 20, marginBottom: 8 }}
              >
                <View style={{ backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', width: 68, height: 68, flexShrink: 0 }}>
                      <Ring pct={goalPct} color={ORANGE} size={68} stroke={7} />
                      <View style={{ position: 'absolute', alignItems: 'center' }}>
                        <Text style={{ fontFamily: Font.display, fontSize: 14, color: INK }}>{goalPct}%</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>today's goal</Text>
                      <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4, fontVariant: ['tabular-nums'] }}>{money(todayRevenue)}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: MUTED }}>of {money(dailyGoal)}</Text>
                    </View>
                    <View style={{ alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontFamily: Font.display, fontSize: 26, color: ORANGE, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{weekCount}</Text>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: MUTED }}>this week</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: Palette.chip }}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                      <View key={i} style={{ flex: 1, height: 24, borderRadius: 6, backgroundColor: weekDays[i] ? ORANGE + '22' : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: weekDays[i] ? ORANGE : MUTED }}>{d}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </PressableScale>
            )}
          </MotiView>

          {prepperBadges && prepperBadges.length > 0 && (
            <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 8 }}>
              <PrepperBadgeShelf badges={prepperBadges} />
            </View>
          )}

          {prepperProfile && (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 260 }}>
              <ProfileHealthCard profile={prepperProfile} />
            </MotiView>
          )}
        </ScrollView>

        <DashboardFloatingBar
          isPro={isPro} isDesktop={desktop} newCount={newCount}
          bottomInset={insets.bottom} router={router}
          onGoLive={() => router.push('/go-live')}
        />

      </SafeAreaView>
    </View>
  );
}
