import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import type { TopMeal } from '@/lib/queries/analytics';

type Props = { meals: TopMeal[] };

const RANK_COLORS = [Palette.amber, '#94a3b8', '#b45309', Palette.textMuted, Palette.textMuted];

export function TopMealsList({ meals }: Props) {
  const router = useRouter();

  if (!meals.length) {
    return (
      <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted }}>
        Complete preorders to see which meals perform best.
      </Text>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {meals.map((meal, i) => {
        const rankColor = RANK_COLORS[i] ?? Palette.textMuted;
        return (
          <PressableScale
            key={meal.mealId}
            onPress={() => { feedback.tap(); router.push(`/meal-editor?id=${meal.mealId}`); }}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${meal.title}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            {/* Rank */}
            <Text style={{ fontFamily: Font.display, fontSize: 16, color: rankColor, width: 24, textAlign: 'center' }}>
              {i + 1}
            </Text>

            {/* Thumbnail */}
            {meal.imageUrl ? (
              <Image
                source={{ uri: meal.imageUrl }}
                style={{ width: 48, height: 48, borderRadius: Radius.sm ?? 10 }}
                contentFit="cover"
                transition={180}
              />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: Palette.brand + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.display, fontSize: 20 }}>🍽</Text>
              </View>
            )}

            {/* Title + order count */}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }} numberOfLines={1}>
                {meal.title}
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted }}>
                {meal.orderCount} {meal.orderCount === 1 ? 'order' : 'orders'}
              </Text>
            </View>

            {/* Revenue */}
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand, fontVariant: ['tabular-nums'] }}>
              ${meal.revenue.toFixed(0)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
