import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Check, Plus, Star, UtensilsCrossed, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { Meal } from '@/components/meal-card';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { SectionHeader } from '@/components/home-extras';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';
import { useCarouselCardWidth, useContentWidth, usePagePadding, gridCardWidth } from '@/lib/layout';
import { useMealPlans } from '@/lib/queries/meal-plans';
import { useNewestMeals } from '@/lib/queries/meals';
import { useFollowedPreppers, useTopPreppers } from '@/lib/queries/preppers';
import { useAddToCart } from '@/lib/queries/cart';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const ACID = '#d8ff3e';
const ABS = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

const CHEF_PALETTES: [string, string][] = [
  ['#1a0a00', '#5c2a0f'],
  ['#0d1a1a', '#0f4040'],
  ['#1a1020', '#3d1a50'],
  ['#0d1a0d', '#1a4020'],
  ['#1a0d00', '#4a2800'],
  ['#0d0d1a', '#1a1a4a'],
];

const DIET_TAG: Record<string, { label: string; color: string }> = {
  vegan:     { label: 'Plant-Based', color: '#8B5CF6' },
  healthy:   { label: 'Clean',       color: '#22C55E' },
  breakfast: { label: 'Breakfast',   color: '#F59E0B' },
  lunch:     { label: 'Lunch',       color: '#06B6D4' },
  dinner:    { label: 'Dinner',      color: ORANGE },
};

// ─── QuickAddButton ───────────────────────────────────────────────────────────

export function QuickAddButton({ meal }: { meal: Meal }) {
  const router = useRouter();
  const { user } = useAuth();
  const addToCart = useAddToCart();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  function onAdd() {
    feedback.tap();
    if (!user) { router.push('/auth?mode=signup'); return; }
    if (addToCart.isPending || done) return;
    addToCart.mutate(
      { userId: user.id, mealId: meal.id, price: meal.price },
      {
        onSuccess: () => {
          feedback.success();
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        },
        onError: () => {
          feedback.error();
          setFailed(true);
          setTimeout(() => setFailed(false), 1800);
        },
      },
    );
  }

  return (
    <MotiView
      animate={{ scale: done ? 1.15 : 1, backgroundColor: done ? Palette.success : failed ? Palette.danger : ORANGE }}
      transition={{ type: 'spring', damping: 14, stiffness: 180 }}
      style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', ...Shadow.card }}>
      <PressableScale onPress={onAdd} accessibilityRole="button"
        accessibilityLabel={done ? 'Added to cart' : failed ? 'Failed — tap to retry' : `Add ${meal.title} to cart`}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {done ? <Check size={16} color="#fff" strokeWidth={2.5} />
          : failed ? <X size={16} color="#fff" strokeWidth={2.5} />
          : <Plus size={16} color="#fff" strokeWidth={2.5} />}
      </PressableScale>
    </MotiView>
  );
}

// ─── TrendingMealCard ─────────────────────────────────────────────────────────

function TrendingMealCard({
  meal, width, variant,
}: { meal: Meal; width: number | null; variant?: 'normal' | 'big' }) {
  const tag = meal.category ? DIET_TAG[meal.category] : undefined;
  const isBig = variant === 'big';
  return (
    <View style={width !== null ? { width } : undefined}>
      <View style={{ position: 'relative' }}>
        <MealCard meal={meal} width={width} variant={variant} />
        {!isBig ? (
          <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
            <QuickAddButton meal={meal} />
          </View>
        ) : null}
      </View>
      {/* Below-card row: diet tag + QuickAdd for both variants */}
      {isBig ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: tag ? 'space-between' : 'flex-end', paddingHorizontal: 6, paddingTop: 8, paddingBottom: 2 }}>
          {tag ? (
            <View style={{ backgroundColor: tag.color + '1E', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: tag.color }}>{tag.label}</Text>
            </View>
          ) : null}
          <QuickAddButton meal={meal} />
        </View>
      ) : tag ? (
        <View style={{ paddingHorizontal: 6, paddingTop: 5 }}>
          <View style={{
            alignSelf: 'flex-start', backgroundColor: tag.color + '1E',
            borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3,
          }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: tag.color }}>{tag.label}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─── TrendingSection ──────────────────────────────────────────────────────────

export function TrendingSection({
  meals, isLoading, isTablet,
}: { meals: Meal[] | undefined; isLoading: boolean; isTablet: boolean }) {
  const router = useRouter();
  const contentWidth = useContentWidth();
  const pad = usePagePadding();
  const carouselCardWidth = useCarouselCardWidth();
  const list = meals ?? [];
  const [hero, ...rest] = list;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 150 }}>
      <SectionHeader title="trending meals" linkLabel="see all →"
        onLink={() => { feedback.tap(); router.push('/search'); }} />
      {isLoading ? <CardRowSkeleton count={3} /> : isTablet ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: pad, paddingBottom: 4 }}>
          {list.map((m, i) => (
            <MotiView key={m.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 200, delay: i * 50 }}>
              <TrendingMealCard meal={m} width={gridCardWidth(contentWidth, pad)} />
            </MotiView>
          ))}
        </View>
      ) : (
        <>
          {hero ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 240 }}
              style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <TrendingMealCard meal={hero} width={null} variant="big" />
            </MotiView>
          ) : null}
          {rest.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
              {rest.map((m, i) => (
                <MotiView key={m.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                  <TrendingMealCard meal={m} width={carouselCardWidth} />
                </MotiView>
              ))}
            </ScrollView>
          ) : null}
        </>
      )}
    </MotiView>
  );
}

