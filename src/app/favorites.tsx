import { useRouter } from 'expo-router';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealCard } from '@/components/meal-card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useFavoriteKeys } from '@/lib/favorites';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { useMeal } from '@/lib/queries/meals';

const ORANGE = Palette.brand;
const INK = Palette.ink;

function MealByIdCard({ id, width }: { id: string; width: number }) {
  const { data: meal, isLoading } = useMeal(id);
  if (isLoading || !meal) return <CardSkeleton width={width} />;
  return <MealCard meal={meal} width={width} />;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const allKeys = useFavoriteKeys();
  const mealIds = allKeys.filter((k) => k.startsWith('meal:')).map((k) => k.replace('meal:', ''));
  const CARD_W = gridCardWidth(useContentWidth());

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
          <PressableScale
            onPress={() => { feedback.tap(); try { router.back(); } catch { router.replace('/profile'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.7 }}>favorites</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>
              {mealIds.length > 0 ? `${mealIds.length} meal${mealIds.length !== 1 ? 's' : ''}` : 'nothing hearted yet'}
            </Text>
          </View>
        </View>

        {mealIds.length === 0 ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={28} color={Palette.danger} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK }}>no favorites yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
              Tap the heart on any meal to save it here for quick access.
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/explore'); }}
              accessibilityRole="button"
              accessibilityLabel="Browse meals"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>browse meals</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {mealIds.map((id, i) => (
              <MotiView key={id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 210, delay: i * 25 }}>
                <MealByIdCard id={id} width={CARD_W} />
              </MotiView>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
