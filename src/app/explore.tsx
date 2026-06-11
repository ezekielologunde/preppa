import { useRouter } from 'expo-router';
import {
  CakeSlice,
  ChevronDown,
  Coffee,
  Compass,
  Cookie,
  Flame,
  Heart,
  LayoutGrid,
  Leaf,
  MapPin,
  MoreHorizontal,
  Salad,
  Scan,
  Search,
  Sparkles,
  Sprout,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CuisineCard } from '@/components/cuisine-card';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { cuisines, exploreCategories } from '@/constants/mock';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { useFeaturedMeals, useLimitedDrops } from '@/lib/queries/meals';
import { useKitchenTags, useTopPreppers } from '@/lib/queries/preppers';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const ICONS: Record<string, LucideIcon> = {
  LayoutGrid, Coffee, Salad, UtensilsCrossed, Cookie, CakeSlice, Leaf, Sprout, MoreHorizontal,
};

const GOALS: { label: string; tag: string; Icon: LucideIcon; color: string }[] = [
  { label: 'Bulk Up',     tag: 'High-Protein',      Icon: Zap,    color: '#F59E0B' },
  { label: 'Cut & Lean',  tag: 'Low-Calorie',        Icon: Flame,  color: '#EF4444' },
  { label: 'Keto',        tag: 'Keto',               Icon: Leaf,   color: '#8B5CF6' },
  { label: 'Plant-Based', tag: 'Vegan-Friendly',     Icon: Sprout, color: '#22C55E' },
  { label: 'Diabetic',    tag: 'Diabetic-Friendly',  Icon: Heart,  color: '#3B82F6' },
];

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

export default function ExploreScreen() {
  const router = useRouter();
  const { data: preppers, isLoading: preppersLoading, refetch: refetchPreppers } = useTopPreppers();
  const { data: kitchenTags, refetch: refetchTags } = useKitchenTags();
  const { data: meals, isLoading: mealsLoading, refetch: refetchMeals } = useFeaturedMeals();
  const { data: drops, refetch: refetchDrops } = useLimitedDrops(6);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetchPreppers(), refetchTags(), refetchMeals(), refetchDrops()]); setRefreshing(false); }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 130 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 32, color: INK, letterSpacing: -1 }}>explore</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, marginTop: 2 }}>
                amazing meals from <Text style={{ fontFamily: Font.semibold, color: ORANGE }}>local preppers</Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 }}>
              <MapPin size={14} color={ORANGE} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>New York, NY</Text>
              <ChevronDown size={14} color={Palette.textSecondary} />
            </View>
          </View>

          {/* Search */}
          <PressableScale
            onPress={() => router.push('/search')}
            accessibilityRole="search"
            accessibilityLabel="Search meals, cuisines, or preppers"
            style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16, backgroundColor: Palette.surface, borderRadius: 18, paddingHorizontal: 16, height: 54, gap: 10 }}>
            <Search size={20} color={MUTED} />
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 15, color: MUTED }}>search meals, cuisines, or preppers</Text>
            <Scan size={20} color={ORANGE} />
          </PressableScale>

          {/* Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingVertical: 20 }}>
            {exploreCategories.map((c, i) => {
              const Icon = ICONS[c.icon] ?? MoreHorizontal;
              const active = i === 0;
              const onPress = () =>
                c.key === 'more'
                  ? router.push('/category?key=all&label=all meals')
                  : router.push(`/category?key=${c.key}&label=${encodeURIComponent(c.label)}`);
              return (
                <PressableScale key={c.key} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${c.label} meals`} style={{ alignItems: 'center', gap: 8, width: 60 }}>
                  <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: active ? Palette.brandTint : Palette.surface, alignItems: 'center', justifyContent: 'center', borderWidth: active ? 1 : 0, borderColor: '#F8C9B0' }}>
                    <Icon size={24} color={c.color} />
                  </View>
                  <Text style={{ fontFamily: active ? Font.semibold : Font.medium, fontSize: 12, color: active ? ORANGE : Palette.inkSoft }}>{c.label}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          {/* Cuisines */}
          <SectionHeader title="cuisines" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 26 }}>
            {cuisines.map((c) => (
              <CuisineCard key={c.id} cuisine={c} onPress={() => router.push(`/search?q=${encodeURIComponent(c.name)}`)} />
            ))}
          </ScrollView>

          {/* Find your kind of kitchen — identity/diet/cuisine discovery */}
          {kitchenTags && kitchenTags.length > 0 ? (
            <>
              <SectionHeader title="find your kind of kitchen" onSeeAll={() => router.push('/kitchens')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 26 }}>
                {kitchenTags.map((t) => (
                  <PressableScale
                    key={t.tag}
                    onPress={() => router.push(`/kitchens?tag=${encodeURIComponent(t.tag)}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.tag} kitchens`}
                    style={{ paddingHorizontal: 16, height: 42, borderRadius: 999, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, ...Shadow.card }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{t.tag}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, fontVariant: ['tabular-nums'] }}>{t.count}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* Fitness goals — nutrition-focused kitchen discovery */}
          <View style={{ marginBottom: 10 }}>
            <SectionHeader title="shop by goal" onSeeAll={() => router.push('/kitchens')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 26 }}>
              {GOALS.map((g) => (
                <PressableScale
                  key={g.tag}
                  onPress={() => router.push(`/kitchens?tag=${encodeURIComponent(g.tag)}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.label} meal prep kitchens`}
                  style={{ alignItems: 'center', gap: 8, width: 68 }}>
                  <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: g.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <g.Icon size={26} color={g.color} />
                  </View>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: INK, textAlign: 'center' }}>{g.label}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>

          {/* Top kitchens — reputation-ranked (live) */}
          <SectionHeader title="top kitchens this week" />
          {preppersLoading ? (
            <View style={{ paddingBottom: 26 }}><CardRowSkeleton count={3} width={210} /></View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 26 }}>
              {(preppers ?? []).map((p, i) => (
                <MotiView key={p.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
                  <PrepperCard prepper={p} showRank />
                </MotiView>
              ))}
            </ScrollView>
          )}

          {/* Limited drops — only shown when active drops exist */}
          {drops && drops.length > 0 ? (
            <>
              <SectionHeader title="limited drops" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 26 }}>
                {drops.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                    <MealCard meal={m} />
                  </MotiView>
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* Popular (live) */}
          <SectionHeader title="popular right now" onSeeAll={() => router.push('/category?key=all&label=popular')} />
          {mealsLoading ? (
            <View style={{ paddingBottom: 26 }}><CardRowSkeleton count={3} /></View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 26 }}>
              {(meals ?? []).map((m, i) => (
                <MotiView key={m.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                  <MealCard meal={m} />
                </MotiView>
              ))}
            </ScrollView>
          )}

          {/* Can't decide — flat brand-tint accent */}
          <Pressable
            onPress={() => router.push('/surprise')}
            accessibilityRole="button"
            accessibilityLabel="Surprise me with a meal"
            style={{ marginHorizontal: 20 }}>
            <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Compass size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>can&apos;t decide?</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>let our chef assistant find the perfect meal</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: INK, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 9, gap: 5 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>surprise me</Text>
                <Sparkles size={13} color={ORANGE} />
              </View>
            </View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
