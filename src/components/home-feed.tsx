import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CalendarCheck, Check, Flame, Plus, Sparkles, Star, TrendingUp, UtensilsCrossed, X, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { Meal } from '@/components/meal-card';
import { MealCard } from '@/components/meal-card';
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
import { useMyFollowIds, useTopPreppers } from '@/lib/queries/preppers';
import { useFollowingFeed, type FeedItem } from '@/lib/queries/feed';
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
  breakfast: { label: 'Breakfast',   color: Palette.amber },
  lunch:     { label: 'Lunch',       color: '#06B6D4' },
  dinner:    { label: 'Dinner',      color: ORANGE },
};

// ─── QuickAddButton ───────────────────────────────────────────────────────────

export function QuickAddButton({ meal, pill = false }: { meal: Meal; pill?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const addToCart = useAddToCart();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  function onAdd() {
    feedback.tap();
    if (meal.inStock === false) return;
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

  const soldOut = meal.inStock === false;
  const bgColor = soldOut ? Palette.border : done ? Palette.success : failed ? Palette.danger : ORANGE;
  const label = soldOut ? `${meal.title} is sold out` : done ? 'Added to cart' : failed ? 'Failed — tap to retry' : `Add ${meal.title} to cart`;

  if (pill) {
    return (
      <MotiView
        animate={{ backgroundColor: bgColor }}
        transition={{ type: 'spring', damping: 18, stiffness: 220 }}
        style={{ height: 38, borderRadius: 19, paddingHorizontal: 16, minWidth: 116, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
        <PressableScale onPress={onAdd} haptic={false} accessibilityLabel={label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {done ? <Check size={14} color="#fff" strokeWidth={2.5} />
            : failed ? <X size={14} color="#fff" strokeWidth={2.5} />
            : soldOut ? null
            : <Plus size={15} color="#fff" strokeWidth={2.5} />}
          <Text style={{ fontFamily: Font.heading, fontSize: 13, color: soldOut ? Palette.textSecondary : '#fff', letterSpacing: -0.1 }}>
            {soldOut ? 'sold out' : done ? 'added!' : failed ? 'retry' : 'add to cart'}
          </Text>
        </PressableScale>
      </MotiView>
    );
  }

  return (
    <MotiView
      animate={{ backgroundColor: bgColor }}
      transition={{ type: 'spring', damping: 18, stiffness: 220 }}
      style={{ height: 38, borderRadius: 19, paddingHorizontal: 10, minWidth: 68, alignItems: 'center', justifyContent: 'center' }}>
      <PressableScale onPress={onAdd} haptic={false} accessibilityLabel={label}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {done ? <Check size={13} color="#fff" strokeWidth={2.5} />
          : failed ? <X size={13} color="#fff" strokeWidth={2.5} />
          : soldOut ? null
          : <Plus size={13} color="#fff" strokeWidth={2.5} />}
        <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: soldOut ? Palette.textSecondary : '#fff', letterSpacing: -0.1 }}>
          {soldOut ? 'sold out' : done ? 'added' : failed ? 'retry' : 'add'}
        </Text>
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
      <MealCard meal={meal} width={width} variant={variant} />
      {/* Below-card row: diet tag + QuickAdd for hero (big) cards only */}
      {isBig ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: tag ? 'space-between' : 'flex-end', paddingHorizontal: 6, paddingTop: 8, paddingBottom: 2 }}>
          {tag ? (
            <View style={{ backgroundColor: tag.color + '1E', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: tag.color }}>{tag.label}</Text>
            </View>
          ) : null}
          <QuickAddButton meal={meal} pill />
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

  if (!isLoading && list.length === 0) return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 32, marginBottom: 12 }}>🍳</Text>
      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink, marginBottom: 8, textAlign: 'center' }}>
        No meals near you yet
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
        Local chefs are joining. Check back soon or explore kitchens from anywhere.
      </Text>
    </View>
  );

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 150 }}>
      <SectionHeader title="trending meals" linkLabel="see all →" Icon={TrendingUp}
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
            <View style={{ position: 'relative' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
                {rest.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                    <TrendingMealCard meal={m} width={carouselCardWidth} />
                  </MotiView>
                ))}
              </ScrollView>
              <LinearGradient
                colors={['transparent', Palette.canvas]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, pointerEvents: 'none' }}
              />
            </View>
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

  if (!isLoading && (!preppers || preppers.length === 0)) return null;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6, delay: 100 }}
      style={{ marginTop: 24 }}>
      <SectionHeader title="chefs in action" linkLabel="see all →" Icon={Flame}
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
                      {prepper.name.split(' ')[0]}
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

function FollowingDropCard({ item }: { item: FeedItem }) {
  const router = useRouter();
  const dest = item.isPost
    ? (`/prepper?id=${item.prepper_id}` as never)
    : (`/meal?id=${item.id}` as never);
  return (
    <PressableScale
      onPress={() => { feedback.tap(); router.push(dest); }}
      accessibilityRole="button"
      accessibilityLabel={item.title || item.prepper}
      style={{ width: 140, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      <View style={{ width: 140, height: 110, backgroundColor: Palette.border }}>
        {(item.thumbnail || item.image)
          ? <Image source={{ uri: imgUrl(item.thumbnail || item.image, 280) }} style={{ flex: 1 }} contentFit="cover" transition={200} />
          : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><UtensilsCrossed size={28} color={Palette.textSecondary} /></View>}
      </View>
      <View style={{ padding: 8, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 12.5, color: INK }}>{item.title || 'post'}</Text>
        <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary }}>{item.prepper}</Text>
      </View>
    </PressableScale>
  );
}

export function FollowingKitchensSection({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: followIds } = useMyFollowIds(userId);
  const { data: followingFeed, isLoading } = useFollowingFeed(userId);
  const hasFollows = (followIds?.length ?? 0) > 0;
  const items = (followingFeed ?? []).slice(0, 6);

  if (!hasFollows) return null;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 100 }}>
      <SectionHeader title="from kitchens you follow" Icon={Sparkles} />
      {isLoading ? <CardRowSkeleton count={3} width={140} /> : items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {items.map((item, i) => (
            <MotiView key={item.id} from={{ opacity: 0, translateX: 10 }} animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <FollowingDropCard item={item} />
            </MotiView>
          ))}
        </ScrollView>
      ) : (
        <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
            No recent drops from your kitchens.
          </Text>
        </View>
      )}
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
      <SectionHeader title="just dropped" linkLabel="see all →" Icon={Zap}
        onLink={() => { feedback.tap(); router.push('/explore'); }} />
      {isLoading ? <CardRowSkeleton count={3} /> : (
        <View style={{ position: 'relative' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
            {(meals ?? []).map((meal, i) => (
              <MotiView key={meal.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                <TrendingMealCard meal={meal} width={carouselCardWidth} />
              </MotiView>
            ))}
          </ScrollView>
          <LinearGradient
            colors={['transparent', Palette.canvas]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, pointerEvents: 'none' }}
          />
        </View>
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
      <SectionHeader title="meal plans" linkLabel="explore →" Icon={CalendarCheck}
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
                  <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{plan.prepper}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>${plan.price.toFixed(0)}/{plan.frequency}</Text>
                    {plan.tags?.length ? (
                      <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, flex: 1, textAlign: 'right' }}>
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
