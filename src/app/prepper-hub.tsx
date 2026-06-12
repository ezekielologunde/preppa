import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock, DollarSign, Flame, MessageSquare, Package, Sparkles, Star, TrendingUp, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { useMyOrders } from '@/lib/queries/orders';
import { Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type RushWindow = { label: string; start: number; end: number; tip: string; prepTip: string };
const RUSH_WINDOWS: RushWindow[] = [
  { label: 'morning prep', start: 7, end: 10, tip: 'Morning commuters want quick, filling breakfasts.', prepTip: 'Prep high-protein bowls, egg dishes, and oats tonight.' },
  { label: 'lunch rush', start: 11, end: 14, tip: 'Lunch is your highest-volume window — have meals ready before 11 am.', prepTip: 'Stock extra rice, soups, and wraps. Batch-cook proteins early.' },
  { label: 'dinner window', start: 16, end: 20, tip: 'Dinner orders peak between 6–7 pm. Ready early = first in queue.', prepTip: 'Pre-portion family portions and one-pot meals for fast plating.' },
];

function getCurrentRush(h: number): RushWindow | null {
  return RUSH_WINDOWS.find((w) => h >= w.start && h < w.end) ?? null;
}

function getNextRush(h: number): { window: RushWindow; inMins: number } | null {
  const upcoming = RUSH_WINDOWS.map((w) => ({ window: w, inMins: (w.start - h) * 60 })).filter((r) => r.inMins > 0);
  return upcoming.length ? upcoming[0] : null;
}

const WEEKLY_INSIGHTS = [
  { label: 'Nigerian cuisine', trend: '+34%', note: 'Jollof rice orders surging this week' },
  { label: 'Lunch slot orders', trend: '+18%', note: 'Best time to list new items is 10–11 am' },
  { label: 'Repeat customers', trend: '62%', note: 'Loyal buyers return every 5–7 days' },
  { label: 'Photo quality', trend: 'Key', note: 'Listings with 3+ photos get 2× orders' },
];

const ACTIONS = [
  { label: 'add a rush-hour special', desc: 'Attract more orders during peak windows', Icon: Flame, color: ORANGE, route: '/specials' },
  { label: 'update your menu', desc: 'Keep listings fresh — remove sold-out items', Icon: Package, color: '#06b6d4', route: '/meal-editor' },
  { label: 'reply to reviews', desc: 'Responding boosts your ranking score', Icon: MessageSquare, color: '#8b5cf6', route: '/reviews' },
  { label: 'boost your listing', desc: 'Appear at the top of search during rush', Icon: Zap, color: '#d97706', route: '/boost' },
  { label: 'view performance analytics', desc: 'Weekly trends, top dishes, and smart insights', Icon: TrendingUp, color: '#22c55e', route: '/prepper-analytics' },
];

const TIPS = [
  'Batch-cook bases (rice, beans, pasta) Sunday night to fulfil Mon–Wed orders faster.',
  'Add a "daily special" every morning — novelty drives impulse buys.',
  'Respond to customer messages within 30 minutes — faster replies = higher ratings.',
  'Update your profile photo after big catering events — fresh content signals activity.',
  'Offer a bundle deal (meal + dessert) to raise average order value by 20–30%.',
  'Set a prep-time buffer of +10 min during rush to protect your on-time rate.',
];

export default function PrepperHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: orders } = useMyOrders(user?.id);
  const hour = new Date().getHours();
  const currentRush = getCurrentRush(hour);
  const nextRush = getNextRush(hour);
  const todayTip = TIPS[new Date().getDay() % TIPS.length];

  const completedOrders = (orders ?? []).filter((o) => o.status === 'completed');
  const totalEarnings = completedOrders.reduce((s, o) => s + o.total, 0);
  const avgOrder = completedOrders.length ? totalEarnings / completedOrders.length : 0;

  function goBack() { feedback.tap(); try { router.back(); } catch { router.replace('/profile'); } }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>kitchen hub</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 130 }}>

          {/* Rush hour status */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
          {currentRush ? (
            <View style={{ backgroundColor: ORANGE, borderRadius: Radius.lg, padding: 18, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Flame size={18} color="#fff" />
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{currentRush.label} is active</Text>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.92)', lineHeight: 20 }}>{currentRush.tip}</Text>
              <View style={{ marginTop: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: 12 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff', marginBottom: 3 }}>prep tip</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.92)', lineHeight: 18 }}>{currentRush.prepTip}</Text>
              </View>
            </View>
          ) : nextRush ? (
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 18, gap: 8, borderWidth: 1, borderColor: ORANGE + '30' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={17} color={ORANGE} />
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>next rush: {nextRush.window.label}</Text>
                <View style={{ flex: 1 }} />
                <View style={{ backgroundColor: Palette.brandTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>in ~{nextRush.inMins}m</Text>
                </View>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{nextRush.window.prepTip}</Text>
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

          {/* Quick stats */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'orders filled', value: completedOrders.length.toString(), Icon: Package, color: '#06b6d4' },
              { label: 'total earned', value: `$${totalEarnings.toFixed(0)}`, Icon: DollarSign, color: '#22c55e' },
              { label: 'avg order', value: `$${avgOrder.toFixed(0)}`, Icon: TrendingUp, color: ORANGE },
            ].map(({ label, value, Icon, color }) => (
              <View key={label} style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 6 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color={color} />
                </View>
                <Text style={{ fontFamily: Font.display, fontSize: 19, color: INK, fontVariant: ['tabular-nums'] }}>{value}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textMuted, textAlign: 'center' }}>{label}</Text>
              </View>
            ))}
          </View>
          </MotiView>

          {/* Market insights */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, letterSpacing: -0.4, marginBottom: 12 }}>market insights</Text>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden' }}>
            {WEEKLY_INSIGHTS.map(({ label, trend, note }, i) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{label}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>{note}</Text>
                </View>
                <View style={{ backgroundColor: Palette.brandTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: ORANGE }}>{trend}</Text>
                </View>
              </View>
            ))}
          </View>
          </MotiView>

          {/* Action items */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 200 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, letterSpacing: -0.4, marginBottom: 12 }}>action items</Text>
          <View style={{ gap: 10 }}>
            {ACTIONS.map(({ label, desc, Icon, color, route }, i) => (
              <MotiView key={label} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: 220 + i * 40 }}>
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
          <View style={{ backgroundColor: '#11151C', borderRadius: Radius.lg, padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} color="#fff" />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>tip of the day</Text>
            </View>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 21 }}>{todayTip}</Text>
          </View>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
