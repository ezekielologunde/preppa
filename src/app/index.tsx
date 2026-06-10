import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Bell,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Coffee,
  Gift,
  Leaf,
  MapPin,
  MoreHorizontal,
  Salad,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealCard } from '@/components/meal-card';
import { Avatar } from '@/components/ui/avatar';
import { Font } from '@/constants/fonts';
import { categories, recommendedMeals } from '@/constants/mock';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Palette, Radius } from '@/constants/theme';
import { greeting } from '@/lib/greeting';
import { useFeaturedMeals } from '@/lib/queries/meals';
import { useFeatureFlags } from '@/lib/queries/feature-flags';
import { useMyOrders } from '@/lib/queries/orders';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const ICONS: Record<string, LucideIcon> = {
  Coffee,
  Salad,
  UtensilsCrossed,
  Leaf,
  Sprout,
  MoreHorizontal,
};

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>{title}</Text>
      {onSeeAll ? (
        <PressableScale onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>see all</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // Greet by first name only when a real name exists — never the email handle.
  const rawFirst = (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0];
  const firstName = rawFirst ? rawFirst.toLowerCase() : null;
  // Live meals from Supabase (RLS-scoped); fall back to mock if the query is empty.
  const { data: liveMeals, isLoading: mealsLoading } = useFeaturedMeals();
  const meals = liveMeals && liveMeals.length > 0 ? liveMeals : recommendedMeals;
  const { data: flags } = useFeatureFlags();
  const showPlans = flags?.meal_plans !== false;
  const showExperiences = flags?.experiences !== false;
  // "Order again" = the user's most recent delivered order (hidden until one exists).
  const { data: myOrders } = useMyOrders(user?.id);
  const lastDone = myOrders?.find((o) => o.status === 'completed');
  // Bell badge = orders still in motion (real, actionable) — not a fake count.
  const activeOrders = (myOrders ?? []).filter(
    (o) => o.status !== 'completed' && o.status !== 'cancelled',
  ).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F8' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 130 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, gap: 12 }}>
            <PressableScale
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: ORANGE, padding: 2 }}>
              <Avatar name={firstName ?? user?.email ?? 'guest'} url={user?.user_metadata?.avatar_url as string | undefined} size={44} />
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.textSecondary }}>{greeting()}{firstName ? `, ${firstName}` : ''} 👋</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6, lineHeight: 28 }}>
                what are you{'\n'}
                <Text style={{ color: ORANGE }}>craving today?</Text>
              </Text>
            </View>
            <PressableScale onPress={() => router.push('/messages')} accessibilityRole="button" accessibilityLabel={activeOrders ? `Inbox, ${activeOrders} active orders` : 'Inbox'} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} color={INK} />
              {activeOrders > 0 ? (
                <View style={{ position: 'absolute', top: 8, right: 9, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: '#fff' }}>{activeOrders}</Text>
                </View>
              ) : null}
            </PressableScale>
          </View>

          {/* Location — right-aligned pill */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, marginTop: 10 }}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Change location, New York, NY" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
              <MapPin size={14} color={ORANGE} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#374151' }}>New York, NY</Text>
              <ChevronDown size={14} color="#6b7280" />
            </PressableScale>
          </View>

          {/* Search */}
          <PressableScale
            onPress={() => router.push('/search')}
            accessibilityRole="search"
            accessibilityLabel="Search meals, cuisines, or preppers"
            style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 16, height: 54, gap: 10 }}>
            <Search size={20} color={MUTED} />
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 15, color: MUTED }}>Search meals, cuisines, or preppers…</Text>
            <SlidersHorizontal size={20} color={ORANGE} />
          </PressableScale>

          {/* Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 18, paddingVertical: 20 }}>
            {categories.map((c) => {
              const Icon = ICONS[c.icon] ?? MoreHorizontal;
              const onPress = () =>
                c.key === 'more'
                  ? router.push('/explore')
                  : router.push(`/category?key=${c.key}&label=${encodeURIComponent(c.label)}`);
              return (
                <PressableScale key={c.key} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${c.label} meals`} style={{ alignItems: 'center', gap: 8, width: 58 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={24} color={c.color} />
                  </View>
                  <Text style={{ fontFamily: Font.medium, fontSize: 12, color: '#374151' }}>{c.label}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          {/* Primary products — Meal Plans + Experiences, surfaced (not hidden) */}
          {showPlans || showExperiences ? (
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 26 }}>
              {showPlans ? (
                <PressableScale onPress={() => router.push('/meal-plans')} accessibilityRole="button" accessibilityLabel="Meal plans"
                  style={{ flex: 1, backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, gap: 10 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarCheck size={20} color={ORANGE} />
                  </View>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>meal plans</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, lineHeight: 16 }}>weekly & family, on repeat</Text>
                </PressableScale>
              ) : null}
              {showExperiences ? (
                <PressableScale onPress={() => router.push('/experiences')} accessibilityRole="button" accessibilityLabel="Experiences"
                  style={{ flex: 1, backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, gap: 10 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Ticket size={20} color={ORANGE} />
                  </View>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>experiences</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, lineHeight: 16 }}>catering, chefs & classes</Text>
                </PressableScale>
              ) : null}
            </View>
          ) : null}

          {/* Recommended — real meals lead; discovery toys come after */}
          <SectionHeader title="recommended for you" onSeeAll={() => router.push('/category?key=all&label=recommended')} />
          {mealsLoading ? (
            <View style={{ paddingBottom: 26 }}>
              <CardRowSkeleton count={3} />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 26 }}>
              {meals.map((m) => (
                <MealCard key={m.id} meal={m} />
              ))}
            </ScrollView>
          )}

          {/* Chef surprise me — flat brand-tint accent (the one accent surface on Home) */}
          <Pressable
            onPress={() => {
              const pick = meals[Math.floor(Math.random() * meals.length)];
              if (pick) router.push(`/meal?id=${pick.id}`);
            }}
            accessibilityRole="button"
            accessibilityLabel="Surprise me with a meal"
            style={{ marginHorizontal: 20, marginBottom: 26 }}>
            <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.lg, padding: 20, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5 }}>chef surprise me</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 18 }}>tell us your mood, we&apos;ll pick the perfect meal</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: INK, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8, gap: 6 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>surprise me</Text>
                  <Sparkles size={14} color={ORANGE} />
                </View>
              </View>
              <Image source="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=60" style={{ width: 110, height: 110, borderRadius: 55 }} contentFit="cover" />
            </View>
          </Pressable>

          {/* Points banner */}
          <View style={{ marginHorizontal: 20, marginBottom: 28, backgroundColor: '#E7F6EC', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#14532d' }}>you have 350 points</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#3f6212' }}>unlock rewards & save on your next order</Text>
            </View>
            <View style={{ backgroundColor: INK, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>view rewards</Text>
              <ChevronRight size={13} color="#fff" />
            </View>
          </View>

          {/* Order again — the user's real last delivered order */}
          {lastDone ? (
            <>
              <SectionHeader title="order again" />
              <View style={{ marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {lastDone.items[0]?.image ? (
                  <Image source={lastDone.items[0].image} style={{ width: 60, height: 60, borderRadius: 14 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: '#FCE9DD' }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{lastDone.items[0]?.title ?? 'Your order'}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 2 }}>by {lastDone.prepper}</Text>
                  <Text style={{ fontFamily: Font.medium, fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    ${lastDone.total.toFixed(2)} · delivered {new Date(lastDone.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <PressableScale
                  onPress={() => lastDone.firstMealId && router.push(`/meal?id=${lastDone.firstMealId}`)}
                  accessibilityRole="button"
                  accessibilityLabel="Order again"
                  style={{ backgroundColor: ORANGE, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>order again</Text>
                </PressableScale>
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
