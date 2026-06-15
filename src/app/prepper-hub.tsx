import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock, DollarSign, Flame, MessageSquare, Package, RefreshCw, Sparkles, Star, TrendingUp, Users, Wallet, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';
import { usePrepperOrders } from '@/lib/queries/orders';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { getCurrentRush, getNextRush } from '@/lib/rush-hour';
import { Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

const WEEKLY_INSIGHTS = [
  { label: 'Nigerian cuisine', trend: '+34%', note: 'Jollof rice preorders surging this week' },
  { label: 'Lunch slot preorders', trend: '+18%', note: 'Best time to list new items is 10–11 am' },
  { label: 'Repeat customers', trend: '62%', note: 'Loyal buyers return every 5–7 days' },
  { label: 'Photo quality', trend: 'Key', note: 'Listings with 3+ photos get 2× preorders' },
];

const ACTIONS = [
  { label: 'add a rush-hour special', desc: 'Attract more preorders during peak windows', Icon: Flame, color: ORANGE, route: '/specials' },
  { label: 'update your menu', desc: 'Keep listings fresh — remove sold-out items', Icon: Package, color: '#06b6d4', route: '/meal-editor' },
  { label: 'manage subscription plans', desc: 'Create and publish recurring meal plans customers subscribe to', Icon: RefreshCw, color: '#8b5cf6', route: '/prepper-meal-plans' },
  { label: 'reply to reviews', desc: 'Responding boosts your ranking score', Icon: MessageSquare, color: '#8b5cf6', route: '/reviews' },
  { label: 'boost your listing', desc: 'Appear at the top of search during rush', Icon: Zap, color: '#d97706', route: '/boost' },
  { label: 'view performance analytics', desc: 'Weekly trends, top dishes, and smart insights', Icon: TrendingUp, color: '#22c55e', route: '/prepper-analytics' },
  { label: 'view earnings breakdown', desc: 'Net pay, weekly totals, and recent transactions', Icon: Wallet, color: '#10b981', route: '/earnings' },
  { label: 'view your customers', desc: 'Your buyers, repeat rate, and spend per person', Icon: Users, color: '#06b6d4', route: '/customers' },
];

const TIPS = [
  'Batch-cook bases (rice, beans, pasta) Sunday night to fulfil Mon–Wed preorders faster.',
  'Add a "daily special" every morning — novelty drives impulse buys.',
  'Respond to customer messages within 30 minutes — faster replies = higher ratings.',
  'Update your profile photo after big catering events — fresh content signals activity.',
  'Offer a bundle deal (meal + dessert) to raise average preorder value by 20–30%.',
  'Set a prep-time buffer of +10 min during rush to protect your on-time rate.',
];

export default function PrepperHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application } = useMyPrepperApplication(user?.id);
  const isDesktop = useBreakpoint() === 'desktop';
  const { data: orders, isError: ordersError, refetch: refetchOrders } = usePrepperOrders(application?.id);
  const [refreshing, setRefreshing] = useState(false);
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
    WEEKLY_INSIGHTS[0],
    WEEKLY_INSIGHTS[1],
    {
      label: 'Your repeat buyers',
      trend: repeatRate !== null ? `${repeatRate}%` : '—',
      note: repeatRate === null ? 'Complete your first preorders to track your repeat buyer rate.' : repeatRate >= 30 ? 'Strong loyalty. Offer a weekly special to keep them coming back.' : 'Grow repeat buyers with subscription plans and fast message replies.',
    },
    WEEKLY_INSIGHTS[3],
  ];

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
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
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 18, gap: 8, borderWidth: 1, borderColor: ORANGE + '30' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={17} color={ORANGE} />
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>next rush: {nextRush.window.label}</Text>
                <View style={{ flex: 1 }} />
                <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>in ~{nextRush.inMins}m</Text>
                </View>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{nextRush.window.prepperPrepTip}</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 18, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Star size={17} color='#8b5cf6' />
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>quiet window — prep for tomorrow</Text>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>Morning rush starts at 7 am. Use downtime to batch-cook, update photos, and reply to reviews.</Text>
            </View>
          )}
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
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>Tap to review and advance</Text>
              </View>
              <ChevronRight size={16} color={ORANGE} />
            </PressableScale>
            </MotiView>
          ) : null}

          {ordersError ? (
            <View style={{ backgroundColor: Palette.danger + '14', borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Palette.danger + '40' }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger, flex: 1 }}>couldn't load order stats — pull down to retry</Text>
            </View>
          ) : null}

          {/* Quick stats */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'preorders filled', value: completedOrders.length.toString(), sub: weekCompleted.length > 0 ? `+${weekCompleted.length} this wk` : undefined, Icon: Package, color: '#06b6d4' },
              { label: 'total earned', value: `$${totalEarnings.toFixed(0)}`, sub: weekEarnings > 0 ? `+$${weekEarnings.toFixed(0)} this wk` : undefined, Icon: DollarSign, color: '#22c55e' },
              { label: 'avg preorder', value: `$${avgOrder.toFixed(0)}`, sub: undefined, Icon: TrendingUp, color: ORANGE },
            ].map(({ label, value, sub, Icon, color }, i) => (
              <MotiView key={label} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 100 + i * 50 }} style={{ flex: 1 }}>
              <View style={{ backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color={color} />
                </View>
                <Text style={{ fontFamily: Font.display, fontSize: 19, color: INK, fontVariant: ['tabular-nums'] }}>{value}</Text>
                {sub ? <Text style={{ fontFamily: Font.medium, fontSize: 10, color: Palette.success, textAlign: 'center' }}>{sub}</Text> : null}
                <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textMuted, textAlign: 'center' }}>{label}</Text>
              </View>
              </MotiView>
            ))}
          </View>
          </MotiView>

          {/* Market insights */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginBottom: 12 }}>market insights</Text>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden' }}>
            {hubInsights.map(({ label, trend, note }, i) => (
              <MotiView key={label} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: 160 + i * 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{label}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>{note}</Text>
                </View>
                <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: ORANGE }}>{trend}</Text>
                </View>
              </View>
              </MotiView>
            ))}
          </View>
          </MotiView>

          {/* Action items */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 200 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginBottom: 12 }}>action items</Text>
          <View style={isDesktop ? { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } : { gap: 10 }}>
            {ACTIONS.map(({ label, desc, Icon, color, route }, i) => (
              <MotiView key={label} style={isDesktop ? { flex: 1, minWidth: 280, maxWidth: '48%' } : undefined} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: 220 + i * 40 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push(route as any); }} accessibilityRole="button" accessibilityLabel={label}
                style={{ backgroundColor: Palette.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={17} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{label}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>{desc}</Text>
                </View>
                <ChevronRight size={16} color={Palette.textMuted} />
              </PressableScale>
              </MotiView>
            ))}
          </View>
          </MotiView>

          {/* Daily tip */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 360 }}>
          <View style={{ backgroundColor: INK, borderRadius: Radius.lg, padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} color="#fff" />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>tip of the day</Text>
            </View>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 21 }}>{todayTip}</Text>
          </View>
          </MotiView>

          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
