import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  Bell,
  Boxes,
  Briefcase,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Check,
  Crown,
  Gift,
  Home,
  MessageSquare,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Star,
  TrendingUp,
  User,
  Users,
  UtensilsCrossed,
  Video,
  type LucideIcon,
} from 'lucide-react-native';
import { Platform, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ring, Sparkline, StatCard } from '@/components/dashboard-widgets';
import { PrepperBadgeShelf } from '@/components/badge-shelf';
import { ProfileHealthCard } from '@/components/profile-health-card';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { greeting } from '@/lib/greeting';
import { useBreakpoint } from '@/lib/layout';
import { usePrepperMembership } from '@/lib/queries/memberships';
import { useAdvanceOrder, usePrepperOrders, type OrderSummary } from '@/lib/queries/orders';
import { useMyPrepperApplication, usePrepperBadges, usePrepperProfile, useToggleAvailability, useToggleHomeCookAvailability } from '@/lib/queries/preppers';
import { usePrepperReviews } from '@/lib/queries/reviews';
import { useAuth } from '@/providers/auth-provider';
import type { FulfillmentType, OrderStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const PURPLE = '#a78bfa';
const YELLOW = Palette.amber;
const PINK = '#f472b6';
const CARD = Palette.surface;
const BG = Palette.canvas;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);

const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  pickup: 'pickup', delivery: 'delivery', meetup: 'meetup', home_cook: 'home cook',
};
const FULFILLMENT_COLOR: Record<FulfillmentType, string> = {
  pickup: '#f59e0b', delivery: '#06b6d4', meetup: '#a78bfa', home_cook: '#22c55e',
};

const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending: { next: 'confirmed', cta: 'confirm preorder' },
  confirmed: { next: 'preparing', cta: 'start prepping' },
  preparing: { next: 'ready', cta: 'mark ready' },
  ready: { next: 'completed', cta: 'mark complete' },
  out_for_delivery: { next: 'completed', cta: 'mark complete' },
};

function buildDailySpark(orders: OrderSummary[], n: number, getValue: (grp: OrderSummary[]) => number): number[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const start = now.getTime() - (n - 1 - i) * 86400000;
    const end = start + 86400000;
    return getValue(orders.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= start && t < end; }));
  });
}

