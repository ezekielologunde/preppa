import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CuisineCard } from '@/components/cuisine-card';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { cuisines } from '@/constants/mock';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import {
  gridCardWidth,
  gridColumns,
  useBreakpoint,
  useCarouselCardWidth,
  useContentWidth,
  usePagePadding,
} from '@/lib/layout';
import { useRankedPreppers } from '@/lib/match';
import { useFeaturedMeals, useLimitedDrops } from '@/lib/queries/meals';
import { useTopPreppers } from '@/lib/queries/preppers';
import { usePersonalizedMeals } from '@/lib/queries/recommend';
import { useAuth } from '@/providers/auth-provider';

// ─── Constants ────────────────────────────────────────────────────────────────

const CITIES = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
  'Atlanta, GA', 'Washington, DC', 'Miami, FL', 'London, UK', 'Lagos, NG',
];

const CATEGORY_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'trending', label: 'Trending' },
  { key: 'nigerian', label: 'Nigerian' },
  { key: 'mexican', label: 'Mexican' },
  { key: 'italian', label: 'Italian' },
  { key: 'asian', label: 'Asian' },
  { key: 'american', label: 'American' },
  { key: 'caribbean', label: 'Caribbean' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'comfort', label: 'Comfort' },
  { key: 'meal-plans', label: 'Meal Plans' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 8, marginBottom: 10 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3 }}>{title}</Text>
      {onSeeAll ? (
        <PressableScale onPress={() => { feedback.tap(); onSeeAll(); }} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>see all →</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function CategoryChips({ active, onSelect }: { active: string; onSelect: (key: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}>
      {CATEGORY_CHIPS.map((chip) => {
        const isActive = chip.key === active;
        return (
          <PressableScale
            key={chip.key}
            onPress={() => { feedback.tap(); onSelect(chip.key); }}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${chip.label}`}
            style={{
              height: 36,
              borderRadius: 18,
              paddingHorizontal: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isActive ? Palette.brand : Palette.surface,
              borderWidth: 1,
              borderColor: isActive ? Palette.brand : Palette.border,
            }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: isActive ? '#fff' : Palette.textSecondary }}>
              {chip.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const bp = useBreakpoint();
  const pad = usePagePadding();
  const contentWidth = useContentWidth();
  const carouselCardWidth = useCarouselCardWidth();

  const { data: preppers, isLoading: preppersLoading, isError: preppersError, refetch: refetchPreppers } = useTopPreppers();
  const { data: meals, isLoading: mealsLoading, isError: mealsError, refetch: refetchMeals } = useFeaturedMeals();
  const { data: drops, refetch: refetchDrops } = useLimitedDrops(6);
  const forYou = usePersonalizedMeals(meals ?? [], user?.id).slice(0, 6);
  const rankedPreppers = useRankedPreppers(preppers ?? [], user?.id);

  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState('New York, NY');
  const [locationOpen, setLocationOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  const isTabletUp = bp !== 'mobile';

  // Derive filtered meals — map category keys to tags/cuisine labels
  const categoryFilter = activeCategory === 'all' ? null : activeCategory;
  const filteredMeals = categoryFilter
    ? (meals ?? []).filter((m) => {
        const haystack = [m.title, m.cuisine, ...(m.tags ?? [])].join(' ').toLowerCase();
        return haystack.includes(categoryFilter.replace('-', ' '));
      })
    : (meals ?? []);

  // Prepper grid columns: 2 tablet / 3 desktop
  const prepperCols = bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 0; // 0 = horizontal scroll
  const mealCols = gridColumns(contentWidth);
  const mealCardW = gridCardWidth(contentWidth, pad);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchPreppers(), refetchMeals(), refetchDrops()]);
    setRefreshing(false);
  }

  // Sticky bar — web gets position:sticky via inline web style
  const stickyStyle = Platform.OS === 'web'
    ? ({ position: 'sticky', top: 0, zIndex: 10, backgroundColor: Palette.canvas } as object)
    : { zIndex: 10, backgroundColor: Palette.canvas };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── Sticky header: search + category chips ── */}
        <View style={stickyStyle}>
          {/* Top row: search + location + (tablet) view toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 8 }}>
            {/* Search bar */}
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/search'); }}
              accessibilityRole="search"
              accessibilityLabel="Search meals, cuisines, or preppers"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 25, backgroundColor: Palette.surface, paddingHorizontal: 16, gap: 10, ...Shadow.card }}>
              <Search size={19} color={Palette.textMuted} />
              <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 14.5, color: Palette.textMuted }}>
                search meals or kitchens
              </Text>
              <SlidersHorizontal size={18} color={Palette.brand} />
            </PressableScale>

            {/* Location pill */}
            <PressableScale
              onPress={() => { feedback.tap(); setLocationOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel={`Delivery location: ${location}. Tap to change.`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 11, height: 50, ...Shadow.card }}>
              <MapPin size={14} color={Palette.brand} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>{location.split(',')[0]}</Text>
              <ChevronDown size={13} color={Palette.textSecondary} />
            </PressableScale>

            {/* View-mode toggle — tablet and up only */}
            {isTabletUp ? (
              <PressableScale
                onPress={() => { feedback.tap(); setViewMode((m) => m === 'grid' ? 'list' : 'grid'); }}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
                {viewMode === 'grid' ? <List size={18} color={Palette.inkSoft} /> : <LayoutGrid size={18} color={Palette.inkSoft} />}
              </PressableScale>
            ) : null}
          </View>

          {/* Category chips */}
          <CategoryChips active={activeCategory} onSelect={setActiveCategory} />
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
          contentContainerStyle={{ paddingBottom: 32 }}>

          {/* Error banner */}
          {(preppersError || mealsError) && !preppersLoading && !mealsLoading ? (
            <PressableScale
              onPress={handleRefresh}
              accessibilityRole="button"
              accessibilityLabel="Data failed to load. Tap to retry."
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 12, backgroundColor: Palette.danger + '14', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }}>
              <AlertCircle size={18} color={Palette.danger} />
              <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger }}>Couldn't load meals. Tap to retry.</Text>
            </PressableScale>
          ) : null}

          {/* ── Section 1: Local Kitchens (Preppers) ── */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <SectionHeader
              title={`local kitchens${rankedPreppers.length ? ` · ${rankedPreppers.length}` : ''}`}
              onSeeAll={() => router.push('/kitchens')}
            />
            {preppersLoading ? (
              <View style={{ paddingBottom: 20 }}><CardRowSkeleton count={3} width={210} /></View>
            ) : isTabletUp ? (
              // Tablet/desktop: multi-column grid
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {rankedPreppers.map((p, i) => (
                  <MotiView key={p.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 40 }}
                    style={{ width: `${100 / prepperCols}%` as any, flexShrink: 1 }}>
                    <PrepperCard prepper={p} showRank />
                  </MotiView>
                ))}
              </View>
            ) : (
              // Mobile: horizontal scroll
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {rankedPreppers.map((p, i) => (
                  <MotiView key={p.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
                    <PrepperCard prepper={p} showRank />
                  </MotiView>
                ))}
              </ScrollView>
            )}
          </MotiView>

          {/* ── Section 2: Meals Grid ── */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
            <SectionHeader
              title="meals to preorder"
              onSeeAll={() => router.push('/category?key=all&label=all+meals')}
            />
            {mealsLoading ? (
              <View style={{ paddingBottom: 20 }}><CardRowSkeleton count={4} /></View>
            ) : filteredMeals.length === 0 ? (
              <View style={{ paddingHorizontal: pad, paddingBottom: 20 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted }}>No meals match this filter.</Text>
              </View>
            ) : isTabletUp && viewMode === 'grid' ? (
              // Tablet/desktop grid
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {filteredMeals.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                    <MealCard meal={m} width={mealCardW} />
                  </MotiView>
                ))}
              </View>
            ) : (
              // Mobile 2-col grid (or tablet list mode)
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {filteredMeals.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                    <MealCard meal={m} width={mealCardW} />
                  </MotiView>
                ))}
              </View>
            )}
          </MotiView>

          {/* ── Section 3: Limited Drops ── */}
          {drops && drops.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
              <SectionHeader title="limited drops" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {drops.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                    <MealCard meal={m} width={carouselCardWidth} />
                  </MotiView>
                ))}
              </ScrollView>
            </MotiView>
          ) : null}

          {/* ── Section 4: For You ── */}
          {forYou.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
              <SectionHeader title="for you" onSeeAll={() => router.push('/category?key=all&label=for+you')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {forYou.map((s, i) => (
                  <MotiView key={s.meal.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                    <View>
                      <MealCard meal={s.meal} width={carouselCardWidth} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 2 }}>
                        <Sparkles size={11} color={Palette.brand} />
                        <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary, flex: 1 }}>{s.reason}</Text>
                      </View>
                    </View>
                  </MotiView>
                ))}
              </ScrollView>
            </MotiView>
          ) : null}

          {/* ── Section 5: Explore by Cuisine ── */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
            <SectionHeader title="explore by cuisine" onSeeAll={() => router.push('/cuisine-explorer')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
              {cuisines.map((c) => (
                <CuisineCard key={c.id} cuisine={c} onPress={() => { feedback.tap(); router.push(`/category?cuisine=${encodeURIComponent(c.name)}`); }} />
              ))}
            </ScrollView>
          </MotiView>

          {/* ── Surprise Me ── */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/surprise'); }}
              accessibilityRole="button"
              accessibilityLabel="Surprise me — let a chef pick your meal"
              style={{ marginHorizontal: 20, marginBottom: 20 }}>
              <View style={{ backgroundColor: Palette.ink, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: Palette.brand + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={21} color={Palette.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>surprise me</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Tell us your vibe — we'll pick the perfect meal</Text>
                </View>
                <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
              </View>
            </PressableScale>
          </MotiView>

        </ScrollView>
      </SafeAreaView>

      {/* ── Location Picker Modal ── */}
      <Modal visible={locationOpen} transparent animationType="slide" onRequestClose={() => setLocationOpen(false)}>
        <Pressable onPress={() => setLocationOpen(false)} style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, ...(isTabletUp ? { maxWidth: 540, alignSelf: 'center', width: '100%' } : {}) }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginTop: 12, marginBottom: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 14 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.4 }}>your location</Text>
              <PressableScale onPress={() => { feedback.tap(); setLocationOpen(false); }} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={Palette.textSecondary} />
              </PressableScale>
            </View>
            {CITIES.map((city, i) => (
              <PressableScale
                key={city}
                onPress={() => { feedback.tap(); setLocation(city); setLocationOpen(false); }}
                accessibilityRole="button"
                accessibilityLabel={`Set location to ${city}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 15, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: location === city ? Palette.brandTint : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={16} color={location === city ? Palette.brand : Palette.textMuted} />
                </View>
                <Text style={{ flex: 1, fontFamily: location === city ? Font.semibold : Font.medium, fontSize: 15, color: location === city ? Palette.brand : Palette.ink }}>{city}</Text>
                {location === city ? <Check size={18} color={Palette.brand} /> : null}
              </PressableScale>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
