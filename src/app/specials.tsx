import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock, Flame, Gift, Leaf, Sparkles, Star, Sun, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealCard } from '@/components/meal-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { recommendedMeals } from '@/constants/mock';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { getCurrentRush, getNextRush } from '@/lib/rush-hour';
import { getSeasonalTheme } from '@/lib/marketing';

const ORANGE = Palette.brand;

function rushHourContext(): { active: boolean; label: string; sub: string; icon: typeof Flame } {
  const h = new Date().getHours();
  const rush = getCurrentRush(h);
  if (rush) return { active: true, label: rush.label, sub: rush.buyerTip, icon: rush.id === 'morning' ? Sun : rush.id === 'lunch' ? Flame : Clock };
  const next = getNextRush(h);
  if (next) return { active: false, label: 'coming up', sub: `Next: ${next.window.label} in ~${next.inMins}m`, icon: Clock };
  return { active: false, label: 'coming up', sub: 'Rush hour deals land at 7am · 11am · 4pm', icon: Clock };
}

const _seasonal = getSeasonalTheme();
const SEASONAL = {
  label: _seasonal.label,
  sub: _seasonal.tag,
  color: _seasonal.color,
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

const now = new Date();
const isFathersDayWindow = now.getMonth() === 5 && now.getDate() >= 12 && now.getDate() <= 22;
const fathersDayDaysLeft = isFathersDayWindow ? 21 - now.getDate() : 0;

export default function SpecialsScreen() {
  const router = useRouter();
  const weeklyPicks = recommendedMeals.slice(0, 4);
  const freshDrops = [...recommendedMeals].reverse().slice(0, 4);
  const fathersDayPicks = recommendedMeals.slice(1, 5);

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }}
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
          {/* Emergency food CTA */}
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
          <PressableScale onPress={() => { feedback.tap(); router.push('/emergency-food'); }} accessibilityRole="button" accessibilityLabel="Emergency food mode"
            style={{ marginHorizontal: 20, backgroundColor: '#7f1d1d', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Zap size={17} color="#fca5a5" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>need food urgently?</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>Notify nearby preppers instantly</Text>
            </View>
            <ChevronRight size={15} color="rgba(255,255,255,0.5)" />
          </PressableScale>
          </MotiView>

          {/* Holiday specials CTA */}
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 40 }}>
          <PressableScale onPress={() => { feedback.tap(); router.push('/holiday-specials'); }} accessibilityRole="button" accessibilityLabel="Holiday specials"
            style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: ORANGE + '30' }}>
            <Gift size={17} color={ORANGE} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>holiday & cultural specials</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>Eid, Juneteenth, Father's Day meals & more</Text>
            </View>
            <ChevronRight size={15} color={Palette.textMuted} />
          </PressableScale>
          </MotiView>

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

          {/* Father's Day picks */}
          {isFathersDayWindow ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 160 }}>
            <View style={{ marginHorizontal: 20, backgroundColor: '#1e1b4b', borderRadius: 20, padding: 16, gap: 12, borderWidth: 1, borderColor: '#4f46e5' + '40' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#4f46e5' + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Gift size={16} color="#818cf8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.display, fontSize: 16, color: '#c7d2fe', letterSpacing: -0.3 }}>Father's Day picks</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#6366f1', marginTop: 1 }}>
                    {fathersDayDaysLeft === 0 ? 'Today — treat dad to something special' : `${fathersDayDaysLeft} day${fathersDayDaysLeft !== 1 ? 's' : ''} away — order ahead`}
                  </Text>
                </View>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, marginTop: 14 }}>
              {fathersDayPicks.map((m) => <MealCard key={m.id} meal={m} />)}
            </ScrollView>
            </MotiView>
          ) : null}

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
