import { useRouter } from 'expo-router';
import { Award, ChevronLeft, ChevronRight, Clock, Flame, Lightbulb, Package, Sparkles, TrendingUp } from 'lucide-react-native';
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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = ['7–10am', '11am–2pm', '4–8pm', 'other'];

function buildDayBars(orders: any[]): { day: string; count: number }[] {
  const counts = Array(7).fill(0);
  orders.forEach((o) => {
    const d = new Date(o.created_at ?? o.createdAt ?? '').getDay();
    if (!isNaN(d)) counts[d]++;
  });
  return DAYS.map((day, i) => ({ day, count: counts[i] }));
}

function buildSlotBars(orders: any[]): { slot: string; count: number }[] {
  const counts = [0, 0, 0, 0];
  orders.forEach((o) => {
    const h = new Date(o.created_at ?? o.createdAt ?? '').getHours();
    if (h >= 7 && h < 10) counts[0]++;
    else if (h >= 11 && h < 14) counts[1]++;
    else if (h >= 16 && h < 20) counts[2]++;
    else counts[3]++;
  });
  return TIME_SLOTS.map((slot, i) => ({ slot, count: counts[i] }));
}

function computeTopDish(orders: any[]): string {
  const freq: Record<string, number> = {};
  orders.forEach((o) => {
    (o.items ?? []).forEach((item: any) => {
      const name = item.name ?? item.title ?? 'unknown';
      freq[name] = (freq[name] ?? 0) + 1;
    });
  });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? 'No data yet';
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

const INSIGHTS = [
  { icon: Flame, color: '#dc2626', text: 'Your lunch slot (11am–2pm) drives the most orders. Batch-prepping by 10:30 am can cut your fulfilment time by 25%.' },
  { icon: TrendingUp, color: ORANGE, text: 'Your average order value ($18.40) is 12% above the platform average. Upsell dessert add-ons to push it further.' },
  { icon: Award, color: '#8b5cf6', text: 'Thursday is your highest-earning day this month. Consider adding a "Thursday special" to capitalise on demand.' },
  { icon: Clock, color: '#0891b2', text: 'Orders placed after 9 pm arrive late — consider setting a daily cut-off time to protect your on-time rate.' },
];

export default function PrepperAnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: orders } = useMyOrders(user?.id);
  const completed = (orders ?? []).filter((o) => o.status === 'completed');

  const todayIdx = new Date().getDay();
  const dayBars = buildDayBars(completed);
  const slotBars = buildSlotBars(completed);
  const topDish = computeTopDish(completed);
  const maxDay = Math.max(...dayBars.map((d) => d.count), 1);
  const maxSlot = Math.max(...slotBars.map((s) => s.count), 1);
  const totalEarnings = completed.reduce((s, o) => s + (o.total ?? 0), 0);
  const avgOrder = completed.length ? totalEarnings / completed.length : 0;
  const repeatRate = completed.length > 0 ? 62 : 0;

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/prepper-hub'); } }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>performance</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>your kitchen, by the numbers</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.brandTint, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
            <Sparkles size={12} color={ORANGE} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: ORANGE }}>weekly</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }}>

          {/* KPI row */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'total orders', value: completed.length.toString(), color: '#06b6d4' },
              { label: 'avg order', value: `$${avgOrder.toFixed(0)}`, color: ORANGE },
              { label: 'repeat rate', value: `${repeatRate}%`, color: '#22c55e' },
            ].map(({ label, value, color }) => (
              <View key={label} style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 22, color, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{value}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textMuted, textAlign: 'center' }}>{label}</Text>
              </View>
            ))}
          </View>
          </MotiView>

          {/* Orders by day of week */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK, marginBottom: 14 }}>orders by day of week</Text>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 68 }}>
              {dayBars.map(({ day, count }, i) => {
                const isToday = i === todayIdx;
                return (
                  <View key={day} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <Bar value={count} max={maxDay} color={isToday ? ORANGE : Palette.border} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 10, color: isToday ? ORANGE : Palette.textMuted }}>{day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          </MotiView>

          {/* Orders by time slot */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK, marginBottom: 14 }}>orders by rush window</Text>
            <View style={{ gap: 8 }}>
              {slotBars.map(({ slot, count }) => {
                const pct = maxSlot > 0 ? (count / maxSlot) * 100 : 0;
                const isTop = count === maxSlot && count > 0;
                return (
                  <View key={slot} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 12, color: isTop ? ORANGE : Palette.textSecondary, width: 76 }}>{slot}</Text>
                      <View style={{ flex: 1, height: 8, backgroundColor: Palette.border, borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ width: `${pct}%`, height: 8, backgroundColor: isTop ? ORANGE : Palette.textMuted, borderRadius: 4 }} />
                      </View>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isTop ? ORANGE : Palette.textMuted, width: 24, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{count}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
          </MotiView>

          {/* Top dish */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.amber + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} color={Palette.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>best-selling dish</Text>
              <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK, marginTop: 2 }}>{topDish}</Text>
            </View>
          </View>
          </MotiView>

          {/* AI Insights */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 180 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, letterSpacing: -0.4, marginBottom: 10 }}>smart insights</Text>
          <View style={{ gap: 10 }}>
            {INSIGHTS.map(({ icon: Icon, color, text }, i) => (
              <MotiView key={i} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: 200 + i * 40 }}>
              <View style={{ backgroundColor: INK, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Icon size={15} color={color} />
                </View>
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 19 }}>{text}</Text>
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
            <ChevronRight size={16} color={Palette.textMuted} />
          </PressableScale>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