export default function DashboardScreen() {
  const router = useRouter();
  const desktop = useBreakpoint() === 'desktop';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: prepper, refetch: refetchPrepper } = useMyPrepperApplication(user?.id);
  const { data: prepperProfile } = usePrepperProfile(prepper?.id);
  const { data: prepperMembership, refetch: refetchMembership } = usePrepperMembership(prepper?.id);
  const isPro = prepperMembership?.isPro === true;
  const { data: prepperBadges, refetch: refetchBadges } = usePrepperBadges(prepper?.id);
  const { data: orders, refetch: refetchOrders } = usePrepperOrders(prepper?.id);
  const { data: reviews, refetch: refetchReviews } = usePrepperReviews(prepper?.id);
  const advance = useAdvanceOrder();
  const toggleAvailability = useToggleAvailability(prepper?.id);
  const toggleHomeCook = useToggleHomeCookAvailability(prepper?.id);
  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [homeCook, setHomeCook] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [advanceErr, setAdvanceErr] = useState<string | null>(null);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetchPrepper(), refetchMembership(), refetchBadges(), refetchOrders(), refetchReviews()]); setRefreshing(false); }
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

  const isOpen = accepting !== null ? accepting : ((prepper as unknown as { accepting_orders?: boolean })?.accepting_orders !== false);
  const isHomeCookAvailable = homeCook !== null ? homeCook : (prepperProfile?.homeCookAvailable ?? false);

  const list: OrderSummary[] = orders ?? [];
  const newCount = list.filter((o) => o.status === 'pending').length;
  const revenue = list.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0);
  const subscribers = new Set(list.map((o) => o.customerId)).size;
  const reviewCount = reviews?.length ?? 0;
  const avgRating = reviewCount ? reviews!.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;

  const revenueSpark = buildDailySpark(list, 8, (g) => g.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0));
  const ordersSpark = buildDailySpark(list, 8, (g) => g.length);
  const customersSpark = buildDailySpark(list, 8, (g) => new Set(g.map((o) => o.customerId)).size);
  const ratingSpark = reviews && reviews.length >= 2 ? reviews.slice(-8).map((r) => r.rating) : [0];

  // Oldest still-active order = the one to act on next.
  const active = list.filter((o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing' || o.status === 'ready');
  const next = active.length ? active[active.length - 1] : null;
  const step = next ? NEXT[next.status] : undefined;

  // Start of current ISO week (Monday 00:00:00).
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekCount = list.filter((o) => new Date(o.created_at) >= weekStart).length;

  // Today's revenue (start of calendar day).
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRevenue = list
    .filter((o) => o.status === 'completed' && new Date(o.created_at) >= todayStart)
    .reduce((s, o) => s + o.total, 0);

  // Daily goal: 25% above 8-day avg revenue, rounded to nearest $50, min $50.
  const avgDaily = revenueSpark.reduce((s, v) => s + v, 0) / (revenueSpark.length || 1);
  const dailyGoal = Math.max(50, Math.ceil((avgDaily * 1.25) / 50) * 50);
  const goalPct = Math.min(Math.round((todayRevenue / dailyGoal) * 100), 100);

  // Which days of the current ISO week have at least one completed order (Mon=0, Sun=6).
  const weekDays = new Array<boolean>(7).fill(false);
  list
    .filter((o) => o.status === 'completed' && new Date(o.created_at) >= weekStart)
    .forEach((o) => {
      const dayIdx = (new Date(o.created_at).getDay() + 6) % 7;
      weekDays[dayIdx] = true;
    });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 20 : 14, paddingBottom: Math.max(insets.bottom, 16) + 140 }}>
          {/* Header */}
          <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
            <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }} accessibilityRole="button" accessibilityLabel="Back to customer view" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
            <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Avatar
                name={prepper?.display_name ?? (user?.user_metadata?.full_name as string | undefined) ?? 'chef'}
                url={user?.user_metadata?.avatar_url as string | undefined}
                size={42}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>{greeting()}, chef</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.6 }}>my kitchen</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <MotiView
                  animate={{ backgroundColor: isOpen ? GREEN + '22' : Palette.chip }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={{ borderRadius: Radius.pill, overflow: 'hidden' }}>
                  <PressableScale
                    onPress={() => {
                      feedback.tap();
                      const next = !isOpen;
                      setAccepting(next);
                      toggleAvailability.mutate(next, { onError: () => { feedback.error(); setAccepting(!next); } });
                    }}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: isOpen }}
                    accessibilityLabel={isOpen ? 'Kitchen is open — tap to close' : 'Kitchen is closed — tap to open'}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <MotiView
                      animate={{ backgroundColor: isOpen ? GREEN : MUTED }}
                      transition={{ type: 'timing', duration: 200 }}
                      style={{ width: 8, height: 8, borderRadius: 4 }} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isOpen ? GREEN : Palette.textSecondary }}>{isOpen ? 'Open' : 'Closed'}</Text>
                  </PressableScale>
                </MotiView>
                <MotiView
                  animate={{ backgroundColor: isHomeCookAvailable ? '#EDE9FE' : Palette.chip }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={{ borderRadius: Radius.pill, overflow: 'hidden' }}>
                  <PressableScale
                    onPress={() => {
                      feedback.tap();
                      const next = !isHomeCookAvailable;
                      setHomeCook(next);
                      toggleHomeCook.mutate(next, { onError: () => { feedback.error(); setHomeCook(!next); } });
                    }}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: isHomeCookAvailable }}
                    accessibilityLabel={isHomeCookAvailable ? 'Home cooking on — tap to disable' : 'Home cooking off — tap to enable'}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <ChefHat size={11} color={isHomeCookAvailable ? '#5B21B6' : Palette.textSecondary} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isHomeCookAvailable ? '#5B21B6' : Palette.textSecondary }}>Home cook</Text>
                  </PressableScale>
                </MotiView>
              </View>
            </View>
            <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }} accessibilityRole="button" accessibilityLabel="Search" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <Search size={19} color={INK} />
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel="New orders" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <Bell size={19} color={INK} />
              {newCount > 0 ? (
                <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>{newCount}</Text>
                </View>
              ) : null}
            </PressableScale>
          </View>
          </MotiView>

          {/* Next order — most urgent operational info, shown first */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 80 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 16, marginBottom: 10 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3 }}>next preorder</Text>
            {next ? (
              <View style={{ backgroundColor: ORANGE + '26', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: ORANGE }}>{next.status === 'pending' ? 'new' : next.status}</Text>
              </View>
            ) : null}
          </View>
          {next ? (
            <View style={{ marginHorizontal: 20, backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {next.items[0]?.image ? (
                  <Image source={next.items[0].image} style={{ width: 76, height: 76, borderRadius: 18 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                    <UtensilsCrossed size={26} color={MUTED} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }} numberOfLines={1}>{next.customer}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }} numberOfLines={1}>
                    {next.items[0]?.title ?? 'preorder'}{next.items.length > 1 ? ` +${next.items.length - 1}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: next.paymentStatus === 'succeeded' ? GREEN + '24' : Palette.chip, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
                      {next.paymentStatus === 'succeeded' ? <Check size={11} color={GREEN} strokeWidth={2.5} /> : null}
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: next.paymentStatus === 'succeeded' ? GREEN : MUTED }}>{next.paymentStatus === 'succeeded' ? 'paid' : 'unpaid'}</Text>
                    </View>
                    <View style={{ backgroundColor: FULFILLMENT_COLOR[next.fulfillment] + '22', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: FULFILLMENT_COLOR[next.fulfillment] }}>{FULFILLMENT_LABEL[next.fulfillment]}</Text>
                    </View>
                    <Text style={{ fontFamily: Font.display, fontSize: 16, color: INK, fontVariant: ['tabular-nums'] }}>${next.total.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
              {step ? (
                <>
                  <PressableScale
                    onPress={() => { feedback.tap(); setAdvanceErr(null); advance.mutate({ orderId: next.id, next: step.next }, { onError: () => { feedback.error(); setAdvanceErr('Could not update order status. Please try again.'); } }); }}
                    disabled={advance.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={step.cta}
                    style={{ height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: advance.isPending ? 0.7 : 1 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{step.cta}</Text>
                  </PressableScale>
                  {advanceErr ? (
                    <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.danger, textAlign: 'center' }}>{advanceErr}</Text>
                  ) : null}
                </>
              ) : null}
              {active.length > 1 ? (
                <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel={`See all ${active.length} active orders`}
                  style={{ alignItems: 'center', paddingVertical: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>+{active.length - 1} more in queue — see all →</Text>
                </PressableScale>
              ) : null}
            </View>
          ) : (
            <View style={{ marginHorizontal: 20, backgroundColor: CARD, borderRadius: 22, padding: 24, alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={26} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center' }}>No active preorders right now. New preorders land here instantly.</Text>
            </View>
          )}
          </MotiView>

          {/* Stat cards — KPI row on desktop, 2x2 grid on mobile */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 140 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, paddingHorizontal: 20, marginTop: 16, marginBottom: 8, letterSpacing: -0.3 }}>your stats</Text>
          {desktop ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, gap: 10 }}>
              <StatCard Icon={ShoppingBag} value={money(revenue)} label="total sales" trend={revenue > 0 ? 'earned' : '—'} color={ORANGE} spark={revenueSpark} onPress={() => router.push('/earnings')} />
              <StatCard Icon={Boxes} value={String(list.length)} label="preorders" trend={`${newCount} new`} color={GREEN} spark={ordersSpark} onPress={() => router.push('/prepper-orders')} />
              <StatCard Icon={Users} value={String(subscribers)} label="customers" trend="unique" color={PURPLE} spark={customersSpark} onPress={() => router.push('/customers')} />
              <StatCard Icon={Star} value={avgRating ? avgRating.toFixed(1) : '—'} label="rating" trend={`${reviewCount} reviews`} color={YELLOW} spark={ratingSpark} onPress={() => router.push('/prepper-analytics')} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, paddingTop: 8, paddingBottom: 6 }}>
              <StatCard Icon={ShoppingBag} value={money(revenue)} label="total sales" trend={revenue > 0 ? 'earned' : '—'} color={ORANGE} spark={revenueSpark} onPress={() => router.push('/earnings')} flex />
              <StatCard Icon={Boxes} value={String(list.length)} label="orders" trend={`${newCount} new`} color={GREEN} spark={ordersSpark} onPress={() => router.push('/prepper-orders')} flex />
              <StatCard Icon={Users} value={String(subscribers)} label="customers" trend="unique" color={PURPLE} spark={customersSpark} onPress={() => router.push('/customers')} flex />
              <StatCard Icon={Star} value={avgRating ? avgRating.toFixed(1) : '—'} label="rating" trend={`${reviewCount} reviews`} color={YELLOW} spark={ratingSpark} onPress={() => router.push('/prepper-analytics')} flex />
            </View>
          )}
          </MotiView>

          {/* Goal + this week */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 180 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, paddingHorizontal: 20, marginTop: 16, marginBottom: 6, letterSpacing: -0.3 }}>today's progress</Text>
          <View style={{ marginHorizontal: 20, marginBottom: 8, backgroundColor: CARD, borderRadius: 20, padding: 16, gap: 14 }}>
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
          </MotiView>

          {/* Badges earned */}
          {prepperBadges && prepperBadges.length > 0 ? (
            <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 8 }}>
              <PrepperBadgeShelf badges={prepperBadges} />
            </View>
          ) : null}

          {/* Pro upgrade nudge — shown only on free tier */}
          {!isPro ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 220 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-premium'); }} accessibilityRole="button" accessibilityLabel="Upgrade to Prepper Pro"
                style={{ marginHorizontal: 20, marginBottom: 10, backgroundColor: CARD, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: ORANGE + '28' }}>
                <Crown size={15} color={ORANGE} />
                <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13, color: MUTED }}>Go Pro — boosts, livestream & AI tools · $29/mo</Text>
                <ChevronRight size={14} color={ORANGE} />
              </PressableScale>
            </MotiView>
          ) : null}

          {/* Share kitchen link */}
          {prepper?.id ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 230 }}>
              <PressableScale onPress={() => { void shareKitchen(); }} accessibilityRole="button" accessibilityLabel="Share your kitchen"
                style={{ marginHorizontal: 20, marginBottom: 10, backgroundColor: CARD, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: ORANGE + '28' }}>
                <Share2 size={15} color={ORANGE} />
                <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13, color: MUTED }}>Share your kitchen with friends & followers</Text>
                <ChevronRight size={14} color={ORANGE} />
              </PressableScale>
            </MotiView>
          ) : null}

          {/* Profile health score */}
          {prepperProfile ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 260 }}>
              <ProfileHealthCard profile={prepperProfile} />
            </MotiView>
          ) : null}

        </ScrollView>

        {/* Floating action bar (add meal · go live · + · new drop · opportunity) */}
        <MotiView
          from={{ translateY: 80, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 220, delay: 300 }}
          style={[{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 16) + (desktop ? 0 : 56), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD, borderRadius: 26, paddingVertical: 12, paddingHorizontal: 18, ...Shadow.floating }, desktop && { left: undefined, right: undefined, alignSelf: 'center', width: 520 }]}>
          <ActionItem Icon={TrendingUp} label="earnings" color={Palette.inkSoft} onPress={() => router.push('/earnings')} />
          {isPro
            ? <ActionItem Icon={Video} label="go live" color={PINK} onPress={() => router.push('/post-video')} />
            : <ActionItem Icon={Crown} label="go pro" color={ORANGE} onPress={() => router.push('/prepper-premium')} />}
          <PressableScale accessibilityRole="button" accessibilityLabel="Add new meal" onPress={() => { feedback.tap(); router.push('/meal-editor'); }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: -26, backgroundColor: ORANGE, ...Shadow.floating, shadowColor: ORANGE, shadowOpacity: 0.45 }}>
              <Plus size={28} color="#fff" />
            </View>
          </PressableScale>
          <ActionItem Icon={Gift} label="new drop" color={PURPLE} onPress={() => router.push('/meal-editor?drop=1')} />
          <ActionItem Icon={Briefcase} label="opportunity" color={ORANGE} onPress={() => router.push('/opportunities')} />
        </MotiView>

        {/* Prepper tab nav (dark) — hidden on desktop; sidebar handles nav there */}
        {!desktop && (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: Palette.surface, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), borderTopLeftRadius: 24, borderTopRightRadius: 24, ...Shadow.navBar }}>
            <NavTab Icon={Home} label="home" onPress={() => router.push('/')} />
            <NavTab Icon={ShoppingBag} label="preorders" badge={newCount || undefined} onPress={() => router.push('/prepper-orders')} />
            <NavTab Icon={ChefHat} label="kitchen" active />
            <NavTab Icon={MessageSquare} label="messages" onPress={() => router.push('/messages')} />
            <NavTab Icon={User} label="profile" onPress={() => router.push('/profile')} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function ActionItem({ Icon, label, color, onPress }: { Icon: LucideIcon; label: string; color: string; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress ? () => { feedback.tap(); onPress(); } : undefined} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 5, width: 58 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: color === Palette.inkSoft ? Palette.border : color + '66', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} />
      </View>
      <Text style={{ fontFamily: Font.medium, fontSize: 10, color: Palette.textMuted }} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

function NavTab({ Icon, label, active, badge, onPress }: { Icon: LucideIcon; label: string; active?: boolean; badge?: number; onPress?: () => void }) {
  const color = active ? ORANGE : Palette.textSecondary;
  return (
    <PressableScale onPress={onPress ? () => { feedback.tap(); onPress(); } : undefined} accessibilityRole="button" accessibilityState={{ selected: !!active }} accessibilityLabel={label} style={{ alignItems: 'center', gap: 3 }}>
      <View>
        <Icon size={22} color={color} strokeWidth={active ? 2.4 : 2} />
        {badge ? (
          <View style={{ position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: '#fff' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontFamily: Font.medium, fontSize: 10, color }}>{label}</Text>
    </PressableScale>
  );
}
