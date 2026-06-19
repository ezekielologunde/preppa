import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, RefreshControl, ScrollView,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChefHat, ChevronLeft, Clock, ShieldX, X } from 'lucide-react-native';

import { Ring } from '@/components/dashboard-widgets';
import { PrepperBadgeShelf } from '@/components/badge-shelf';
import { ProfileHealthCard } from '@/components/profile-health-card';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardFloatingBar } from '@/components/dashboard/dashboard-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyEarnings } from '@/lib/queries/earnings';
import { usePrepperMembership } from '@/lib/queries/memberships';
import { useAdvanceOrder, usePrepperOrders } from '@/lib/queries/orders';
import {
  useMyPrepperApplication, usePrepperBadges, usePrepperProfile, useToggleAvailability,
} from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';
import type { OrderStatus } from '@/types/database.types';

const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; cta: string; bg: string }>> = {
  pending:    { next: 'confirmed',  cta: 'Confirm Order', bg: Palette.brand },
  confirmed:  { next: 'preparing', cta: 'Start Prepping', bg: Palette.brand },
  preparing:  { next: 'ready',     cta: 'Mark Ready',    bg: Palette.success },
  ready:      { next: 'completed', cta: 'Complete',       bg: Palette.success },
};
const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
  pending:   Palette.amber,
  confirmed: Palette.brand,
  preparing: Palette.brand,
  ready:     Palette.success,
};
const money = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

