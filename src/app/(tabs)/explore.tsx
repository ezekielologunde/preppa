import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Coffee,
  Flame,
  LayoutGrid,
  Leaf,
  List,
  MapPin,
  Moon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  UtensilsCrossed,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CuisineCard } from '@/components/cuisine-card';
import { type AdvancedFilters, countActiveFilters, ExploreFilterSheet, FILTER_DEFAULTS, isNearby } from '@/components/explore-filter-sheet';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import {
  CUISINES,
  type QuickFilter,
  QUICK_DIETARY,
  QUICK_FILTERS,
  SEARCH_PLACEHOLDERS,
} from '@/lib/explore-constants';
import {
  gridCardWidth,
  gridColumns,
  useBreakpoint,
  useCarouselCardWidth,
  useContentWidth,
  usePagePadding,
} from '@/lib/layout';
import { useRankedPreppers } from '@/lib/match';
import { useAddresses } from '@/lib/queries/addresses';
import { useGPSLocation } from '@/lib/use-location';
import { useFeaturedMeals, useLimitedDrops } from '@/lib/queries/meals';
import { useKitchenTags, useTopPreppers } from '@/lib/queries/preppers';
import { usePersonalizedMeals } from '@/lib/queries/recommend';
import { useAuth } from '@/providers/auth-provider';

// ─── Constants ────────────────────────────────────────────────────────────────

// Map the user's saved dietary profile (Title Case, e.g. "Gluten-free") to
// quick-filter keys, so chips matching their profile float to the front.
function dietaryProfileKeys(meta: Record<string, unknown> | null | undefined): Set<string> {
  const raw = (meta?.dietary as string[] | undefined) ?? [];
  return new Set(raw.map((d) => d.toLowerCase().replace(/\s+/g, '-')));
}

