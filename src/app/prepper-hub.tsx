import { useRouter } from 'expo-router';
import { CalendarDays, ChefHat, ChevronLeft, ChevronRight, Clock, Coffee, DollarSign, Flame, MessageSquare, Package, Sparkles, TrendingUp, Utensils, Video, Wallet } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiveSessionBanner } from '@/components/live-session-banner';
import { PrepperEarningsChart } from '@/components/prepper-earnings-chart';
import { PrepperInsightsCard } from '@/components/prepper-insights-card';
import { PrepperTodayPanel } from '@/components/prepper-today-panel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';
import { usePrepperOrders } from '@/lib/queries/orders';
import { useMyPrepperApplication, useToggleAvailability } from '@/lib/queries/preppers';
import { getCurrentRush, getNextRush, getTodayRushSchedule, minsUntilRushEnds } from '@/lib/rush-hour';
import { useAuth } from '@/providers/auth-provider';

// ── Design tokens (light kitchen theme) ──────────────────────────────────────
const ORANGE = Palette.brand;
const INK    = '#1A1714';
const BG     = '#F8F6F3';
const CARD   = '#FFFFFF';
const BORDER = '#EDE9E4';
const MUTED  = '#78716C';
const GREEN  = '#16A34A';
const S1     = { shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 };

const ACTIONS = [
  { label: 'manage preorder queue',     desc: 'Review, confirm and advance active preorders',    Icon: Package,     color: '#06b6d4', route: '/prepper-orders' },
  { label: 'update your menu',          desc: 'Keep listings fresh — remove sold-out items',     Icon: Utensils,    color: '#10b981', route: '/meal-editor' },
  { label: 'view performance analytics',desc: 'Weekly trends, top dishes, and smart insights',  Icon: TrendingUp,  color: '#22c55e', route: '/prepper-analytics' },
  { label: 'view earnings breakdown',   desc: 'Net pay, weekly totals, and recent transactions', Icon: Wallet,      color: '#a78bfa', route: '/prepper-payouts' },
  { label: 'reply to reviews',          desc: 'Responding boosts your ranking score',            Icon: MessageSquare,color: '#8b5cf6', route: '/reviews' },
  { label: 'meal planner',              desc: 'Set which days each meal is available for the week',Icon: CalendarDays,color: Palette.brand, route: '/prepper-meal-planner' },
  { label: 'edit kitchen profile',      desc: 'Update your name, photo, bio and specialties',   Icon: ChefHat,     color: Palette.brand, route: '/prepper-profile-edit' },
  { label: 'bid requests',              desc: 'View and bid on open meal requests from customers',Icon: Sparkles,   color: '#f59e0b', route: '/bid-requests' },
];

const TIPS = [
  'Batch-cook bases (rice, beans, pasta) Sunday night to fulfil Mon–Wed preorders faster.',
  'Add a "daily special" every morning — novelty drives impulse buys.',
  'Respond to customer messages within 30 minutes — faster replies = higher ratings.',
  'Update your profile photo after big catering events — fresh content signals activity.',
  'Offer a bundle deal (meal + dessert) to raise average preorder value by 20–30%.',
  'Set a prep-time buffer of +10 min during rush to protect your on-time rate.',
];

