import { Alert } from 'react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';

import { QuickAddButton } from '@/components/home-feed';
import type { Meal } from '@/components/meal-card';
import { MealCard } from '@/components/meal-card';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { gridCardWidth } from '@/lib/layout';

type Props = {
  prepperFirstName: string | undefined;
  meals: Meal[];
  isLoading: boolean;
  activeTag: string;
  mealTags: string[];
  filteredMeals: Meal[];
  cardW: ReturnType<typeof gridCardWidth>;
  onTagChange: (tag: string) => void;
  kitchenClosed?: boolean;
};

export function KitchenMealGrid({ prepperFirstName, meals, isLoading, activeTag, mealTags, filteredMeals, cardW, onTagChange, kitchenClosed = false }: Props) {
  function handleClosedTap() {
    feedback.tap();
    Alert.alert('Kitchen closed', 'This kitchen is currently closed. You can save this meal for later.');
  }

  return (
    <>
      {/* Meals section header */}
      <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.4, marginHorizontal: 20, marginTop: 24, marginBottom: 10 }}>
        {prepperFirstName ? `${prepperFirstName}'s menu` : 'Available meals'}
      </Text>

      {/* Category filter chips */}
      {mealTags.length > 1 && !isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
          {mealTags.map((tag) => {
            const active = activeTag === tag;
            return (
              <PressableScale
                key={tag}
                onPress={() => { feedback.tap(); onTagChange(tag); }}
                accessibilityRole="button"
                accessibilityLabel={active ? `${tag}, selected` : tag}
                style={{
                  height: 34,
                  paddingHorizontal: 14,
                  borderRadius: Radius.pill,
                  backgroundColor: active ? Palette.brand : Palette.surface,
                  borderWidth: 1,
                  borderColor: active ? Palette.brand : Palette.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : Palette.inkSoft }}>
                  {tag}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Meal grid */}
      {isLoading ? (
        <CardRowSkeleton count={3} />
      ) : !meals.length ? (
        <MotiView
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 180 }}
          style={{ marginHorizontal: 16, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 28, alignItems: 'center', gap: 12 }}>
          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28 }}>🍽️</Text>
          </View>
          <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink, textAlign: 'center' }}>Nothing on the menu yet</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 21, maxWidth: 260 }}>
            {`${prepperFirstName ?? 'This kitchen'} is getting their menu ready — follow them so you're first to know when they drop.`}
          </Text>
        </MotiView>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 }}>
          {filteredMeals.map((m, i) => (
            <MotiView key={m.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 210, delay: i * 40 }}>
              <View style={{ position: 'relative', opacity: kitchenClosed ? 0.7 : 1 }}>
                {kitchenClosed ? (
                  <PressableScale onPress={handleClosedTap} accessibilityRole="button" accessibilityLabel={`${m.title} — kitchen closed`}>
                    <MealCard meal={m} width={cardW} />
                  </PressableScale>
                ) : (
                  <MealCard meal={m} width={cardW} />
                )}
                {!kitchenClosed ? (
                  <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                    <QuickAddButton meal={m} />
                  </View>
                ) : null}
              </View>
            </MotiView>
          ))}
        </View>
      )}
    </>
  );
}
