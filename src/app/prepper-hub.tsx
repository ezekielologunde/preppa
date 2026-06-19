import { useRouter } from 'expo-router';
import { CalendarDays, ChefHat, ChevronLeft, ChevronRight, Clock, DollarSign, Flame, MessageSquare, Package, Sparkles, Star, TrendingUp, Video, Wallet } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
import { getCurrentRush, getNextRush } from '@/lib/rush-hour';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = '#FFFFFF';
const BG = Palette.prepperBg;
const CARD = Palette.prepperCard;
const MUTED = '#6B7280';
const TEXT2 = '#9CA3AF';

// TODO: Pull from real analytics once prepper analytics API is wired
const WEEKLY_INSIGHTS = [
  // { label: 'Nigerian cuisine', trend: '+34%', note: 'Jollof rice preorders surging this week' },   // static marketing copy — remove once real data available
  // { label: 'Lunch slot preorders', trend: '+18%', note: 'Best time to list new items is 10–11 am' }, // static marketing copy — remove once real data available
  { label: 'Repeat customers', trend: '62%', note: 'Loyal buyers return every 5–7 days' },
  { label: 'Photo quality', trend: 'Key', note: 'Listings with 3+ photos get 2× preorders' },
];

const ACTIONS = [
  { label: 'manage preorder queue', desc: 'Review, confirm and advance active preorders', Icon: Package, color: '#06b6d4', route: '/prepper-orders' },
  { label: 'update your menu', desc: 'Keep listings fresh — remove sold-out items', Icon: Package, color: '#06b6d4', route: '/meal-editor' },
  { label: 'view performance analytics', desc: 'Weekly trends, top dishes, and smart insights', Icon: TrendingUp, color: '#22c55e', route: '/prepper-analytics' },
  { label: 'view earnings breakdown', desc: 'Net pay, weekly totals, and recent transactions', Icon: Wallet, color: '#10b981', route: '/prepper-payouts' },
  { label: 'reply to reviews', desc: 'Responding boosts your ranking score', Icon: MessageSquare, color: '#8b5cf6', route: '/reviews' },
  { label: 'meal planner', desc: 'Set which days each meal is available for the week', Icon: CalendarDays, color: Palette.brand, route: '/prepper-meal-planner' },
  { label: 'edit kitchen profile', desc: 'Update your name, photo, bio and specialties', Icon: ChefHat, color: Palette.brand, route: '/prepper-profile-edit' },
  { label: 'bid requests', desc: 'View and bid on open meal requests from customers', Icon: Sparkles, color: '#f59e0b', route: '/bid-requests' },
];

const TIPS = [
  'Batch-cook bases (rice, beans, pasta) Sunday night to fulfil Mon–Wed preorders faster.',
  'Add a "daily special" every morning — novelty drives impulse buys.',
  'Respond to customer messages within 30 minutes — faster replies = higher ratings.',
  'Update your profile photo after big catering events — fresh content signals activity.',
  'Offer a bundle deal (meal + dessert) to raise average preorder value by 20–30%.',
  'Set a prep-time buffer of +10 min during rush to protect your on-time rate.',
];

const GREEN = '#22c55e';

