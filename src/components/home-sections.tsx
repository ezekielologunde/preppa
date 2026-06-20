import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Flame, History, MapPin, Sparkles, Star, Trophy } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';

import { MealCard } from '@/components/meal-card';
import { SectionHeader } from '@/components/home-extras';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';
import { useCarouselCardWidth } from '@/lib/layout';
import { useForYouMeals, useMealsByIds, type TrendingMeal, useTrendingNowMeals } from '@/lib/queries/meals';
import { useUserPrefs } from '@/lib/queries/user-prefs';
import { useFeaturedKitchens, type FeaturedKitchen } from '@/lib/queries/featured';
import { useTodayStock } from '@/lib/queries/stock';
import { clearRecentlyViewed, useRecentlyViewedIds } from '@/lib/recently-viewed';
import type { Meal } from '@/components/meal-card';

const ORANGE = Palette.brand;
const INK = Palette.ink;

// ─── FeaturedKitchensSection ──────────────────────────────────────────────────

function FeaturedKitchenCard({ kitchen }: { kitchen: FeaturedKitchen }) {
  const router = useRouter();
  const cover = kitchen.coverUrl ?? kitchen.avatarUrl;
  return (
    <PressableScale
      onPress={() => { feedback.tap(); router.push(`/prepper?id=${kitchen.id}`); }}
      accessibilityRole="button"
      accessibilityLabel={kitchen.displayName}
      style={{ width: 155, height: 160, borderRadius: 18, overflow: 'hidden', backgroundColor: Palette.surface, ...Shadow.card }}>
      <View style={{ width: 155, height: 105, backgroundColor: Palette.border }}>
        {cover ? (
          <Image source={{ uri: imgUrl(cover, 310) }} style={{ flex: 1 }} contentFit="cover" transition={200} />
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 10, paddingTop: 7, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>{kitchen.displayName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {kitchen.rating != null ? (
            <>
              <Star size={10} color={Palette.amber} fill={Palette.amber} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.inkSoft }}>{kitchen.rating.toFixed(1)}</Text>
              {kitchen.city ? <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary }}>·</Text> : null}
            </>
          ) : null}
          {kitchen.city ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 }}>
              <MapPin size={9} color={Palette.textSecondary} />
              <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, flex: 1 }}>{kitchen.city}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

export function FeaturedKitchensSection() {
  const { data: featured, isLoading } = useFeaturedKitchens();

  if (!isLoading && (!featured || featured.length === 0)) return null;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 60 }}>
      <SectionHeader title="featured kitchens" Icon={Trophy} />
      {isLoading ? <CardRowSkeleton count={3} width={155} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {(featured ?? []).map((kitchen, i) => (
            <MotiView key={kitchen.id} from={{ opacity: 0, translateX: 10 }} animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 220, delay: i * 45 }}>
              <FeaturedKitchenCard kitchen={kitchen} />
            </MotiView>
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}

// ─── RecentlyViewedSection ────────────────────────────────────────────────────

function RecentlyViewedCard({ meal }: { meal: Meal }) {
  const router = useRouter();
  const img = meal.images?.length ? meal.images[0] : meal.image;
  return (
    <PressableScale
      onPress={() => { feedback.tap(); router.push(`/meal?id=${meal.id}`); }}
      accessibilityRole="button"
      accessibilityLabel={meal.title}
      style={{ width: 120, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      <View style={{ width: 120, height: 90, backgroundColor: Palette.border }}>
        {img ? (
          <Image source={{ uri: imgUrl(img, 240) }} style={{ flex: 1 }} contentFit="cover" transition={200} />
        ) : null}
      </View>
      <View style={{ padding: 7, gap: 2 }}>
        <Text numberOfLines={2} style={{ fontFamily: Font.heading, fontSize: 11.5, color: INK, lineHeight: 15 }}>
          {meal.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Star size={10} color={Palette.amber} fill={Palette.amber} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: Palette.inkSoft }}>
            {meal.rating.toFixed(1)}
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 10, color: Palette.textSecondary }}>
            · ${meal.price.toFixed(0)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

export function RecentlyViewedSection() {
  const ids = useRecentlyViewedIds();
  const { data: meals, refetch } = useMealsByIds(ids.slice(0, 10));

  // Only show once 2+ meals have been viewed
  if (ids.length < 2) return null;

  function handleClear() {
    feedback.tap();
    clearRecentlyViewed();
    refetch();
  }

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 80 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 12, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <History size={18} color={ORANGE} />
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }}>recently viewed</Text>
        </View>
        <PressableScale onPress={handleClear} accessibilityRole="button" accessibilityLabel="Clear recently viewed"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary }}>clear</Text>
        </PressableScale>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }}>
        {(meals ?? []).map((meal, i) => (
          <MotiView key={meal.id} from={{ opacity: 0, translateX: 10 }} animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 200, delay: i * 45 }}>
            <RecentlyViewedCard meal={meal} />
          </MotiView>
        ))}
      </ScrollView>
    </MotiView>
  );
}

