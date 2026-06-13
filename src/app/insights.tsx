import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock, Flame, Heart, Leaf, Sparkles, TrendingUp, UtensilsCrossed } from 'lucide-react-native';
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

const CUISINE_TIPS: Record<string, string> = {
  Nigerian: 'You clearly have great taste. Try Jollof variations from different regions.',
  Mexican: 'Explore regional Mexican — Oaxacan mole is a level up from tacos.',
  Italian: 'Try a Roman-style pasta next — cacio e pepe from a home kitchen is unbeatable.',
  Asian: 'Branch out into Korean BBQ bowls or Vietnamese pho for something new.',
  American: 'Try a Southern comfort meal — smothered chicken or shrimp & grits.',
};

function computeTopCuisine(orders: { prepper: string; items: { title: string }[] }[]): string | null {
  if (!orders.length) return null;
  const map: Record<string, number> = {};
  const CUISINE_KEYWORDS: [string, string][] = [
    ['jollof', 'Nigerian'], ['suya', 'Nigerian'], ['egusi', 'Nigerian'], ['plantain', 'Nigerian'],
    ['taco', 'Mexican'], ['burrito', 'Mexican'], ['enchilada', 'Mexican'],
    ['pasta', 'Italian'], ['pizza', 'Italian'], ['risotto', 'Italian'],
    ['rice', 'Asian'], ['noodle', 'Asian'], ['ramen', 'Asian'], ['pho', 'Asian'],
    ['burger', 'American'], ['bbq', 'American'], ['wings', 'American'],
  ];
  orders.forEach((o) => o.items.forEach((item) => {
    CUISINE_KEYWORDS.forEach(([kw, cuisine]) => {
      if (item.title.toLowerCase().includes(kw)) map[cuisine] = (map[cuisine] ?? 0) + 1;
    });
  }));
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

function computeTimeSaved(ordersCount: number): string {
  const minsPerMeal = 45;
  const totalMins = ordersCount * minsPerMeal;
  if (totalMins < 60) return `${totalMins} minutes`;
  const hrs = Math.round(totalMins / 60);
  return `${hrs} hour${hrs === 1 ? '' : 's'}`;
}

const SAVINGS_TIPS = [
  { tip: 'Preorder during off-peak hours (2–4 pm) to get faster fulfillment and sometimes specials.', Icon: Clock },
  { tip: 'Subscribe to a weekly meal plan — it costs 10–20% less than ordering individually.', Icon: Leaf },
  { tip: 'Follow preppers to get notified when they drop new specials before they sell out.', Icon: Heart },
  { tip: 'Batch your orders — some preppers offer bundle deals for 2–3 meals at a time.', Icon: UtensilsCrossed },
];

export default function InsightsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: orders } = useMyOrders(user?.id);
  const completed = (orders ?? []).filter((o) => o.status === 'completed');
  const total = completed.reduce((s, o) => s + o.total, 0);
  const avg = completed.length ? total / completed.length : 0;
  const topCuisine = computeTopCuisine(completed);
  const timeSaved = computeTimeSaved(completed.length);

  const freqs: Record<string, number> = {};
  completed.forEach((o) => { freqs[o.prepper] = (freqs[o.prepper] ?? 0) + 1; });
  const topKitchen = Object.entries(freqs).sort((a, b) => b[1] - a[1])[0];

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>my stats</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}>

          {/* Hero stats */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
          {completed.length === 0 ? (
            <View style={{ backgroundColor: ORANGE, borderRadius: Radius.lg, padding: 20, gap: 6 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>your food journey</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 36, color: '#fff', letterSpacing: -0.8 }}>starts here</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginTop: 2 }}>
                Preorder your first home-cooked meal and we'll start tracking your cuisine favourites, time saved, and spending patterns.
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: ORANGE, borderRadius: Radius.lg, padding: 20, gap: 4 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>lifetime with Preppa</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 42, color: '#fff', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{completed.length}</Text>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: 'rgba(255,255,255,0.92)' }}>home-cooked meals ordered</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 6 }}>
                That's roughly {timeSaved} of cooking you didn't have to do.
              </Text>
            </View>
          )}
          </MotiView>

          {/* Stat tiles — only shown once there's data */}
          {completed.length > 0 ? (
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'total spent', value: `$${total.toFixed(0)}`, sub: 'lifetime' },
              { label: 'avg order', value: `$${avg.toFixed(0)}`, sub: 'per meal' },
              ...(topKitchen ? [{ label: 'top kitchen', value: topKitchen[0].split(' ')[0], sub: `${topKitchen[1]}× orders` }] : []),
            ].map(({ label, value, sub }) => (
              <View key={label} style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, fontVariant: ['tabular-nums'] }}>{value}</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textSecondary }}>{label}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textMuted }}>{sub}</Text>
              </View>
            ))}
          </View>
          </MotiView>
          ) : null}

          {/* Cuisine insight */}
          {topCuisine ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 18, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Flame size={17} color={ORANGE} />
                <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: INK }}>your cuisine soulmate</Text>
              </View>
              <View style={{ backgroundColor: Palette.brandTint, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 20, color: ORANGE }}>{topCuisine}</Text>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20 }}>
                {CUISINE_TIPS[topCuisine] ?? 'You have adventurous taste — keep exploring new cuisines on Preppa.'}
              </Text>
              <PressableScale onPress={() => { feedback.tap(); router.push('/explore'); }} accessibilityRole="button" accessibilityLabel="Explore more cuisines"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>explore more cuisines</Text>
                <ChevronRight size={14} color={ORANGE} />
              </PressableScale>
            </View>
            </MotiView>
          ) : null}

          {/* Preppa AI insight card */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 200 }}>
          <View style={{ backgroundColor: INK, borderRadius: Radius.lg, padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} color="#fff" />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Preppa AI insight</Text>
            </View>
            {completed.length > 0 ? (
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 21 }}>
                Based on your order history, you order most on weekends and tend to try the same kitchens.
                {topCuisine ? ` Since you love ${topCuisine} food, try a prepper who specializes in a neighbouring cuisine for a fresh experience.` : ' Try exploring a new cuisine this week — variety keeps taste buds sharp.'}
              </Text>
            ) : (
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 21 }}>
                Place your first order and Preppa AI will start building insights about your food preferences and spending patterns.
              </Text>
            )}
            <PressableScale onPress={() => { feedback.tap(); router.push('/explore'); }} accessibilityRole="button" accessibilityLabel="Explore meals"
              style={{ backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>{completed.length > 0 ? 'try something new' : 'explore meals'}</Text>
            </PressableScale>
          </View>
          </MotiView>

          {/* Trending in your area */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 260 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TrendingUp size={17} color={ORANGE} />
            <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3 }}>save more on Preppa</Text>
          </View>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden' }}>
            {SAVINGS_TIPS.map(({ tip, Icon }, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Icon size={14} color={ORANGE} />
                </View>
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 20 }}>{tip}</Text>
              </View>
            ))}
          </View>
          </MotiView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
