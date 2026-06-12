import { useRouter } from 'expo-router';
import { ChevronLeft, Compass, RefreshCw, ShoppingCart, Sparkles } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealCard } from '@/components/meal-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAddToCart } from '@/lib/queries/cart';
import { useSurpriseMeals, type SurpriseFilters } from '@/lib/queries/meals';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

const BUDGET_OPTIONS = [
  { label: 'Under $10', value: 10 },
  { label: 'Under $15', value: 15 },
  { label: 'Under $20', value: 20 },
  { label: 'Under $25', value: 25 },
  { label: 'Any budget', value: 0 },
];

const VIBE_OPTIONS = [
  { label: 'High Protein', tag: 'High-Protein', color: '#ef4444' },
  { label: 'Vegan', tag: 'Vegan-Friendly', color: '#22c55e' },
  { label: 'Comfort Food', tag: 'Comfort', color: '#f59e0b' },
  { label: 'Keto', tag: 'Keto', color: '#8b5cf6' },
  { label: 'Family', tag: 'Family Meals', color: '#3b82f6' },
  { label: 'Breakfast', category: 'breakfast', color: '#f97316' },
  { label: 'Light & Clean', tag: 'Low-Calorie', color: '#06b6d4' },
  { label: 'Spicy', tag: 'Spicy', color: '#ef4444' },
];

function Chip({ label, color, active, onPress }: { label: string; color: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: active ? color + '22' : Palette.surface, borderWidth: 1.5, borderColor: active ? color : Palette.border, ...Shadow.card }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: active ? color : Palette.textSecondary }}>{label}</Text>
    </PressableScale>
  );
}

export default function SurpriseScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const addToCart = useAddToCart();

  const [budget, setBudget] = useState(15);
  const [vibe, setVibe] = useState<typeof VIBE_OPTIONS[0] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const filters: SurpriseFilters = {
    maxPrice: budget > 0 ? budget : undefined,
    tags: vibe?.tag ? [vibe.tag] : undefined,
    categoryKey: vibe?.category ?? null,
  };

  const { data: picks, isLoading, refetch } = useSurpriseMeals(filters, revealed);

  function reveal() {
    feedback.tap();
    setRevealed(true);
    if (revealed) refetch();
  }

  async function addPick(mealId: string, price: number) {
    feedback.tap();
    if (!user) { router.push('/auth?mode=signup'); return; }
    setAddingId(mealId);
    feedback.success();
    try {
      await addToCart.mutateAsync({ userId: user.id, mealId, price, quantity: 1, replace: false });
      router.push('/cart');
    } finally {
      setAddingId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
            <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.8 }}>surprise me</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>let a local chef decide</Text>
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={22} color="#fff" />
            </View>
          </View>

          {/* Budget picker */}
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, marginBottom: 12 }}>budget</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BUDGET_OPTIONS.map((b) => (
                <Chip
                  key={b.value}
                  label={b.label}
                  color={ORANGE}
                  active={budget === b.value}
                  onPress={() => { feedback.tap(); setBudget(b.value); setRevealed(false); }}
                />
              ))}
            </View>
          </View>

          {/* Vibe picker */}
          <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, marginBottom: 12 }}>
              vibe <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted }}>(optional)</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {VIBE_OPTIONS.map((v) => (
                <Chip
                  key={v.label}
                  label={v.label}
                  color={v.color}
                  active={vibe?.label === v.label}
                  onPress={() => { feedback.tap(); setVibe(vibe?.label === v.label ? null : v); setRevealed(false); }}
                />
              ))}
            </View>
          </View>

          {/* CTA */}
          <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
            <PressableScale
              onPress={reveal}
              accessibilityRole="button"
              accessibilityLabel="Surprise me"
              style={{ height: 56, borderRadius: Radius.lg, backgroundColor: INK, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Compass size={20} color="#fff" />
              <Text style={{ fontFamily: Font.display, fontSize: 17, color: '#fff', letterSpacing: -0.3 }}>
                {revealed ? 'try again' : 'surprise me'}
              </Text>
              {revealed ? <RefreshCw size={16} color={ORANGE} /> : <Sparkles size={16} color={ORANGE} />}
            </PressableScale>
          </View>

          {/* Results */}
          {revealed ? (
            isLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <ActivityIndicator color={ORANGE} size="large" />
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, marginTop: 12 }}>finding your perfect meal…</Text>
              </View>
            ) : !picks?.length ? (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 260 }}
                style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 32, gap: 10 }}>
                <Compass size={32} color={Palette.textMuted} />
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>No matches found</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>Try a higher budget or different vibe — preppers add new meals every week.</Text>
              </MotiView>
            ) : (
              <View style={{ paddingHorizontal: 20 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, marginBottom: 14 }}>
                  {picks.length === 1 ? "here's your pick" : `here's ${picks.length} options`}
                </Text>
                <View style={{ gap: 16 }}>
                  {picks.map((meal, i) => (
                    <MotiView
                      key={meal.id}
                      from={{ opacity: 0, translateY: 14, scale: 0.97 }}
                      animate={{ opacity: 1, translateY: 0, scale: 1 }}
                      transition={{ type: 'timing', duration: 280, delay: i * 45 }}
                      style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <MealCard meal={meal} width={null} />
                      </View>
                      <PressableScale
                        onPress={() => addPick(meal.id, meal.price)}
                        disabled={addingId === meal.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${meal.title} to cart`}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 8, opacity: addingId === meal.id ? 0.6 : 1 }}>
                        {addingId === meal.id ? <ActivityIndicator color="#fff" size="small" /> : <ShoppingCart size={18} color="#fff" />}
                      </PressableScale>
                    </MotiView>
                  ))}
                </View>
              </View>
            )
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
