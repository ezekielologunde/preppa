import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, UtensilsCrossed } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealCard } from '@/components/meal-card';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { useMealsByCategory } from '@/lib/queries/meals';

const ORANGE = '#f15f22';
const INK = '#111827';

export default function CategoryScreen() {
  const router = useRouter();
  const CARD_W = gridCardWidth(useContentWidth());
  const { key, label } = useLocalSearchParams<{ key?: string; label?: string }>();
  const { data: meals, isLoading } = useMealsByCategory(key);
  const title = (label || key || 'all meals').toString();

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F8' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <PressableScale onPress={() => router.back()} accessibilityLabel="Back" style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={24} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6 }}>{title}</Text>
        </View>

        {isLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 20 }}>
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} width={CARD_W} />)}
          </View>
        ) : meals && meals.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
              {meals.length} meal{meals.length === 1 ? '' : 's'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {meals.map((m) => <MealCard key={m.id} meal={m} width={CARD_W} />)}
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <UtensilsCrossed size={40} color="#d1d5db" />
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>no meals here yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#9ca3af', textAlign: 'center' }}>
              fresh {title} meals from local preppas are coming soon
            </Text>
            <PressableScale onPress={() => router.push('/explore')} style={{ marginTop: 8, backgroundColor: ORANGE, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>browse all meals</Text>
            </PressableScale>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