// ─── ChefsInActionFeed ────────────────────────────────────────────────────────

export function ChefsInActionFeed() {
  const router = useRouter();
  const { data: preppers, isLoading } = useTopPreppers(6);
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6, delay: 100 }}
      style={{ marginTop: 24 }}>
      <SectionHeader title="chefs in action" linkLabel="see all →"
        onLink={() => { feedback.tap(); router.push('/explore'); }} />
      {isLoading ? <CardRowSkeleton count={4} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }}>
          {(preppers ?? []).map((prepper, i) => {
            const palette = CHEF_PALETTES[i % CHEF_PALETTES.length];
            return (
              <MotiView key={prepper.id} from={{ opacity: 0, translateX: 16 }} animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6, delay: i * 50 }}>
                <PressableScale
                  onPress={() => { feedback.tap(); router.push(`/prepper?id=${prepper.id}`); }}
                  accessibilityRole="button" accessibilityLabel={prepper.name}
                  style={{ width: 130, height: 210, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
                  {prepper.image
                    ? <Image source={{ uri: imgUrl(prepper.image, 400) }} style={ABS} contentFit="cover" />
                    : <LinearGradient colors={palette} style={ABS} />}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']}
                    style={{ ...ABS, justifyContent: 'flex-end', padding: 10 }}>
                    <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 13, color: '#fff' }}>
                      {prepper.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <Star size={11} color="#FFD24A" fill="#FFD24A" />
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                        {prepper.rating > 0 ? prepper.rating.toFixed(1) : 'new'}
                      </Text>
                    </View>
                  </LinearGradient>
                  {prepper.reviews === 0 ? (
                    <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: ACID, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 9.5, color: '#1a1a0a', letterSpacing: 0.5 }}>NEW</Text>
                    </View>
                  ) : null}
                </PressableScale>
              </MotiView>
            );
          })}
        </ScrollView>
      )}
    </MotiView>
  );
}

// ─── FollowingKitchensSection ─────────────────────────────────────────────────

export function FollowingKitchensSection({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: preppers } = useFollowedPreppers(userId);
  if (!preppers?.length) return null;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 100 }}>
      <SectionHeader title="kitchens you follow" linkLabel="see all →"
        onLink={() => { feedback.tap(); router.push('/following'); }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
        {preppers.map((prepper, i) => (
          <MotiView key={prepper.id} from={{ opacity: 0, translateX: 10 }} animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
            <PrepperCard prepper={prepper} />
          </MotiView>
        ))}
      </ScrollView>
    </MotiView>
  );
}

// ─── FreshDropsSection ────────────────────────────────────────────────────────

export function FreshDropsSection() {
  const router = useRouter();
  const { data: meals, isLoading } = useNewestMeals(8);
  const carouselCardWidth = useCarouselCardWidth();
  if (!isLoading && (!meals || meals.length === 0)) return null;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 100 }}>
      <SectionHeader title="just dropped" linkLabel="see all →"
        onLink={() => { feedback.tap(); router.push('/explore'); }} />
      {isLoading ? <CardRowSkeleton count={3} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {(meals ?? []).map((meal, i) => (
            <MotiView key={meal.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <TrendingMealCard meal={meal} width={carouselCardWidth} />
            </MotiView>
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}

// ─── MealPlansDiscoverySection ────────────────────────────────────────────────

export function MealPlansDiscoverySection() {
  const router = useRouter();
  const { data: plans, isLoading } = useMealPlans();
  if (!isLoading && (!plans || plans.length === 0)) return null;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 150 }}>
      <SectionHeader title="meal plans" linkLabel="explore →"
        onLink={() => { feedback.tap(); router.push('/meal-plans'); }} />
      {isLoading ? <CardRowSkeleton count={3} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {(plans ?? []).map((plan, i) => (
            <MotiView key={plan.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push(`/meal-plans?openPlanId=${plan.id}` as never); }}
                accessibilityRole="button"
                accessibilityLabel={`${plan.name} by ${plan.prepper}, $${plan.price} per ${plan.frequency}`}
                style={{ width: 190, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
                <View style={{ height: 100, backgroundColor: Palette.brandTint }}>
                  {plan.image_url
                    ? <Image source={{ uri: plan.image_url }} style={{ flex: 1 }} contentFit="cover" transition={200} />
                    : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><UtensilsCrossed size={32} color={ORANGE} /></View>}
                </View>
                <View style={{ padding: 12, gap: 4 }}>
                  <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{plan.name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{plan.prepper}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>${plan.price.toFixed(0)}/{plan.frequency}</Text>
                    {plan.tags?.length ? (
                      <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted, flex: 1, textAlign: 'right' }}>
                        {plan.tags[0]}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </PressableScale>
            </MotiView>
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}
