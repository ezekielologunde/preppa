import { useRouter } from 'expo-router';
import { ChevronLeft, Clock } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuickAddButton } from '@/components/home-feed';
import { MealCard } from '@/components/meal-card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { clearRecentlyViewed, useRecentlyViewedIds } from '@/lib/recently-viewed';
import { useMealsByIds } from '@/lib/queries/meals';

const ORANGE = Palette.brand;
const INK = Palette.ink;

export default function RecentlyViewedScreen() {
  const router = useRouter();
  const ids = useRecentlyViewedIds();
  const CARD_W = gridCardWidth(useContentWidth());
  const visible = ids.slice(0, 20);
  const { data: meals, isLoading, isError, refetch } = useMealsByIds(visible);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.7 }}>recently viewed</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>
              {visible.length > 0 ? `${visible.length} meal${visible.length !== 1 ? 's' : ''}` : 'nothing here yet'}
            </Text>
          </View>
          {visible.length > 0 ? (
            <PressableScale onPress={() => { feedback.tap(); clearRecentlyViewed(); }} accessibilityRole="button" accessibilityLabel="Clear history" style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Palette.surface }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.textSecondary }}>clear</Text>
            </PressableScale>
          ) : null}
        </View>

        {isLoading && visible.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {visible.map((id) => <CardSkeleton key={id} width={CARD_W} />)}
          </ScrollView>
        ) : visible.length === 0 ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.success + '1A', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={28} color={Palette.success} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK }}>no meals browsed yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
              Meals you view will show up here so you can easily find them again.
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/'); }}
              accessibilityRole="button"
              accessibilityLabel="Browse meals"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>browse meals</Text>
            </PressableScale>
          </MotiView>
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={28} color={Palette.textSecondary} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load meals</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading recently viewed"
              style={{ marginTop: 4, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {(meals ?? []).map((meal, i) => (
              <MotiView key={meal.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 210, delay: i * 25 }}>
                <View style={{ position: 'relative' }}>
                  <MealCard meal={{ ...meal, image: meal.images?.[0] ?? '' }} width={CARD_W} />
                  <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                    <QuickAddButton meal={{ ...meal, image: meal.images?.[0] ?? '' }} />
                  </View>
                </View>
              </MotiView>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
