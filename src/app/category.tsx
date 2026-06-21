import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, UtensilsCrossed } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuickAddButton } from '@/components/home-feed';
import { MealCard } from '@/components/meal-card';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { PressableScale } from '@/components/ui/pressable-scale';
import { feedback } from '@/lib/feedback';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useMealsByCategory } from '@/lib/queries/meals';

const ORANGE = Palette.brand;
const INK = Palette.ink;

export default function CategoryScreen() {
  const router = useRouter();
  const CARD_W = gridCardWidth(useContentWidth());
  const { key, label } = useLocalSearchParams<{ key?: string; label?: string }>();
  const { data: meals, isLoading, isError, refetch } = useMealsByCategory(key);
  const title = (label || key || 'all meals').toString();
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/explore'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6 }}>{title}</Text>
        </View>

        {isLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 20 }}>
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} width={CARD_W} />)}
          </View>
        ) : isError ? (
          <MotiView
            from={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <UtensilsCrossed size={40} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load meals</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading meals"
              style={{ marginTop: 8, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : meals && meals.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary, marginBottom: 14 }}>
              {meals.length} meal{meals.length === 1 ? '' : 's'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {meals.map((m, i) => (
                <MotiView key={m.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 210, delay: i * 30 }}>
                  <View style={{ position: 'relative' }}>
                    <MealCard meal={m} width={CARD_W} />
                    <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                      <QuickAddButton meal={m} />
                    </View>
                  </View>
                </MotiView>
              ))}
            </View>
          </ScrollView>
        ) : (
          <MotiView
            from={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <UtensilsCrossed size={40} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>no meals here yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>
              fresh {title} meals from local preppas are coming soon
            </Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/'); }} accessibilityRole="button" accessibilityLabel="Browse all meals" style={{ marginTop: 8, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>browse all meals</Text>
            </PressableScale>
          </MotiView>
        )}
      </SafeAreaView>
    </View>
  );
}
