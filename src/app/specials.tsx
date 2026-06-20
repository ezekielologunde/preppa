import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock, Flame, Gift, Leaf, Sparkles, Star, Sun } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuickAddButton } from '@/components/home-feed';
import { MealCard } from '@/components/meal-card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useCarouselCardWidth, usePagePadding } from '@/lib/layout';
import { getCurrentRush, getNextRush } from '@/lib/rush-hour';
import { getSeasonalTheme } from '@/lib/marketing';
import { useFeaturedMeals, useLimitedDrops } from '@/lib/queries/meals';

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
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff' }}>active</Text>
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

/** 3rd Sunday of June for the given year. */
function fathersDayDate(year: number): Date {
  const june1 = new Date(year, 5, 1);
  const daysToFirstSun = (7 - june1.getDay()) % 7;
  return new Date(year, 5, 1 + daysToFirstSun + 14);
}

export default function SpecialsScreen() {
  const now = new Date();
  const fdDay = fathersDayDate(now.getFullYear());
  const today = new Date(now); today.setHours(0, 0, 0, 0); fdDay.setHours(0, 0, 0, 0);
  const fathersDayDaysLeft = Math.round((fdDay.getTime() - today.getTime()) / 86_400_000);
  const isFathersDayWindow = now.getMonth() === 5 && fathersDayDaysLeft >= 0 && fathersDayDaysLeft <= 10;
  const router = useRouter();
  const { data: featuredMeals = [], isLoading: featuredLoading, isError: featuredError, refetch: refetchFeatured } = useFeaturedMeals(8);
  const { data: limitedDrops = [], isLoading: dropsLoading, isError: dropsError, refetch: refetchDrops } = useLimitedDrops(8);
  const isLoading = featuredLoading || dropsLoading;
  const isError = featuredError || dropsError;
  const [refreshing, setRefreshing] = useState(false);
  const weeklyPicks = featuredMeals.slice(0, 4);
  const freshDrops = limitedDrops.length ? limitedDrops.slice(0, 4) : featuredMeals.slice(4, 8);
  const fathersDayPicks = featuredMeals.slice(4, 8).length ? featuredMeals.slice(4, 8) : featuredMeals.slice(0, 4);
  const carouselCardWidth = useCarouselCardWidth();
  const pad = usePagePadding();

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchFeatured(), refetchDrops()]);
    setRefreshing(false);
  }

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
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: ORANGE }}>now</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, gap: 28 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}>

          {/* Rush hour */}
          <RushHourCard />

          {/* Seasonal */}
          <SeasonalCard />

          {/* Weekly picks */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <SectionBadge label={WEEKLY_BADGE.label} color={WEEKLY_BADGE.color} Icon={WEEKLY_BADGE.icon} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12 }}>
            {isLoading
              ? [0, 1, 2, 3].map((i) => <CardSkeleton key={i} width={carouselCardWidth} />)
              : isError
              ? (
                <View style={{ paddingVertical: 16, paddingHorizontal: 4, gap: 10 }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Couldn't load meals.</Text>
                  <PressableScale onPress={() => { feedback.tap(); void handleRefresh(); }} accessibilityRole="button" accessibilityLabel="Retry loading meals"
                    style={{ backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>retry</Text>
                  </PressableScale>
                </View>
              )
              : weeklyPicks.map((m) => (
                <View key={m.id} style={{ position: 'relative' }}>
                  <MealCard meal={m} width={carouselCardWidth} />
                  <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                    <QuickAddButton meal={m} />
                  </View>
                </View>
              ))}
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
                    {fathersDayDaysLeft <= 0 ? 'Today — treat dad to something special' : `${fathersDayDaysLeft} day${fathersDayDaysLeft !== 1 ? 's' : ''} away — preorder now`}
                  </Text>
                </View>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, marginTop: 14 }}>
              {fathersDayPicks.map((m) => (
                <View key={m.id} style={{ position: 'relative' }}>
                  <MealCard meal={m} width={carouselCardWidth} />
                  <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                    <QuickAddButton meal={m} />
                  </View>
                </View>
              ))}
            </ScrollView>
            </MotiView>
          ) : null}

          {/* Fresh drops */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 180 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <SectionBadge label="fresh drops" color="#059669" Icon={Leaf} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12 }}>
            {isLoading
              ? [0, 1, 2, 3].map((i) => <CardSkeleton key={i} width={carouselCardWidth} />)
              : isError
              ? (
                <View style={{ paddingVertical: 16, paddingHorizontal: 4, gap: 10 }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Couldn't load meals.</Text>
                  <PressableScale onPress={() => { feedback.tap(); void handleRefresh(); }} accessibilityRole="button" accessibilityLabel="Retry loading fresh drops"
                    style={{ backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>retry</Text>
                  </PressableScale>
                </View>
              )
              : freshDrops.map((m) => (
                <View key={m.id} style={{ position: 'relative' }}>
                  <MealCard meal={m} width={carouselCardWidth} />
                  <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                    <QuickAddButton meal={m} />
                  </View>
                </View>
              ))}
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