function fmtMins(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export default function PrepperHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application, isLoading: appLoading, refetch: refetchApplication } = useMyPrepperApplication(user?.id);
  const isDesktop = useBreakpoint() === 'desktop';
  const { data: orders, isLoading: ordersLoading, isError: ordersError, refetch: refetchOrders } = usePrepperOrders(application?.id);
  const statsLoading = appLoading || (application?.id != null && ordersLoading);
  const [refreshing, setRefreshing]   = useState(false);
  const [accepting, setAccepting]     = useState<boolean | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const toggleAvailability = useToggleAvailability(application?.id);
  const isOpen = accepting !== null ? accepting : ((application as unknown as { accepting_orders?: boolean })?.accepting_orders !== false);

  async function handleRefresh() {
    setRefreshing(true);
    setAccepting(null);
    await Promise.all([refetchApplication(), refetchOrders()]);
    setRefreshing(false);
  }

  const hour        = new Date().getHours();
  const minute      = new Date().getMinutes();
  const currentRush = getCurrentRush(hour);
  const nextRush    = getNextRush(hour, minute);
  const minsLeft    = currentRush ? minsUntilRushEnds(currentRush, hour, minute) : 0;
  const todayTip    = TIPS[new Date().getDay() % TIPS.length];
  const todayRushes = getTodayRushSchedule(new Date().getDay());

  const completedOrders = (orders ?? []).filter((o) => o.status === 'completed');
  const totalEarnings   = completedOrders.reduce((s, o) => s + o.total, 0);
  const avgOrder        = completedOrders.length ? totalEarnings / completedOrders.length : 0;
  const activeCount     = (orders ?? []).filter((o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).length;
  const sevenDaysAgo    = Date.now() - 7 * 86400000;
  const weekCompleted   = completedOrders.filter((o) => new Date(o.created_at).getTime() >= sevenDaysAgo);
  const weekEarnings    = weekCompleted.reduce((s, o) => s + o.total, 0);
  const repeatRate = (() => {
    const counts: Record<string, number> = {};
    for (const o of (orders ?? [])) { if (o.customerId) counts[o.customerId] = (counts[o.customerId] ?? 0) + 1; }
    const uniq = Object.keys(counts).length;
    return uniq > 0 ? Math.round((Object.values(counts).filter((n) => n > 1).length / uniq) * 100) : null;
  })();

  const hubInsights = [
    {
      label: 'Repeat buyers',
      trend: repeatRate !== null ? `${repeatRate}%` : '—',
      note: repeatRate === null
        ? 'Complete your first preorders to unlock repeat buyer tracking.'
        : repeatRate >= 40 ? 'Outstanding loyalty — add a punch-card subscription to lock them in.'
        : repeatRate >= 20 ? 'Good repeat rate. Faster replies and personalised notes push this higher.'
        : 'Offer a return-customer discount to grow loyalty past 20%.',
    },
    {
      label: 'Avg preorder value',
      trend: avgOrder > 0 ? `$${avgOrder.toFixed(0)}` : '—',
      note: avgOrder === 0 ? 'No completed preorders yet. List your first meal to start earning.'
        : avgOrder < 18 ? 'Add a side dish or drink bundle to push avg value above $20.'
        : avgOrder < 30 ? 'Solid average. A premium weekly special could push it past $30.'
        : 'Strong avg — a loyalty tier for repeat high spenders could lock in revenue.',
    },
    {
      label: 'This week',
      trend: weekCompleted.length > 0 ? `${weekCompleted.length} preorders` : '0 preorders',
      note: weekCompleted.length === 0 ? 'No completed preorders yet this week. Post a daily special to drive demand.'
        : weekCompleted.length < 5 ? 'Aim for 5+ weekly preorders — list a time-limited special today.'
        : 'Great week! Keep your menu stocked and reply to new orders fast.',
    },
    {
      label: 'Photos matter',
      trend: 'Key tip',
      note: 'Listings with 3+ photos get 2× more preorders than text-only ones.',
    },
  ];

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ── Kitchen close confirmation modal ──────────────────────────── */}
      <Modal visible={confirmClose} transparent animationType="fade" onRequestClose={() => setConfirmClose(false)}>
        <Pressable onPress={() => setConfirmClose(false)} accessibilityRole="button" accessibilityLabel="Dismiss"
          style={{ flex: 1, backgroundColor: 'rgba(26,23,20,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <MotiView from={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 22 }}
            style={{ backgroundColor: CARD, borderRadius: 24, padding: 28, width: '100%', maxWidth: 360, gap: 16, shadowColor: '#1A1714', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, textAlign: 'center', letterSpacing: -0.4 }}>Close your kitchen?</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21 }}>
              No new orders will arrive until you reopen. Active orders are unaffected.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <PressableScale onPress={() => { feedback.tap(); setConfirmClose(false); }}
                accessibilityRole="button" accessibilityLabel="Cancel"
                style={{ flex: 1, height: 52, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: MUTED }}>Cancel</Text>
              </PressableScale>
              <PressableScale
                onPress={() => {
                  feedback.tap();
                  setConfirmClose(false);
                  setAccepting(false);
                  toggleAvailability.mutate(false, { onSuccess: () => feedback.success(), onError: () => { feedback.error(); setAccepting(true); } });
                }}
                accessibilityRole="button" accessibilityLabel="Confirm close kitchen"
                style={{ flex: 1, height: 52, borderRadius: Radius.pill, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Close</Text>
              </PressableScale>
            </View>
          </MotiView>
        </Pressable>
      </Modal>

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...S1 }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>kitchen hub</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={[{ padding: 20, gap: 16 }, isDesktop ? { maxWidth: 860, alignSelf: 'center', width: '100%' } : null]}>

            {/* Rush hour status */}
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
              {currentRush ? (
                <View style={{ backgroundColor: ORANGE, borderRadius: Radius.lg, padding: 18, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Flame size={18} color="#fff" />
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff', flex: 1 }}>{currentRush.label} is active</Text>
                    {minsLeft > 0 ? (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>{fmtMins(minsLeft)} left</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.92)', lineHeight: 20 }}>{currentRush.prepperAlert}</Text>
                  <View style={{ marginTop: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: 12 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff', marginBottom: 3 }}>prep tip</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.92)', lineHeight: 18 }}>{currentRush.prepperPrepTip}</Text>
                  </View>
                </View>
              ) : nextRush ? (
                <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, padding: 18, gap: 8, borderWidth: 1, borderColor: ORANGE + '30', ...S1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Clock size={17} color={ORANGE} />
                    <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>next rush: {nextRush.window.label}</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ backgroundColor: ORANGE + '18', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>in ~{fmtMins(nextRush.inMins)}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, lineHeight: 19 }}>{nextRush.window.prepperPrepTip}</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, padding: 18, gap: 6, ...S1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Coffee size={17} color="#8b5cf6" />
                    <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>quiet window — prep for tomorrow</Text>
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, lineHeight: 19 }}>
                    {todayRushes.includes('morning') ? 'Morning rush starts at 7 am.' : 'Lunch rush starts at 11 am.'}{' '}
                    Use downtime to batch-cook, update photos, and reply to reviews.
                  </Text>
                </View>
              )}
            </MotiView>

            {/* Kitchen Open / Closed banner */}
            <MotiView
              animate={{ backgroundColor: isOpen ? GREEN + '12' : Palette.danger + '12', borderColor: isOpen ? GREEN + '50' : Palette.danger + '50' }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
              style={{ borderRadius: Radius.lg, borderWidth: 1.5, overflow: 'hidden' }}>
              <PressableScale
                onPress={() => {
                  feedback.tap();
                  if (isOpen) { setConfirmClose(true); }
                  else { setAccepting(true); toggleAvailability.mutate(true, { onSuccess: () => feedback.success(), onError: () => { feedback.error(); setAccepting(false); } }); }
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: isOpen }}
                accessibilityLabel={isOpen ? 'Kitchen is open for preorders — tap to close' : 'Kitchen is closed — tap to open'}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 }}>
                <MotiView
                  animate={{ backgroundColor: isOpen ? GREEN : Palette.danger }}
                  transition={{ type: 'spring', damping: 20, stiffness: 260 }}
                  style={{ width: 12, height: 12, borderRadius: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: isOpen ? GREEN : Palette.danger }}>
                    {isOpen ? 'Kitchen Open' : 'Kitchen Closed'}
                  </Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {isOpen ? 'Accepting preorders — tap to pause' : 'Not accepting preorders — tap to open'}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: isOpen ? GREEN + '18' : Palette.danger + '18' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isOpen ? GREEN : Palette.danger }}>
                    {isOpen ? 'Open' : 'Closed'}
                  </Text>
                </View>
              </PressableScale>
            </MotiView>

            {/* Active orders alert */}
            {activeCount > 0 ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 40 }}>
                <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel={`${activeCount} active preorders`}
                  style={{ backgroundColor: ORANGE + '12', borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: ORANGE + '35' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: ORANGE + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={17} color={ORANGE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>{activeCount} preorder{activeCount === 1 ? '' : 's'} in queue</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 1 }}>Tap to review and advance</Text>
                  </View>
                  <ChevronRight size={16} color={ORANGE} />
                </PressableScale>
              </MotiView>
            ) : null}

            {ordersError ? (
              <View style={{ backgroundColor: Palette.danger + '12', borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Palette.danger + '35' }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger, flex: 1 }}>couldn't load order stats</Text>
                <PressableScale onPress={() => { feedback.tap(); void refetchOrders(); }} accessibilityRole="button" accessibilityLabel="Retry"
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Palette.danger + '22' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.danger }}>retry</Text>
                </PressableScale>
              </View>
            ) : null}

            {/* Quick stats */}
            {statsLoading ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Skeleton height={96} radius={14} style={{ flex: 1 }} />
                <Skeleton height={96} radius={14} style={{ flex: 1 }} />
                <Skeleton height={96} radius={14} style={{ flex: 1 }} />
              </View>
            ) : (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[
                    { label: 'preorders filled', value: completedOrders.length.toString(), sub: weekCompleted.length > 0 ? `+${weekCompleted.length} this wk` : undefined, Icon: Package,    color: '#06b6d4' },
                    { label: 'gross revenue',    value: `$${totalEarnings.toFixed(0)}`,    sub: weekEarnings > 0 ? `+$${weekEarnings.toFixed(0)} this wk` : undefined,   Icon: DollarSign, color: '#16a34a' },
                    { label: 'avg preorder',     value: avgOrder > 0 ? `$${avgOrder.toFixed(0)}` : '—', sub: undefined,                                                   Icon: TrendingUp,  color: ORANGE },
                  ].map(({ label, value, sub, Icon, color }, i) => (
                    <MotiView key={label} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 100 + i * 50 }} style={{ flex: 1 }}>
                      <View style={{ backgroundColor: CARD, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, ...S1 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={15} color={color} />
                        </View>
                        <Text style={{ fontFamily: Font.display, fontSize: 19, color: INK, fontVariant: ['tabular-nums'] }}>{value}</Text>
                        {sub ? <Text style={{ fontFamily: Font.medium, fontSize: 10, color: Palette.success, textAlign: 'center' }}>{sub}</Text> : null}
                        <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: MUTED, textAlign: 'center' }}>{label}</Text>
                      </View>
                    </MotiView>
                  ))}
                </View>
              </MotiView>
            )}

            {/* Today panel */}
            {application?.id ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
                <PrepperTodayPanel prepperId={application.id} prepperUserId={user?.id} />
              </MotiView>
            ) : null}

            {/* Weekly earnings chart */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 160 }}>
              <PrepperEarningsChart prepperId={application?.id} />
            </MotiView>

            {/* Action items */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 180 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginBottom: 12 }}>action items</Text>
              <View style={isDesktop ? { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } : { gap: 10 }}>
                {ACTIONS.map(({ label, desc, Icon, color, route }, i) => {
                  const badge = route === '/prepper-orders' && activeCount > 0 ? activeCount : 0;
                  return (
                    <MotiView key={label} style={isDesktop ? { flex: 1, minWidth: 280, maxWidth: '48%' } : undefined} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: 180 + i * 40 }}>
                      <PressableScale onPress={() => { feedback.tap(); router.push(route as any); }} accessibilityRole="button" accessibilityLabel={label}
                        style={{ backgroundColor: CARD, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...S1 }}>
                        <View style={{ position: 'relative' }}>
                          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={17} color={color} />
                          </View>
                          {badge > 0 && (
                            <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                              <Text style={{ fontFamily: Font.heading, fontSize: 9, color: '#fff' }}>{badge > 9 ? '9+' : badge}</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{label}</Text>
                          <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 2 }}>{desc}</Text>
                        </View>
                        <ChevronRight size={16} color={MUTED} />
                      </PressableScale>
                    </MotiView>
                  );
                })}
              </View>
            </MotiView>

            {/* Performance insights */}
            {application?.id ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 280 }}>
                <PrepperInsightsCard prepperId={application.id} />
              </MotiView>
            ) : null}

            {/* Market insights */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 300 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginBottom: 12 }}>market insights</Text>
              <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, overflow: 'hidden', ...S1 }}>
                {hubInsights.map(({ label, trend, note }, i) => (
                  <MotiView key={label} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: 320 + i * 40 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: BORDER }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{label}</Text>
                        <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 2 }}>{note}</Text>
                      </View>
                      <View style={{ backgroundColor: ORANGE + '18', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: ORANGE }}>{trend}</Text>
                      </View>
                    </View>
                  </MotiView>
                ))}
              </View>
            </MotiView>

            {/* Create content */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 320 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginBottom: 12 }}>create content</Text>
              <PressableScale onPress={() => { feedback.tap(); router.push('/post-video' as any); }} accessibilityRole="button" accessibilityLabel="Post Video"
                style={{ backgroundColor: CARD, borderRadius: 16, height: 80, alignItems: 'center', justifyContent: 'center', gap: 6, ...S1 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ORANGE + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Video size={16} color={ORANGE} />
                </View>
                <Text style={{ fontFamily: Font.heading, fontSize: 13, color: INK }}>Post Video</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: MUTED }}>share a meal drop</Text>
              </PressableScale>
            </MotiView>

            {/* Live session */}
            {application?.id ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 340 }}>
                <LiveSessionBanner prepperId={application.id} />
              </MotiView>
            ) : null}

            {/* Daily tip */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 360 }}>
              <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, padding: 18, gap: 10, borderWidth: 1, borderColor: ORANGE + '28', ...S1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={14} color="#fff" />
                  </View>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>tip of the day</Text>
                </View>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: MUTED, lineHeight: 21 }}>{todayTip}</Text>
              </View>
            </MotiView>

          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
