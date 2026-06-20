import { useRouter } from 'expo-router';
import { Award, ChevronLeft, ChevronRight, Clock, Crown, Flame, Lightbulb, Package, TrendingUp, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevenueBarChart } from '@/components/revenue-bar-chart';
import { TopMealsList } from '@/components/top-meals-list';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';
import { useTopMeals, useWeeklyRevenue, useRepeatCustomerRate } from '@/lib/queries/analytics';
import { usePrepperMembership } from '@/lib/queries/memberships';
import { usePrepperOrders, type OrderSummary } from '@/lib/queries/orders';
import { useMyPrepperApplication, usePrepperProfile } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const S1 = { shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = ['7–10am', '11am–2pm', '4–8pm', 'other'];

function buildDayBars(orders: OrderSummary[]): { day: string; count: number }[] {
  const counts = Array(7).fill(0);
  for (const o of orders) {
    const d = new Date(o.created_at).getDay();
    if (!isNaN(d)) counts[d]++;
  }
  return DAYS.map((day, i) => ({ day, count: counts[i] }));
}

function buildSlotBars(orders: OrderSummary[]): { slot: string; count: number }[] {
  const counts = [0, 0, 0, 0];
  for (const o of orders) {
    const h = new Date(o.created_at).getHours();
    if (h >= 7 && h < 10) counts[0]++;
    else if (h >= 11 && h < 14) counts[1]++;
    else if (h >= 16 && h < 20) counts[2]++;
    else counts[3]++;
  }
  return TIME_SLOTS.map((slot, i) => ({ slot, count: counts[i] }));
}

function computeTopDishes(orders: OrderSummary[]): { title: string; count: number }[] {
  const freq: Record<string, number> = {};
  for (const o of orders) {
    for (const item of o.items) freq[item.title] = (freq[item.title] ?? 0) + item.quantity;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, count]) => ({ title, count }));
}

function computeRepeatRate(orders: OrderSummary[]): number {
  if (!orders.length) return 0;
  const freq = new Map<string, number>();
  for (const o of orders) freq.set(o.customerId, (freq.get(o.customerId) ?? 0) + 1);
  const unique = freq.size;
  const repeats = [...freq.values()].filter((c) => c > 1).length;
  return unique > 0 ? Math.round((repeats / unique) * 100) : 0;
}

function buildRevenueBars(orders: OrderSummary[]): { day: string; revenue: number }[] {
  const amounts = Array(7).fill(0);
  for (const o of orders) {
    const d = new Date(o.created_at).getDay();
    if (!isNaN(d)) amounts[d] += o.total ?? 0;
  }
  return DAYS.map((day, i) => ({ day, revenue: amounts[i] }));
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={{ flex: 1, height: 60, justifyContent: 'flex-end', alignItems: 'center' }}>
      {value > 0 ? (
        <Text style={{ fontFamily: Font.medium, fontSize: 9, color, marginBottom: 2, fontVariant: ['tabular-nums'] }}>{value}</Text>
      ) : null}
      <View style={{ width: 20, backgroundColor: color + '20', borderRadius: 6, overflow: 'hidden', height: 48 }}>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, backgroundColor: color, borderRadius: 6 }} />
      </View>
    </View>
  );
}


const PERIODS = [
  { key: 'week' as const, label: '7 days', ms: 7 * 86400000 },
  { key: 'month' as const, label: '30 days', ms: 30 * 86400000 },
  { key: 'all' as const, label: 'all time', ms: 0 },
];