// ─── ForYouSection ────────────────────────────────────────────────────────────

export function ForYouSection({ userId, firstName }: { userId?: string | null; firstName?: string | null }) {
  const router = useRouter();
  const { data: prefs } = useUserPrefs(userId);
  const { data: rawMeals, isLoading } = useForYouMeals(userId, prefs);
  const cardWidth = useCarouselCardWidth();
  const mealIds = (rawMeals ?? []).map((m) => m.id);
  const { data: stockMap = {} } = useTodayStock(mealIds);
  const meals = (rawMeals ?? []).map((m) => ({ ...m, stockRemaining: stockMap[m.id]?.qtyRemaining ?? null }));

  const title = firstName ? `for you, ${firstName}` : 'for you';
  const hasPrefs = (prefs?.dietary.length ?? 0) > 0 || (prefs?.cuisines.length ?? 0) > 0;

  if (!isLoading && meals.length === 0) return null;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 100 }}>
      <SectionHeader title={title} linkLabel="see all →" Icon={Sparkles}
        onLink={() => { feedback.tap(); router.push('/explore'); }} />
      {hasPrefs ? (
        <Text style={{
          fontFamily: Font.body,
          fontSize: 11,
          color: Palette.textSecondary,
          paddingHorizontal: 20,
          marginTop: -10,
          marginBottom: 10,
        }}>
          based on your preferences
        </Text>
      ) : null}
      {isLoading ? <CardRowSkeleton count={3} width={cardWidth} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {meals.map((meal, i) => (
            <MotiView key={meal.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <MealCard meal={meal} width={cardWidth} />
            </MotiView>
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}

// ─── TrendingNowSection ───────────────────────────────────────────────────────

function OrderBadge({ count }: { count: number }) {
  return (
    <View style={{
      position: 'absolute', bottom: 8, left: 8,
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: Radius.pill,
      paddingHorizontal: 7, paddingVertical: 3,
    }}>
      <Flame size={11} color="#ff6b35" fill="#ff6b35" />
      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff', letterSpacing: -0.1 }}>
        {count} orders
      </Text>
    </View>
  );
}

function TrendingNowCard({ meal, width }: { meal: TrendingMeal; width: number }) {
  const router = useRouter();
  const img = meal.images?.length ? meal.images[0] : meal.image;
  return (
    <PressableScale
      onPress={() => { feedback.tap(); router.push(`/meal?id=${meal.id}`); }}
      accessibilityRole="button"
      accessibilityLabel={`${meal.title} — ${meal.orderCount} orders this week`}
      style={{ width, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      <View style={{ width, height: 130, backgroundColor: Palette.border }}>
        {img ? (
          <Image source={{ uri: imgUrl(img, 360) }} style={{ flex: 1 }} contentFit="cover" transition={200} />
        ) : null}
        <OrderBadge count={meal.orderCount} />
      </View>
      <View style={{ padding: 10, gap: 3 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 13, color: INK }}>{meal.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Star size={11} color={Palette.amber} fill={Palette.amber} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.inkSoft }}>{meal.rating.toFixed(1)}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary }}>· ${meal.price.toFixed(0)}</Text>
        </View>
        <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary }}>{meal.prepper}</Text>
      </View>
    </PressableScale>
  );
}

export function TrendingNowSection() {
  const router = useRouter();
  const { data: meals, isLoading } = useTrendingNowMeals();
  const cardWidth = useCarouselCardWidth();

  if (!isLoading && (!meals || meals.length === 0)) return null;

  const subtitle = (
    <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, marginLeft: 2, marginTop: 1 }}>
      this week
    </Text>
  );

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 120 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 12, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Flame size={18} color="#ff6b35" />
          <View>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }}>trending now</Text>
            {subtitle}
          </View>
        </View>
        <PressableScale onPress={() => { feedback.tap(); router.push('/explore'); }}
          accessibilityRole="button" accessibilityLabel="See all trending meals">
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>see all →</Text>
        </PressableScale>
      </View>
      {isLoading ? <CardRowSkeleton count={3} width={cardWidth} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {(meals ?? []).map((meal, i) => (
            <MotiView key={meal.id} from={{ opacity: 0, translateX: 12 }} animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <TrendingNowCard meal={meal} width={cardWidth} />
            </MotiView>
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}
