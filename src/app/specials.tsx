import { useRouter } from 'expo-router';
import { ChevronLeft, Clock, Flame, Leaf, Sparkles, Star, Sun } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealCard } from '@/components/meal-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { recommendedMeals } from '@/constants/mock';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const ORANGE = Palette.brand;

function rushHourContext(): { active: boolean; label: string; sub: string; icon: typeof Flame } {
  const h = new Date().getHours();
  if (h >= 11 && h < 14) return { active: true, label: 'lunch rush', sub: 'Order now for 12–1pm pickup', icon: Flame };
  if (h >= 16 && h < 20) return { active: true, label: 'dinner window', sub: 'Order now for 6–7pm delivery', icon: Clock };
  if (h >= 7 && h < 10) return { active: true, label: 'morning prep', sub: 'Weekend brunch drops available now', icon: Sun };
  return { active: false, label: 'coming up', sub: 'Rush hour deals land at 11am · 4pm · 7am', icon: Clock };
}

const SEASONAL = {
  label: 'summer grilling',
  sub: 'Outdoor-ready meals, BBQ platters & cold sides',
  color: '#ea580c',
  icon: Sun,
};

const WEEKLY_BADGE = { label: "this week's picks", color: '#6d28d9', icon: Star };

function SectionBadge({ label, color, Icon }: { label: string; color: string; Icon: typeof Star }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
      <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: color + '1A', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={color} />
      </View>
      <Text style={{ fontFamily: Font.heading, fontSize: 13, color, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
    </View>
  );
}

function RushHourCard() {
  const rush = rushHourContext();
  const { icon: Icon } = rush;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
      <View style={{
        marginHorizontal: 20,
        borderRadius: 20,
        backgroundColor: rush.active ? ORANGE : Palette.surface,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        ...Shadow.card,
      }}>
        <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: rush.active ? 'rgba(255,255,255,0.2)' : Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={rush.active ? '#fff' : ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: rush.active ? '#fff' : Palette.ink, letterSpacing: -0.4 }}>{rush.label}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: rush.active ? 'rgba(255,255,255,0.85)' : Palette.textSecondary, marginTop: 2 }}>{rush.sub}</Text>
        </View>
        {rush.active ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff' }}>live</Text>
          </View>
        ) : null}
      </View>
    </MotiView>
  );
}

function SeasonalCard() {
  const { icon: Icon } = SEASONAL;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
      <View style={{
        marginHorizontal: 20,
        borderRadius: 20,
        backgroundColor: Palette.surface,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderWidth: 1.5,
        borderColor: SEASONAL.color + '30',
        ...Shadow.card,
      }}>
        <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: SEASONAL.color + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={SEASONAL.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink, letterSpacing: -0.4 }}>{SEASONAL.label}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>{SEASONAL.sub}</Text>
        </View>
      </View>
    </MotiView>
  );
}

export default function SpecialsScreen() {
  const router = useRouter();
  const weeklyPicks = recommendedMeals.slice(0, 4);
  const freshDrops = [...recommendedMeals].reverse().slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
          <PressableScale
            onPress={() => { feedback.tap(); try { router.back(); } catch { router.replace('/'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.7 }}>deals & specials</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>rush hour, weekly picks, seasonal drops</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.brandTint, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
            <Sparkles size={12} color={ORANGE} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: ORANGE }}>live</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, gap: 28 }}>
          {/* Rush hour */}
          <RushHourCard />

          {/* Seasonal */}
          <SeasonalCard />

          {/* Weekly picks */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <SectionBadge label={WEEKLY_BADGE.label} color={WEEKLY_BADGE.color} Icon={WEEKLY_BADGE.icon} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
            {weeklyPicks.map((m) => <MealCard key={m.id} meal={m} />)}
          </ScrollView>
          </MotiView>

          {/* Fresh drops */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 180 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <SectionBadge label="fresh drops" color="#059669" Icon={Leaf} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
            {freshDrops.map((m) => <MealCard key={m.id} meal={m} />)}
          </ScrollView>
          </MotiView>

          {/* How specials work */}
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 280, delay: 240 }}>
          <View style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, gap: 10 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>how specials work</Text>
            {[
              'Rush hour meals are available during peak times — lunch 11am–2pm and dinner 4–8pm.',
              'Weekly picks refresh every Monday. Follow your favourite kitchens to get notified first.',
              'Seasonal drops celebrate the best in-season produce and cooking styles each month.',
            ].map((tip, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE, marginTop: 6 }} />
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{tip}</Text>
              </View>
            ))}
          </View>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