const CATEGORY_CIRCLES = [
  { key: 'all',        label: 'all',       Icon: LayoutGrid,      color: Palette.ink },
  { key: 'breakfast',  label: 'breakfast', Icon: Coffee,          color: Palette.amber },
  { key: 'lunch',      label: 'lunch',     Icon: UtensilsCrossed, color: Palette.success },
  { key: 'dinner',     label: 'dinner',    Icon: Moon,            color: Palette.brand },
  { key: 'healthy',    label: 'healthy',   Icon: Leaf,            color: '#22C55E' },
  { key: 'vegan',      label: 'vegan',     Icon: Sprout,          color: '#8B5CF6' },
  { key: 'trending',   label: 'trending',  Icon: Flame,           color: Palette.amber },
  { key: 'meal-plans', label: 'plans',     Icon: Sparkles,        color: Palette.brand },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, pad, onSeeAll }: { title: string; pad: number; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pad, marginTop: 8, marginBottom: 10 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink, letterSpacing: -0.4 }}>{title}</Text>
      {onSeeAll ? (
        <PressableScale onPress={() => { feedback.tap(); onSeeAll(); }} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>see all →</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function CategoryCircles({ active, pad, onSelect }: { active: string; pad: number; onSelect: (key: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingVertical: 10 }}>
      {CATEGORY_CIRCLES.map((c) => {
        const isActive = c.key === active;
        return (
          <PressableScale key={c.key} onPress={() => { feedback.tap(); onSelect(c.key); }} accessibilityRole="button" accessibilityLabel={`Filter by ${c.label}`} style={{ alignItems: 'center', gap: 5 }}>
            <MotiView
              animate={{ backgroundColor: isActive ? Palette.brandTint : Palette.surface, borderColor: isActive ? '#F6C6AC' : 'transparent' }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, ...(!isActive ? Shadow.card : {}) }}>
              <c.Icon size={24} color={isActive ? Palette.brand : c.color} />
            </MotiView>
            <Text style={{ fontFamily: Font.medium, fontSize: 11, color: isActive ? Palette.brand : Palette.textSecondary }}>{c.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function QuickFilterChips({ items, active, pad, onToggle }: { items: QuickFilter[]; active: string[]; pad: number; onToggle: (key: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 8, paddingBottom: 4 }}>
      {items.map((f) => {
        const isActive = active.includes(f.key);
        return (
          <PressableScale key={f.key} onPress={() => onToggle(f.key)}
            accessibilityRole="checkbox" accessibilityState={{ checked: isActive }} accessibilityLabel={`Filter: ${f.label}`}
            hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}>
            <MotiView
              animate={{ backgroundColor: isActive ? Palette.brand : Palette.surface, borderColor: isActive ? Palette.brand : Palette.border }}
              transition={{ type: 'timing', duration: 160 }}
              style={{ paddingHorizontal: 14, height: 34, borderRadius: Radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: isActive ? '#fff' : Palette.inkSoft }}>{f.label}</Text>
            </MotiView>
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

  const { data: vibeTags } = useKitchenTags();
  const { data: preppers, isLoading: preppersLoading, isError: preppersError, refetch: refetchPreppers } = useTopPreppers();
  const { data: meals, isLoading: mealsLoading, isError: mealsError, refetch: refetchMeals } = useFeaturedMeals();
  const { data: drops, refetch: refetchDrops } = useLimitedDrops(6);
  const forYou = usePersonalizedMeals(meals ?? [], user?.id, user?.user_metadata ?? null).slice(0, 6);
  const rankedPreppers = useRankedPreppers(preppers ?? [], user?.id);

  const { data: addresses = [] } = useAddresses(user?.id);
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const locationLabel = defaultAddress
    ? [defaultAddress.city, defaultAddress.state].filter(Boolean).join(', ')
    : 'Set location';
  const { captureLocation, capturing: locCapturing } = useGPSLocation(user?.id, addresses);

  async function handleLocationTap() {
    if (locCapturing) return;
    feedback.tap();
    if (!user) { router.push('/auth?mode=signup'); return; }
    const result = await captureLocation();
    if (result !== 'done') router.push('/addresses');
  }

  const [refreshing, setRefreshing]     = useState(false);
  const [filterOpen, setFilterOpen]     = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode]         = useState<'list' | 'grid'>('grid');
  const [advFilters, setAdvFilters]     = useState<AdvancedFilters>(FILTER_DEFAULTS);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  const isTabletUp = bp !== 'mobile';
  const isDesktop  = bp === 'desktop';
  const prepperCols = bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 0;
  const mealCardW   = gridCardWidth(contentWidth, pad);

  // Rotate intent-driven placeholder text
  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % SEARCH_PLACEHOLDERS.length), 3400);
    return () => clearInterval(id);
  }, []);

  // Quick-filter chips, re-ordered so the user's saved dietary profile leads
  const profileKeys = useMemo(() => dietaryProfileKeys(user?.user_metadata), [user?.user_metadata]);
  const sortedQuickFilters = useMemo(
    () => [...QUICK_FILTERS].sort((a, b) => (profileKeys.has(b.key) ? 1 : 0) - (profileKeys.has(a.key) ? 1 : 0)),
    [profileKeys],
  );

  // Derive active quick-filter chips from advFilters (single source of truth)
  const activeQuickFilters = useMemo(() => {
    const out: string[] = [];
    advFilters.dietary.forEach((k) => { if (QUICK_DIETARY.has(k)) out.push(k); });
    if (advFilters.sort === 'rating') out.push('top-rated');
    if (isNearby(advFilters)) out.push('near-me');
    return out;
  }, [advFilters]);

  const activeFilterCount = countActiveFilters(advFilters);

  function handleCategorySelect(key: string) {
    if (key === 'meal-plans') { feedback.tap(); router.push('/meal-plans'); return; }
    setActiveCategory(key);
  }

  function toggleQuickFilter(key: string) {
    feedback.tap();
    setAdvFilters((f) => {
      if (QUICK_DIETARY.has(key))
        return { ...f, dietary: f.dietary.includes(key) ? f.dietary.filter((k) => k !== key) : [...f.dietary, key] };
      if (key === 'top-rated')
        return { ...f, sort: f.sort === 'rating' ? 'default' : 'rating' };
      if (key === 'near-me')
        return { ...f, distance: isNearby(f) ? null : 3 };
      return f;
    });
  }

  const filteredMeals = useMemo(() => {
    const catKey = (activeCategory === 'all' || activeCategory === 'trending') ? null : activeCategory;
    const afterCat = catKey
      ? (meals ?? []).filter((m) => [m.title, m.category ?? ''].join(' ').toLowerCase().includes(catKey.replace('-', ' ')))
      : (meals ?? []);
    const afterDiet = advFilters.dietary.length === 0
      ? afterCat
      : afterCat.filter((m) => {
          const hay = [m.title, m.category ?? ''].join(' ').toLowerCase();
          return advFilters.dietary.every((d) => hay.includes(d.replace('-', ' ')));
        });
    if (activeCategory === 'trending' || advFilters.sort === 'rating') return [...afterDiet].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (advFilters.sort === 'newest') return [...afterDiet].reverse();
    return afterDiet;
  }, [meals, activeCategory, advFilters.dietary, advFilters.sort]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchPreppers(), refetchMeals(), refetchDrops()]);
    setRefreshing(false);
  }

  const stickyStyle = Platform.OS === 'web'
    ? ({ position: 'sticky', top: 0, zIndex: 10, backgroundColor: Palette.canvas } as object)
    : { zIndex: 10, backgroundColor: Palette.canvas };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── Sticky header ── */}
        <View style={stickyStyle}>

          {/* Top row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 10, paddingBottom: 4, gap: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: Font.display, fontSize: 34, color: Palette.ink, letterSpacing: -1.2 }}>explore</Text>
            <PressableScale onPress={handleLocationTap} accessibilityRole="button" accessibilityLabel={`Delivery location: ${locCapturing ? 'Detecting...' : locationLabel}. Tap to detect.`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 11, height: 40, maxWidth: 200, ...Shadow.card }}>
              <MapPin size={13} color={locCapturing ? Palette.textMuted : Palette.brand} style={{ flexShrink: 0 }} />
              <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 13, color: locCapturing ? Palette.textMuted : (defaultAddress ? Palette.inkSoft : Palette.brand), flexShrink: 1 }}>
                {locCapturing ? 'detecting...' : locationLabel}
              </Text>
              <ChevronDown size={12} color={locCapturing ? Palette.textMuted : Palette.textSecondary} style={{ flexShrink: 0 }} />
            </PressableScale>
            {isTabletUp ? (
              <PressableScale onPress={() => { feedback.tap(); setViewMode((m) => m === 'grid' ? 'list' : 'grid'); }} accessibilityRole="button" accessibilityLabel={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
                {viewMode === 'grid' ? <List size={18} color={Palette.inkSoft} /> : <LayoutGrid size={18} color={Palette.inkSoft} />}
              </PressableScale>
            ) : null}
          </View>

          {/* Search bar with rotating placeholder + filter button */}
          <View style={{ paddingHorizontal: pad, paddingBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }} accessibilityRole="search" accessibilityLabel="Search meals or kitchens"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 24, backgroundColor: Palette.surface, paddingHorizontal: 16, gap: 10, overflow: 'hidden', ...Shadow.card }}>
              <Search size={18} color={Palette.textMuted} />
              <MotiView key={placeholderIdx} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 400 }} style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted }}>
                  {SEARCH_PLACEHOLDERS[placeholderIdx]}
                </Text>
              </MotiView>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); setFilterOpen(true); }} accessibilityRole="button" accessibilityLabel={activeFilterCount > 0 ? `Filters — ${activeFilterCount} active` : 'Open filters'}
              style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: activeFilterCount > 0 ? Palette.brand : Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <SlidersHorizontal size={17} color={activeFilterCount > 0 ? '#fff' : Palette.brand} />
              {activeFilterCount > 0 ? (
                <View style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: Palette.brand, lineHeight: 13 }}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </PressableScale>
          </View>

          {/* Quick filter chip train — sorted by the user's dietary profile */}
          <QuickFilterChips items={sortedQuickFilters} active={activeQuickFilters} pad={pad} onToggle={toggleQuickFilter} />

          {/* Category icon circles */}
          <CategoryCircles active={activeCategory} pad={pad} onSelect={handleCategorySelect} />
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
          contentContainerStyle={{ paddingBottom: 32 }}>

          {(preppersError || mealsError) && !preppersLoading && !mealsLoading ? (
            <PressableScale onPress={handleRefresh} accessibilityRole="button" accessibilityLabel="Couldn't load meals. Tap to retry."
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: pad, marginTop: 12, backgroundColor: Palette.danger + '14', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }}>
              <AlertCircle size={18} color={Palette.danger} />
              <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger }}>Couldn't load meals. Tap to retry.</Text>
            </PressableScale>
          ) : null}

          {/* Browse by vibe */}
          {vibeTags && vibeTags.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}>
              <View style={{ paddingTop: 8, marginBottom: 6 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, paddingHorizontal: pad }}>browse by vibe</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: pad }}>
                  {vibeTags.slice(0, 10).map((t, i) => (
                    <MotiView key={t.tag} from={{ opacity: 0, translateX: 8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 28 }}>
                      <PressableScale onPress={() => { feedback.tap(); router.push(`/kitchens?tag=${encodeURIComponent(t.tag)}`); }} accessibilityRole="button" accessibilityLabel={`Browse ${t.tag}`}
                        hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
                        style={{ paddingHorizontal: 14, height: 34, borderRadius: Radius.pill, backgroundColor: Palette.surface, borderWidth: 1.5, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>{t.tag}</Text>
                      </PressableScale>
                    </MotiView>
                  ))}
                </ScrollView>
              </View>
            </MotiView>
          ) : null}

          {/* Local Kitchens */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <SectionHeader title={`local kitchens${rankedPreppers.length ? ` · ${rankedPreppers.length}` : ''}`} pad={pad} onSeeAll={() => router.push('/kitchens')} />
            {preppersLoading ? (
              <View style={{ paddingBottom: 20 }}><CardRowSkeleton count={3} width={210} /></View>
            ) : isTabletUp ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {rankedPreppers.map((p, i) => (
                  <MotiView key={p.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 40 }} style={{ width: `${100 / prepperCols}%` as any, flexShrink: 1 }}>
                    <PrepperCard prepper={p} showRank />
                  </MotiView>
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {rankedPreppers.map((p, i) => (
                  <MotiView key={p.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
                    <PrepperCard prepper={p} showRank />
                  </MotiView>
                ))}
              </ScrollView>
            )}
          </MotiView>

          {/* Meals Grid */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
            <SectionHeader title="meals to preorder" pad={pad} onSeeAll={() => router.push('/category?key=all&label=all+meals')} />
            {mealsLoading ? (
              <View style={{ paddingBottom: 20 }}><CardRowSkeleton count={4} /></View>
            ) : filteredMeals.length === 0 ? (
              <View style={{ paddingHorizontal: pad, paddingBottom: 20 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted }}>No meals match this filter.</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {filteredMeals.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                    <MealCard meal={m} width={mealCardW} />
                  </MotiView>
                ))}
              </View>
            )}
          </MotiView>

          {/* Limited Drops */}
          {drops && drops.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
              <SectionHeader title="limited drops" pad={pad} />
              {isDesktop ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                  {drops.map((m, i) => (
                    <MotiView key={m.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                      <MealCard meal={m} width={mealCardW} />
                    </MotiView>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                  {drops.map((m, i) => (
                    <MotiView key={m.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                      <MealCard meal={m} width={carouselCardWidth} />
                    </MotiView>
                  ))}
                </ScrollView>
              )}
            </MotiView>
          ) : null}

          {/* For You */}
          {!mealsLoading && forYou.length === 0 && !!user ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
              <SectionHeader title="for you" pad={pad} />
              <View style={{ marginHorizontal: pad, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={13} color={Palette.brand} />
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Preorder from a few kitchens to unlock personalized picks.</Text>
              </View>
            </MotiView>
          ) : forYou.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
              <SectionHeader title="for you" pad={pad} onSeeAll={() => router.push('/category?key=all&label=for+you')} />
              {isDesktop ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                  {forYou.map((s, i) => (
                    <MotiView key={s.meal.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                      <View>
                        <MealCard meal={s.meal} width={mealCardW} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 2 }}>
                          <Sparkles size={11} color={Palette.brand} />
                          <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary, flex: 1 }}>{s.reason}</Text>
                        </View>
                      </View>
                    </MotiView>
                  ))}
                </View>
              ) : (
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
              )}
            </MotiView>
          ) : null}

          {/* Explore by Cuisine */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
            <SectionHeader title="explore by cuisine" pad={pad} onSeeAll={() => router.push('/cuisine-explorer')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
              {CUISINES.map((c, i) => (
                <MotiView key={c.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                  <CuisineCard cuisine={c} onPress={() => { feedback.tap(); router.push(`/search?q=${encodeURIComponent(c.name)}`); }} />
                </MotiView>
              ))}
            </ScrollView>
          </MotiView>

          {/* Surprise Me */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push('/surprise'); }} accessibilityRole="button" accessibilityLabel="Surprise me — let a chef pick your meal" style={{ marginHorizontal: pad, marginBottom: 20 }}>
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

      {/* Advanced filter sheet */}
      <ExploreFilterSheet
        visible={filterOpen}
        initial={advFilters}
        isTabletUp={isTabletUp}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => { setAdvFilters(f); setFilterOpen(false); }}
      />
    </View>
  );
}