export default function PrepperAnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application, isLoading: appLoading } = useMyPrepperApplication(user?.id);
  const { data: prepperMembership, isLoading: membershipLoading } = usePrepperMembership(application?.id);
  const isPro = prepperMembership?.isPro === true;
  const { data: orders, isLoading: ordersLoading, isError: ordersError, refetch } = usePrepperOrders(application?.id);
  const { data: prepperProfile } = usePrepperProfile(application?.id);
  const { data: topMeals = [] } = useTopMeals(application?.id);
  const { data: weeklyRevenue = [] } = useWeeklyRevenue(application?.id);
  const { data: repeatStats } = useRepeatCustomerRate(application?.id);
  const isDesktop = useBreakpoint() === 'desktop';
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const cutoff = PERIODS.find((p) => p.key === period)!.ms;
  const now = Date.now();
  const completed = (orders ?? []).filter((o) => o.status === 'completed' && (cutoff === 0 || new Date(o.created_at).getTime() >= now - cutoff));

  const todayIdx = new Date().getDay();
  const dayBars = buildDayBars(completed);
  const slotBars = buildSlotBars(completed);
  const topDishes = computeTopDishes(completed);
  const topDish = topDishes[0]?.title ?? 'No data yet';
  const maxDay = Math.max(...dayBars.map((d) => d.count), 1);
  const maxSlot = Math.max(...slotBars.map((s) => s.count), 1);
  const totalEarnings = completed.reduce((s, o) => s + (o.total ?? 0), 0);
  const avgOrder = completed.length ? totalEarnings / completed.length : 0;
  const repeatRate = computeRepeatRate(completed);

  const revenueBars = buildRevenueBars(completed);
  const maxRevenue = Math.max(...revenueBars.map((r) => r.revenue), 1);
  const topDay = dayBars.reduce((a, b) => a.count >= b.count ? a : b, dayBars[0] ?? { day: 'Thursday', count: 0 });

  const topCustomers = (() => {
    const map = new Map<string, { name: string; orders: number; spend: number }>();
    for (const o of completed) {
      const row = map.get(o.customerId) ?? { name: o.customer, orders: 0, spend: 0 };
      row.orders += 1;
      row.spend += o.total ?? 0;
      map.set(o.customerId, row);
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend).slice(0, 3);
  })();
  const topSlot = slotBars.reduce((a, b) => a.count >= b.count ? a : b, slotBars[0] ?? { slot: '11am–2pm', count: 0 });
  const insights = [
    { icon: Flame, color: Palette.danger, text: completed.length === 0 ? 'Complete your first preorders to see which rush window drives your sales.' : `Your ${topSlot.slot} window drives the most preorders. Batch-prep 30 mins before to cut fulfillment time.` },
    { icon: TrendingUp, color: ORANGE, text: avgOrder > 0 ? `Your average preorder is $${avgOrder.toFixed(0)}. Adding a dessert or drink add-on could push it 15–20% higher.` : 'List meals at different price points to attract more customers and raise your average order value.' },
    { icon: Award, color: '#8b5cf6', text: topDish !== 'No data yet' ? `"${topDish}" is your best seller. Batch it on ${topDay.day} — your busiest day.` : 'Complete your first orders to discover which dishes your customers love most.' },
    { icon: Clock, color: '#0891b2', text: repeatRate >= 30 ? `${repeatRate}% of your customers are repeat buyers — strong loyalty. Engage them with weekly specials and subscription plans.` : `Grow repeat buyers beyond ${repeatRate}% by offering subscription plans and responding to reviews promptly.` },
  ];

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }

  if (!isPro && !membershipLoading && !appLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>analytics</Text>
          </View>
          {/* Blurred preview of charts behind the paywall */}
          <View style={{ position: 'relative', flex: 1 }}>
            <View style={{ opacity: 0.15, flex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
              <View style={{ padding: 20, gap: 14 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, height: 72 }} />
                  <View style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, height: 72 }} />
                  <View style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, height: 72 }} />
                </View>
                <View style={{ backgroundColor: Palette.surface, borderRadius: 16, height: 140 }} />
                <View style={{ backgroundColor: Palette.surface, borderRadius: 16, height: 110 }} />
                <View style={{ backgroundColor: Palette.surface, borderRadius: 14, height: 56 }} />
                <View style={{ backgroundColor: Palette.surface, borderRadius: 14, height: 56 }} />
                <View style={{ backgroundColor: Palette.surface, borderRadius: 14, height: 56 }} />
              </View>
            </View>
            {/* Overlay paywall */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 16 }}>
              <MotiView from={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 200 }}
                style={{ alignItems: 'center', gap: 16, backgroundColor: Palette.canvas + 'E8', borderRadius: 24, padding: 32, width: '100%' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Crown size={40} color={ORANGE} />
                </View>
                <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6, textAlign: 'center' }}>analytics is a pro feature</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                  Track revenue, repeat buyers, and top meals with a Go Pro subscription.
                </Text>
                <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-premium'); }} accessibilityRole="button" accessibilityLabel="Upgrade to Pro"
                  style={{ marginTop: 8, height: 52, paddingHorizontal: 32, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Go Pro</Text>
                </PressableScale>
              </MotiView>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>analytics</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>your kitchen, by the numbers</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {PERIODS.map((p) => (
              <PressableScale key={p.key} onPress={() => { feedback.tap(); setPeriod(p.key); }} accessibilityRole="button" accessibilityLabel={`${p.label} period`} accessibilityState={{ selected: period === p.key }}
                style={{ backgroundColor: period === p.key ? Palette.brandTint : Palette.chip, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: period === p.key ? ORANGE : Palette.textSecondary }}>{p.label}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {(appLoading || (application?.id != null && ordersLoading)) ? (
          <View style={{ padding: 20, gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Skeleton height={72} radius={14} style={{ flex: 1 }} />
              <Skeleton height={72} radius={14} style={{ flex: 1 }} />
              <Skeleton height={72} radius={14} style={{ flex: 1 }} />
            </View>
            <Skeleton width="100%" height={140} radius={16} />
            <Skeleton width="100%" height={110} radius={16} />
            <Skeleton width={120} height={18} radius={6} />
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} width="100%" height={56} radius={14} />
            ))}
          </View>
        ) : ordersError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...S1 }}>
              <TrendingUp size={28} color={Palette.textSecondary} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK }}>couldn't load analytics</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              Check your connection and try again.
            </Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading analytics"
              style={{ marginTop: 4, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : application && application.status !== 'approved' ? (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...S1 }}>
              <Package size={28} color={Palette.textSecondary} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK, textAlign: 'center' }}>
              {application.status === 'pending' ? 'Application under review' : 'Analytics unavailable'}
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              {application.status === 'pending'
                ? 'Your prepper application is being reviewed. Analytics will appear once you\'re approved.'
                : 'Your kitchen application was not approved. Contact support if you think this is a mistake.'}
            </Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/profile'); }} accessibilityRole="button" accessibilityLabel="Go to profile"
              style={{ marginTop: 4, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 11 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>
                {application.status === 'pending' ? 'view application status' : 'go to profile'}
              </Text>
            </PressableScale>
          </MotiView>
        ) : (
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={[{ padding: 20, gap: 16 }, isDesktop ? { maxWidth: 900, alignSelf: 'center', width: '100%' } : null]}>

          {/* KPI row */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#06b6d4', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{completed.length}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textSecondary, textAlign: 'center' }}>total preorders</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: ORANGE, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>${avgOrder.toFixed(0)}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textSecondary, textAlign: 'center' }}>avg preorder</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.success, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                {repeatStats?.rate ?? repeatRate}%
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textSecondary, textAlign: 'center' }}>repeat customers</Text>
              {repeatStats != null && repeatStats.totalUnique > 0 ? (
                <Text style={{ fontFamily: Font.body, fontSize: 9, color: Palette.textSecondary, textAlign: 'center' }}>
                  {repeatStats.repeatCount} of {repeatStats.totalUnique} returned
                </Text>
              ) : null}
            </View>
          </View>
          </MotiView>

          {/* Audience row — all-time social metrics from prepper_public_stats RPC */}
          {prepperProfile?.stats != null ? (
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 20 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#eef2ff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#4f46e5', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{prepperProfile.stats.followers}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: '#6366f1', textAlign: 'center' }}>followers</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.textSecondary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{prepperProfile.stats.unique_customers}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textSecondary, textAlign: 'center' }}>lifetime customers</Text>
            </View>
          </View>
          </MotiView>
          ) : null}

          {/* Orders by day + revenue by day — side by side on desktop */}
          <View style={isDesktop ? { flexDirection: 'row', gap: 14 } : undefined}>
          <MotiView style={isDesktop ? { flex: 1 } : undefined} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, ...S1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK, marginBottom: 14 }}>preorders by day of week</Text>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 68 }}>
              {dayBars.map(({ day, count }, i) => {
                const isToday = i === todayIdx;
                return (
                  <View key={day} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <Bar value={count} max={maxDay} color={isToday ? ORANGE : Palette.border} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 10, color: isToday ? ORANGE : Palette.textSecondary }}>{day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          </MotiView>

          <MotiView style={isDesktop ? { flex: 1 } : undefined} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, ...S1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK, marginBottom: 14 }}>earnings by day of week</Text>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 68 }}>
              {revenueBars.map(({ day, revenue }, i) => {
                const isToday = i === todayIdx;
                const label = revenue > 0 ? (revenue >= 1000 ? `$${(revenue / 1000).toFixed(1)}k` : `$${Math.round(revenue)}`) : '';
                return (
                  <View key={day} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <Bar value={revenue} max={maxRevenue} color={isToday ? Palette.success : Palette.success + '60'} />
                    {revenue > 0 ? <Text style={{ fontFamily: Font.medium, fontSize: 8, color: Palette.success, marginTop: -2 }} numberOfLines={1}>{label}</Text> : null}
                    <Text style={{ fontFamily: Font.medium, fontSize: 10, color: isToday ? ORANGE : Palette.textSecondary }}>{day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          </MotiView>
          </View>

          {/* Weekly revenue bar chart */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 90 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, ...S1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 16, color: INK, letterSpacing: -0.3, marginBottom: 12 }}>revenue by week</Text>
            <RevenueBarChart data={weeklyRevenue} />
          </View>
          </MotiView>

          {/* Orders by time slot */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, ...S1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK, marginBottom: 14 }}>preorders by rush window</Text>
            <View style={{ gap: 8 }}>
              {slotBars.map(({ slot, count }) => {
                const pct = maxSlot > 0 ? (count / maxSlot) * 100 : 0;
                const isTop = count === maxSlot && count > 0;
                return (
                  <View key={slot} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 12, color: isTop ? ORANGE : Palette.textSecondary, width: 76 }}>{slot}</Text>
                      <View style={{ flex: 1, height: 8, backgroundColor: Palette.border, borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ width: `${pct}%`, height: 8, backgroundColor: isTop ? ORANGE : Palette.textSecondary, borderRadius: 4 }} />
                      </View>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isTop ? ORANGE : Palette.textSecondary, width: 24, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{count}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
          </MotiView>

          {/* Top meals + top customers — side by side on desktop */}
          <View style={isDesktop ? { flexDirection: 'row', gap: 14, alignItems: 'flex-start' } : undefined}>
          <MotiView style={isDesktop ? { flex: 1 } : undefined} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, gap: 12, ...S1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Package size={15} color={Palette.amber} />
              <Text style={{ fontFamily: Font.display, fontSize: 16, color: INK, letterSpacing: -0.3 }}>top meals</Text>
            </View>
            <TopMealsList meals={topMeals} />
          </View>
          </MotiView>

          {topCustomers.length > 0 ? (
            <MotiView style={isDesktop ? { flex: 1 } : undefined} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 160 }}>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, gap: 12, ...S1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Users size={15} color={Palette.success} />
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>top customers</Text>
              </View>
              {topCustomers.map(({ name, orders, spend }, i) => (
                <View key={name || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: Palette.success + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 10, color: Palette.success }}>#{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: Font.semibold, fontSize: 13.5, color: INK }} numberOfLines={1}>{name}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{orders} order{orders === 1 ? '' : 's'}</Text>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Palette.success, fontVariant: ['tabular-nums'], minWidth: 52, textAlign: 'right' }}>${spend.toFixed(0)}</Text>
                </View>
              ))}
            </View>
            </MotiView>
          ) : null}
          </View>

          {/* AI Insights */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 180 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginBottom: 10 }}>smart insights</Text>
          <View style={{ gap: 10 }}>
            {insights.map(({ icon: Icon, color, text }, i) => (
              <MotiView key={i} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: 200 + i * 40 }}>
              <View style={{ backgroundColor: Palette.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Icon size={15} color={color} />
                </View>
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: INK, lineHeight: 19 }}>{text}</Text>
              </View>
              </MotiView>
            ))}
          </View>
          </MotiView>

          {/* CTA to earnings */}
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 400 }}>
          <PressableScale onPress={() => { feedback.tap(); router.push('/earnings'); }} accessibilityRole="button" accessibilityLabel="View detailed earnings"
            style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: ORANGE + '30' }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Lightbulb size={20} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>detailed earnings</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2 }}>Full payout history, transaction breakdown, and net earnings</Text>
            </View>
            <ChevronRight size={16} color={Palette.textSecondary} />
          </PressableScale>
          </MotiView>

          </View>
        </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
