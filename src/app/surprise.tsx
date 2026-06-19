import { useRouter } from 'expo-router';
import { ChevronLeft, Compass, RefreshCw, Sparkles } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import {
  BudgetPicker,
  VibePicker,
  type VibeOption,
} from '@/components/surprise/preference-chips';
import {
  RevealError,
  RevealEmpty,
  RevealLoading,
  RevealResults,
} from '@/components/surprise/reveal-card';
import { pickMeals } from '@/components/surprise/scoring';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAddToCart } from '@/lib/queries/cart';
import { useSurpriseMeals, type SurpriseFilters } from '@/lib/queries/meals';
import { useMyOrders } from '@/lib/queries/orders';
import { useAuth } from '@/providers/auth-provider';

const INK = Palette.ink;

export default function SurpriseScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const addToCart = useAddToCart();

  const [budget, setBudget] = useState(15);
  const [vibe, setVibe] = useState<VibeOption | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [pickErr, setPickErr] = useState<string | null>(null);
  const [pickSeed, setPickSeed] = useState(0);

  // Extract user dietary prefs from metadata
  const meta = user?.user_metadata ?? {};
  const userDietary: string[] = Array.isArray(meta.dietary) ? (meta.dietary as string[]) : [];
  const userAllergies: string[] = Array.isArray(meta.allergies) ? (meta.allergies as string[]) : [];
  const userSpice: string = typeof meta.spice === 'string' ? (meta.spice as string) : '';
  const userCuisines: string[] = Array.isArray(meta.cuisines) ? (meta.cuisines as string[]) : [];

  // Order history for repeat-prepper affinity signal
  const { data: orders } = useMyOrders(user?.id);
  const orderedPreppers = useMemo(
    () => new Set((orders ?? []).filter((o) => o.status === 'completed').map((o) => o.prepper)),
    [orders],
  );

  const filters: SurpriseFilters = {
    maxPrice: budget > 0 ? budget : undefined,
    tags: vibe?.tag ? [vibe.tag] : undefined,
    categoryKey: vibe?.category ?? null,
  };

  const { data: pool, isLoading, isError, refetch } = useSurpriseMeals(filters, revealed);

  const pickResult = useMemo(() => {
    if (!pool?.length) return null;
    void pickSeed;
    return pickMeals(pool, userDietary, userAllergies, userSpice, userCuisines, orderedPreppers, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, pickSeed, userDietary.join(','), userAllergies.join(','), userSpice, userCuisines.join(','), orderedPreppers]);

  const picks = pickResult?.meals ?? null;
  const pickReasons = pickResult?.reasons ?? new Map<string, string>();
  const isPersonalized = pickResult?.personalized ?? false;

  function reveal() {
    feedback.tap();
    if (revealed) {
      setPickSeed((s) => s + 1);
      void refetch();
    } else {
      setRevealed(true);
    }
  }

  async function addPick(mealId: string, price: number) {
    feedback.tap();
    if (!user) {
      router.push('/auth?mode=signup');
      return;
    }
    setAddingId(mealId);
    setPickErr(null);
    try {
      await addToCart.mutateAsync({ userId: user.id, mealId, price, quantity: 1, replace: false });
      feedback.success();
      router.push('/cart');
    } catch {
      feedback.error();
      setPickErr('Could not add to cart. Please try again.');
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
            <PressableScale
              onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.8 }}>
                surprise me
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>
                let a local kitchen choose
              </Text>
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={22} color="#fff" />
            </View>
          </View>

          {/* Preference pickers */}
          <BudgetPicker
            budget={budget}
            onSelect={(v) => { setBudget(v); setRevealed(false); }}
          />
          <VibePicker
            vibe={vibe}
            onSelect={(v) => { setVibe(v); setRevealed(false); }}
          />

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
              {revealed ? (
                <RefreshCw size={16} color={Palette.brand} />
              ) : (
                <Sparkles size={16} color={Palette.brand} />
              )}
            </PressableScale>
          </View>

          {/* Results */}
          {revealed ? (
            isLoading ? (
              <RevealLoading />
            ) : isError ? (
              <RevealError onRetry={() => { feedback.tap(); void refetch(); }} />
            ) : !picks?.length ? (
              <RevealEmpty />
            ) : (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 200 }}>
                <RevealResults
                  picks={picks}
                  pickReasons={pickReasons}
                  isPersonalized={isPersonalized}
                  pickErr={pickErr}
                  addingId={addingId}
                  onAdd={addPick}
                />
              </MotiView>
            )
          ) : null}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