export default function DashboardScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: prepper, isLoading: appLoading, refetch: refetchPrepper } = useMyPrepperApplication(user?.id);
  const { data: prepperProfile }              = usePrepperProfile(prepper?.id);
  const { data: prepperMembership, refetch: refetchMembership } = usePrepperMembership(prepper?.id);
  const isPro = prepperMembership?.isPro === true;
  const { data: prepperBadges, refetch: refetchBadges } = usePrepperBadges(prepper?.id);
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = usePrepperOrders(prepper?.id);
  const { data: earnings, isLoading: earningsLoading } = useMyEarnings();

  const advanceOrder      = useAdvanceOrder();
  const toggleAvailability = useToggleAvailability(prepper?.id);

  const [confirmToggle, setConfirmToggle] = useState(false);
  const [accepting, setAccepting]         = useState<boolean | null>(null);
  const [refreshing, setRefreshing]       = useState(false);
  const [search, setSearch]               = useState('');

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchPrepper(), refetchMembership(), refetchBadges(), refetchOrders()]);
    setRefreshing(false);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (appLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Palette.brand} />
      </View>
    );
  }

  // ── Application status guard ──────────────────────────────────────────────
  if (!prepper || prepper.status !== 'approved') {
    const cfg =
      prepper?.status === 'pending'
        ? { Icon: Clock,    tint: Palette.amber,         title: 'Application under review', body: "Our team is reviewing your kitchen. We'll notify you once you're approved — usually within 48 hours." }
        : prepper?.status === 'rejected'
          ? { Icon: ShieldX, tint: Palette.danger,        title: 'Application not approved',  body: prepper.rejection_note ?? 'Your application was not approved. Contact support to learn more or submit a new application.' }
          : prepper?.status === 'suspended'
            ? { Icon: ShieldX, tint: Palette.textSecondary, title: 'Kitchen paused',            body: 'Your prepper account is currently paused. Contact support to reactivate.' }
            : { Icon: ChefHat, tint: Palette.brand,         title: 'Become a Prepper',           body: "You haven't applied yet. Submit an application to start earning with your cooking." };
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
            <PressableScale onPress={() => { feedback.tap(); router.canGoBack() ? router.back() : router.replace('/profile'); }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>
              <ChevronLeft size={22} color={Palette.ink} />
            </PressableScale>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <MotiView from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 200 }}>
              <View style={{ width: 82, height: 82, borderRadius: 28, backgroundColor: cfg.tint + '1F', alignItems: 'center', justifyContent: 'center' }}>
                <cfg.Icon size={36} color={cfg.tint} />
              </View>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, textAlign: 'center', letterSpacing: -0.6 }}>{cfg.title}</Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 320 }}>{cfg.body}</Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
              <PressableScale onPress={() => { feedback.tap(); router.replace('/become-prepper'); }} accessibilityRole="button" accessibilityLabel="View application status" style={{ marginTop: 8, paddingHorizontal: 28, height: 52, borderRadius: Radius.pill, backgroundColor: cfg.tint, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{prepper ? 'view application status' : 'apply now'}</Text>
              </PressableScale>
            </MotiView>
          </View>
        </SafeAreaView>
      </View>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const isOpen = accepting !== null ? accepting : ((prepper as unknown as { accepting_orders?: boolean })?.accepting_orders !== false);
  const list   = orders ?? [];
  const today  = new Date().toDateString();
  const todayOrders = list.filter(o => new Date(o.created_at).toDateString() === today);
  const active  = list.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
  const newCount = list.filter(o => o.status === 'pending').length;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekDays = Array<boolean>(7).fill(false);
  list.filter(o => o.status === 'completed' && new Date(o.created_at) >= weekStart)
    .forEach(o => { weekDays[(new Date(o.created_at).getDay() + 6) % 7] = true; });

  const goalPct  = Math.min(1, (earnings?.net_week ?? 0) / 150);
  const goalPct100 = Math.round(goalPct * 100);

  const searched = search.trim()
    ? list.filter(o => o.id.includes(search) || o.status.includes(search.toLowerCase()))
    : [];

  const headerProps = {
    displayName: prepper?.display_name ?? (user?.user_metadata?.full_name as string | undefined),
    avatarUrl: user?.user_metadata?.avatar_url as string | undefined,
    newCount, isOpen, isHomeCookAvailable: false, router,
    onToggleOpen: () => { feedback.tap(); setConfirmToggle(true); },
    onToggleHomeCook: () => {},
  };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* Toggle Confirmation Modal */}
        <Modal visible={confirmToggle} transparent animationType="fade" onRequestClose={() => setConfirmToggle(false)}>
          <View style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <MotiView from={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20 }} style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 24, width: '100%', maxWidth: 360, gap: 12 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 18, color: Palette.ink, textAlign: 'center' }}>
                {isOpen ? 'Pause your kitchen?' : 'Reopen your kitchen?'}
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                {isOpen ? "Customers won't be able to order until you reopen." : "You'll appear on the Explore feed."}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity onPress={() => { feedback.tap(); setConfirmToggle(false); }} style={{ flex: 1, height: 48, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Palette.divider, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  const nxt = !isOpen;
                  setAccepting(nxt);
                  setConfirmToggle(false);
                  feedback.tap();
                  toggleAvailability.mutate({ accepting_orders: nxt } as never, {
                    onSuccess: () => feedback.success(),
                    onError: () => { feedback.error(); setAccepting(!nxt); },
                  });
                }} style={{ flex: 1, height: 48, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          </View>
        </Modal>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
          contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 20 : 14, paddingBottom: Math.max(insets.bottom, 16) + 140 }}
        >
          <DashboardHeader size="mobile" {...headerProps} />

          {/* ── S1: Kitchen Status Banner ────────────────────────────────── */}
          <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <TouchableOpacity onPress={() => { feedback.tap(); setConfirmToggle(true); }} activeOpacity={0.85}
              style={{ marginHorizontal: 16, marginBottom: 14, borderRadius: Radius.sm, backgroundColor: isOpen ? '#22c55e' : Palette.divider, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MotiView animate={{ scale: isOpen ? [1, 1.5, 1] : 1 }} transition={{ type: 'timing', duration: 1000, loop: isOpen }}
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isOpen ? '#fff' : Palette.textMuted }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: isOpen ? '#fff' : Palette.textSecondary }}>
                  {isOpen ? 'Kitchen Open · Accepting Orders' : 'Your kitchen is hidden from Explore'}
                </Text>
                {!isOpen && (
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 2 }}>Tap to reopen</Text>
                )}
              </View>
            </TouchableOpacity>
          </MotiView>

          {/* ── S2: The Big Three ─────────────────────────────────────────── */}
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, paddingHorizontal: 20, marginBottom: 8, letterSpacing: -0.3 }}>overview</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}>

            {/* Card A — Financial Engine */}
            <View style={{ width: 200, height: 130, borderRadius: 12, backgroundColor: Palette.surface, padding: 14, justifyContent: 'space-between', ...Shadow.card }}>
              {earningsLoading ? (
                <View style={{ gap: 8 }}>
                  <Skeleton width="60%" height={28} radius={6} />
                  <Skeleton width="80%" height={14} radius={4} />
                </View>
              ) : (
                <>
                  <View>
                    <Text style={{ fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.5 }}>{money(earnings?.net_total ?? 0)}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>This week: {money(earnings?.net_week ?? 0)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { feedback.tap(); router.push('/prepper-payouts' as never); }}
                    style={{ height: 48, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Request Payout →</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Card B — Daily Goal Ring */}
            <View style={{ width: 200, height: 130, borderRadius: 12, backgroundColor: Palette.surface, padding: 14, justifyContent: 'space-between', ...Shadow.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ position: 'relative', width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
                  <Ring pct={goalPct100} color={Palette.brand} size={60} stroke={6} />
                  <View style={{ position: 'absolute' }}>
                    <Text style={{ fontFamily: Font.display, fontSize: 12, color: Palette.ink }}>{goalPct100}%</Text>
                  </View>
                </View>
                <View>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary }}>Weekly</Text>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.ink }}>{money(earnings?.net_week ?? 0)} / $150</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <View key={i} style={{ flex: 1, height: 20, borderRadius: 4, backgroundColor: weekDays[i] ? Palette.brand + '33' : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: weekDays[i] ? Palette.brand : Palette.textMuted }}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Card C — Fulfillment Queue */}
            <View style={{ width: 200, height: 130, borderRadius: 12, backgroundColor: Palette.surface, padding: 14, justifyContent: 'space-between', ...Shadow.card }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{todayOrders.length} Orders today</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{todayOrders.filter(o => o.status === 'preparing').length} Preparing · {todayOrders.filter(o => o.status === 'ready').length} Ready</Text>
              </View>
              <TouchableOpacity onPress={() => { feedback.tap(); router.push('/prepper-orders' as never); }}
                style={{ height: 48, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>View Queue →</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* ── S3: Needs Action ─────────────────────────────────────────── */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 120 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 10, gap: 8 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3 }}>needs action</Text>
              {active.length > 0 && (
                <View style={{ backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff' }}>{active.length}</Text>
                </View>
              )}
            </View>

            {active.length === 0 ? (
              <View style={{ marginHorizontal: 16, backgroundColor: Palette.surface, borderRadius: Radius.sm, padding: 20, alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>You're all caught up 🎉</Text>
                <TouchableOpacity onPress={() => { feedback.tap(); router.push('/prepper-orders' as never); }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>View History</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16, gap: 10 }}>
                {active.slice(0, 3).map(order => {
                  const parts = (order.customer ?? '').trim().split(/\s+/);
                  const masked = parts.length > 1 ? `${parts[0][0]}.${parts[parts.length - 1][0]}.` : parts[0]?.[0] + '.';
                  const step = NEXT_STATUS[order.status];
                  const pillColor = STATUS_COLOR[order.status] ?? Palette.textMuted;
                  return (
                    <View key={order.id} style={{ backgroundColor: Palette.surface, borderRadius: Radius.sm, padding: 14, gap: 10, ...Shadow.card }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }}>{masked}</Text>
                          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{order.items?.length ?? 0} items · {money(order.total)}</Text>
                        </View>
                        <View style={{ backgroundColor: pillColor + '22', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: pillColor }}>{order.status}</Text>
                        </View>
                      </View>
                      {step && (
                        <TouchableOpacity onPress={() => { feedback.tap(); advanceOrder.mutate({ orderId: order.id, next: step.next }); }}
                          disabled={advanceOrder.isPending}
                          style={{ height: 56, borderRadius: Radius.sm, backgroundColor: step.bg, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>{step.cta}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                {active.length > 3 && (
                  <TouchableOpacity onPress={() => { feedback.tap(); router.push('/prepper-orders' as never); }} style={{ alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>See all {active.length} orders →</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </MotiView>

          {/* ── S4: Hub Search ───────────────────────────────────────────── */}
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 280, delay: 180 }}>
            <View style={{ marginHorizontal: 16, marginTop: 20, marginBottom: 4, flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14, gap: 8 }}>
              <TextInput
                value={search} onChangeText={setSearch}
                placeholder="Search orders, meals, customers..."
                placeholderTextColor={Palette.textMuted}
                style={{ flex: 1, height: 48, fontFamily: Font.body, fontSize: 14, color: Palette.ink }}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={Palette.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {searched.length > 0 && (
              <View style={{ marginHorizontal: 16, backgroundColor: Palette.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' }}>
                {searched.slice(0, 5).map((o, i) => (
                  <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.border }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.ink }}>#{o.id.slice(-6)}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: STATUS_COLOR[o.status] ?? Palette.textMuted }}>{o.status}</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.ink }}>{money(o.total)}</Text>
                  </View>
                ))}
              </View>
            )}
          </MotiView>

          {/* ── S5: Boost & Pro Strip ────────────────────────────────────── */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 220 }}>
            {!isPro && (
              <View style={{ marginHorizontal: 16, marginTop: 20, borderRadius: Radius.sm, backgroundColor: Palette.brand, padding: 18, gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Go Pro — unlock premium tools</Text>
                {['Priority placement in Explore', 'Advanced analytics dashboard', 'Lower platform fees'].map(b => (
                  <Text key={b} style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>· {b}</Text>
                ))}
                <TouchableOpacity onPress={() => { feedback.tap(); router.push('/prepper-premium' as never); }}
                  style={{ marginTop: 4, height: 48, borderRadius: Radius.pill, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.brand }}>Upgrade →</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ marginHorizontal: 16, marginTop: isPro ? 20 : 12, backgroundColor: Palette.surface, borderRadius: Radius.sm, padding: 16, gap: 12, ...Shadow.card }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>Boost Your Kitchen</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[{ label: '$5 / 24h', price: 500, dur: '24 hours' }, { label: '$12 / 3d', price: 1200, dur: '3 days' }, { label: '$25 / 1w', price: 2500, dur: '1 week' }].map(chip => (
                  <View key={chip.label} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: Palette.brandTint, alignItems: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brand }}>{chip.label}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={() => { feedback.tap(); router.push('/boost' as never); }}
                style={{ height: 48, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Boost Now →</Text>
              </TouchableOpacity>
            </View>
          </MotiView>

          {/* ── S6: Performance ──────────────────────────────────────────── */}
          {prepperBadges && prepperBadges.length > 0 && (
            <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 8 }}>
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
          isPro={isPro} isDesktop={false} newCount={newCount}
          bottomInset={insets.bottom} router={router}
          onGoLive={() => router.push('/go-live')}
        />
      </SafeAreaView>
    </View>
  );
}
