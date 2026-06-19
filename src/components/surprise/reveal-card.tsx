import { Compass } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ActivityIndicator, Text, View } from 'react-native';

import type { Meal } from '@/components/meal-card';
import { MealCard } from '@/components/meal-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { ShoppingCart } from 'lucide-react-native';

// ─── RevealLoading ────────────────────────────────────────────────────────────

export function RevealLoading() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
      <ActivityIndicator color={Palette.brand} size="large" />
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, marginTop: 12 }}>
        finding your perfect meal…
      </Text>
    </View>
  );
}

// ─── RevealError ──────────────────────────────────────────────────────────────

export interface RevealErrorProps {
  onRetry: () => void;
}

export function RevealError({ onRetry }: RevealErrorProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260 }}
      style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 32, gap: 12 }}>
      <Compass size={32} color={Palette.textMuted} />
      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>
        Couldn't fetch picks
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
        Check your connection and tap retry.
      </Text>
      <PressableScale
        onPress={() => { feedback.tap(); onRetry(); }}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        style={{ backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
      </PressableScale>
    </MotiView>
  );
}

// ─── RevealEmpty ──────────────────────────────────────────────────────────────

export function RevealEmpty() {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260 }}
      style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 32, gap: 10 }}>
      <Compass size={32} color={Palette.textMuted} />
      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>
        No matches found
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
        Try a higher budget or different vibe — preppers add new meals every week.
      </Text>
    </MotiView>
  );
}

// ─── RevealResults ────────────────────────────────────────────────────────────

export interface RevealResultsProps {
  picks: Meal[];
  pickReasons: Map<string, string>;
  isPersonalized: boolean;
  pickErr: string | null;
  addingId: string | null;
  onAdd: (mealId: string, price: number) => void;
}

export function RevealResults({
  picks,
  pickReasons,
  isPersonalized,
  pickErr,
  addingId,
  onAdd,
}: RevealResultsProps) {
  const headerSubtitle = isPersonalized
    ? 'matched to your taste'
    : "feeling adventurous? here's what's good today";

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 300 }}
        style={{ marginBottom: pickErr ? 6 : 14 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>
          {picks.length === 1 ? "here's your pick" : `here's ${picks.length} options`}
        </Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: isPersonalized ? Palette.brand : Palette.textMuted, marginTop: 2 }}>
          {headerSubtitle}
        </Text>
      </MotiView>

      {pickErr ? (
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.danger, marginBottom: 10 }}>
          {pickErr}
        </Text>
      ) : null}

      <View style={{ gap: 16 }}>
        {picks.map((meal, i) => {
          const reason = pickReasons.get(meal.id);
          return (
            <MotiView
              key={meal.id}
              from={{ opacity: 0, translateY: 14, scale: 0.97 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              transition={{ type: 'timing', duration: 280, delay: i * 45 }}
              style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <MealCard meal={meal} width={null} />
                </View>
                <PressableScale
                  onPress={() => onAdd(meal.id, meal.price)}
                  disabled={addingId === meal.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${meal.title} to cart`}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: Palette.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                    opacity: addingId === meal.id ? 0.6 : 1,
                  }}>
                  {addingId === meal.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <ShoppingCart size={18} color="#fff" />
                  )}
                </PressableScale>
              </View>
              {reason ? (
                <View style={{
                  alignSelf: 'flex-start',
                  backgroundColor: Palette.brand + '18',
                  borderRadius: Radius.pill,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  marginLeft: 2,
                }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.brand }}>
                    ✦ {reason}
                  </Text>
                </View>
              ) : null}
            </MotiView>
          );
        })}
      </View>
    </View>
  );
}