export default function PrepperHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application, isLoading: appLoading } = useMyPrepperApplication(user?.id);
  const isDesktop = useBreakpoint() === 'desktop';
  const { data: orders, isLoading: ordersLoading, isError: ordersError, refetch: refetchOrders } = usePrepperOrders(application?.id);
  const statsLoading = appLoading || (application?.id != null && ordersLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const toggleAvailability = useToggleAvailability(application?.id);
  const isOpen = accepting !== null ? accepting : ((application as unknown as { accepting_orders?: boolean })?.accepting_orders !== false);
  async function handleRefresh() { setRefreshing(true); await refetchOrders(); setRefreshing(false); }
  const hour = new Date().getHours();
  const currentRush = getCurrentRush(hour);
  const nextRush = getNextRush(hour);
  const todayTip = TIPS[new Date().getDay() % TIPS.length];

  const completedOrders = (orders ?? []).filter((o) => o.status === 'completed');
  const totalEarnings = completedOrders.reduce((s, o) => s + o.total, 0);
  const avgOrder = completedOrders.length ? totalEarnings / completedOrders.length : 0;
  const activeCount = (orders ?? []).filter((o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).length;
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const weekCompleted = completedOrders.filter((o) => new Date(o.created_at).getTime() >= sevenDaysAgo);
  const weekEarnings = weekCompleted.reduce((s, o) => s + o.total, 0);
  const repeatRate = (() => {
    const counts: Record<string, number> = {};
    for (const o of (orders ?? [])) { if (o.customerId) counts[o.customerId] = (counts[o.customerId] ?? 0) + 1; }
    const uniq = Object.keys(counts).length;
    return uniq > 0 ? Math.round((Object.values(counts).filter((n) => n > 1).length / uniq) * 100) : null;
  })();
  const hubInsights = [
    {
      label: 'Your repeat buyers',
      trend: repeatRate !== null ? `${repeatRate}%` : '—',
      note: repeatRate === null ? 'Complete your first preorders to track your repeat buyer rate.' : repeatRate >= 30 ? 'Strong loyalty. Offer a weekly special to keep them coming back.' : 'Grow repeat buyers with subscription plans and fast message replies.',
    },
    ...WEEKLY_INSIGHTS,
  ];

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ── Kitchen close confirmation modal ─────────────────────────────── */}
      <Modal visible={confirmClose} transparent animationType="fade" onRequestClose={() => setConfirmClose(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setConfirmClose(false)} accessibilityLabel="Dismiss"
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <MotiView from={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 22 }}
            style={{ backgroundColor: CARD, borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, gap: 16 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, textAlign: 'center', letterSpacing: -0.4 }}>Close your kitchen?</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21 }}>
              No new orders will arrive until you reopen. Active orders are unaffected.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <TouchableOpacity onPress={() => setConfirmClose(false)}
                accessibilityRole="button" accessibilityLabel="Cancel"
                style={{ flex: 1, height: 52, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: '#252D3D', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: MUTED }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setConfirmClose(false);
                  setAccepting(false);
                  toggleAvailability.mutate(false, { onSuccess: () => feedback.success(), onError: () => { feedback.error(); setAccepting(true); } });
                }}
                accessibilityRole="button" accessibilityLabel="Confirm close kitchen"
                style={{ flex: 1, height: 52, borderRadius: Radius.pill, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </MotiView>
        </TouchableOpacity>
      </Modal>

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>kitchen hub</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={[{ padding: 20, gap: 16 }, isDesktop ? { maxWidth: 860, alignSelf: 'center', width: '100%' } : null]}>

          {/* Rush hour status */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
          {currentRush ? (
            <View style={{ backgroundColor: ORANGE, borderRadius: Radius.lg, padding: 18, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Flame size={18} color="#fff" />
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{currentRush.label} is active</Text>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.92)', lineHeight: 20 }}>{currentRush.prepperAlert}</Text>
              <View style={{ marginTop: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: 12 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff', marginBottom: 3 }}>prep tip</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.92)', lineHeight: 18 }}>{currentRush.prepperPrepTip}</Text>
              </View>
            </View>
          ) : nextRush ? (
            <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, padding: 18, gap: 8, borderWidth: 1, borderColor: ORANGE + '30' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={17} color={ORANGE} />
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>next rush: {nextRush.window.label}</Text>
                <View style={{ flex: 1 }} />
                <View style={{ backgroundColor: ORANGE + '22', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>in ~{nextRush.inMins}m</Text>
                </View>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: TEXT2, lineHeight: 19 }}>{nextRush.window.prepperPrepTip}</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, padding: 18, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Star size={17} color='#8b5cf6' />
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>quiet window — prep for tomorrow</Text>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: TEXT2, lineHeight: 19 }}>Morning rush starts at 7 am. Use downtime to batch-cook, update photos, and reply to reviews.</Text>
            </View>
          )}
          </MotiView>

          {/* Kitchen Open / Closed banner */}
          <MotiView
            animate={{ backgroundColor: isOpen ? GREEN + '18' : Palette.danger + '18', borderColor: isOpen ? GREEN + '55' : Palette.danger + '55' }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            style={{ borderRadius: Radius.lg, borderWidth: 1.5, overflow: 'hidden' }}>
            <PressableScale
              onPress={() => {
                feedback.tap();
                if (isOpen) {
                  setConfirmClose(true);
                } else {
                  setAccepting(true);
                  toggleAvailability.mutate(true, { onSuccess: () => feedback.success(), onError: () => { feedback.error(); setAccepting(false); } });
                }
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
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: TEXT2, marginTop: 2 }}>
                  {isOpen ? 'Accepting preorders — tap to pause' : 'Not accepting preorders — tap to open'}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: isOpen ? GREEN + '25' : Palette.danger + '25' }}>
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
              style={{ backgroundColor: ORANGE + '14', borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: ORANGE + '40' }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={17} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>{activeCount} preorder{activeCount === 1 ? '' : 's'} in queue</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: TEXT2, marginTop: 1 }}>Tap to review and advance</Text>
              </View>
              <ChevronRight size={16} color={ORANGE} />
            </PressableScale>
            </MotiView>
          ) : null}

          {ordersError ? (
            <View style={{ backgroundColor: Palette.danger + '1A', borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Palette.danger + '40' }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger, flex: 1 }}>couldn't load order stats — pull down to retry</Text>
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
              { label: 'preorders filled', value: completedOrders.length.toString(), sub: weekCompleted.length > 0 ? `+${weekCompleted.length} this wk` : undefined, Icon: Package, color: '#06b6d4' },
              { label: 'total earned', value: `$${totalEarnings.toFixed(0)}`, sub: weekEarnings > 0 ? `+$${weekEarnings.toFixed(0)} this wk` : undefined, Icon: DollarSign, color: '#22c55e' },
              { label: 'avg preorder', value: `$${avgOrder.toFixed(0)}`, sub: undefined, Icon: TrendingUp, color: ORANGE },
            ].map(({ label, value, sub, Icon, color }, i) => (
              <MotiView key={label} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 100 + i * 50 }} style={{ flex: 1 }}>
              <View style={{ backgroundColor: CARD, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
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

          {/* Market insights */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: '#E5E7EB', letterSpacing: -0.3, marginBottom: 12 }}>market insights</Text>
          <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, overflow: 'hidden' }}>
            {hubInsights.map(({ label, trend, note }, i) => (
              <MotiView key={label} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: 160 + i * 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#1E2330' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{label}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: TEXT2, marginTop: 2 }}>{note}</Text>
                </View>
                <View style={{ backgroundColor: ORANGE + '22', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: ORANGE }}>{trend}</Text>
                </View>
              </View>
              </MotiView>
            ))}
          </View>
          </MotiView>

          {/* Create content */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 180 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: '#E5E7EB', letterSpacing: -0.3, marginBottom: 12 }}>create content</Text>
          <PressableScale onPress={() => { feedback.tap(); router.push('/post-video' as any); }} accessibilityRole="button" accessibilityLabel="Post Video"
            style={{ backgroundColor: CARD, borderRadius: 16, height: 80, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Video size={16} color={ORANGE} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 13, color: INK }}>Post Video</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 11, color: MUTED }}>share a meal drop</Text>
          </PressableScale>
          </MotiView>

          {/* Live session */}
          {application?.id ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 200 }}>
              <LiveSessionBanner prepperId={application.id} />
            </MotiView>
          ) : null}

          {/* Today panel */}
          {application?.id ? <PrepperTodayPanel prepperId={application.id} prepperUserId={user?.id} /> : null}

          {/* Weekly earnings chart */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 215 }}>
            <PrepperEarningsChart prepperId={application?.id} />
          </MotiView>

          {/* Action items */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 220 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: '#E5E7EB', letterSpacing: -0.3, marginBottom: 12 }}>action items</Text>
          <View style={isDesktop ? { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } : { gap: 10 }}>
            {ACTIONS.map(({ label, desc, Icon, color, route }, i) => (
              <MotiView key={label} style={isDesktop ? { flex: 1, minWidth: 280, maxWidth: '48%' } : undefined} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: 220 + i * 40 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push(route as any); }} accessibilityRole="button" accessibilityLabel={label}
                style={{ backgroundColor: CARD, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={17} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{label}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: TEXT2, marginTop: 2 }}>{desc}</Text>
                </View>
                <ChevronRight size={16} color={MUTED} />
              </PressableScale>
              </MotiView>
            ))}
          </View>
          </MotiView>

          {/* Performance insights */}
          {application?.id ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 340 }}>
              <PrepperInsightsCard prepperId={application.id} />
            </MotiView>
          ) : null}

          {/* Daily tip */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 360 }}>
          <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, padding: 18, gap: 10, borderWidth: 1, borderColor: ORANGE + '30' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} color="#fff" />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>tip of the day</Text>
            </View>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: TEXT2, lineHeight: 21 }}>{todayTip}</Text>
          </View>
          </MotiView>

          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
