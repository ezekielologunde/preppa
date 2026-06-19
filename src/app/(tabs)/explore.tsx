import { useRouter } from 'expo-router';
import { AlertCircle, ChevronDown, Compass, Flame, LayoutGrid, List, MapPin, Search, Shuffle, SlidersHorizontal, Sparkles, Star, UtensilsCrossed, X, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Platform, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CuisineCard } from '@/components/cuisine-card';
import { ActiveFilterBar, CuisineTabsRow } from '@/components/cuisine-tabs';
import { type AdvancedFilters, countActiveFilters, ExploreFilterSheet, FILTER_DEFAULTS } from '@/components/explore-filter-sheet';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { CUISINES, SEARCH_PLACEHOLDERS } from '@/lib/explore-constants';
import { gridCardWidth, useBreakpoint, useCarouselCardWidth, useContentWidth, usePagePadding } from '@/lib/layout';
import { useRankedPreppers } from '@/lib/match';
import { useAddresses } from '@/lib/queries/addresses';
import { useDeviceLocation, usePurgeGpsAddresses } from '@/lib/use-location';
import { sortByDistance } from '@/lib/distance';
import { useFeaturedMeals, useLimitedDrops } from '@/lib/queries/meals';
import { useActiveLiveSessions, useTopPreppers } from '@/lib/queries/preppers';
import { usePersonalizedMeals } from '@/lib/queries/recommend';
import { useTodayStock } from '@/lib/queries/stock';
import { useAuth } from '@/providers/auth-provider';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHIP_CATEGORIES = [
  { key: 'all', label: 'All' }, { key: 'nearby', label: 'Nearby' }, { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'New' }, { key: 'vegan', label: 'Vegan' }, { key: 'gluten-free', label: 'Gluten-Free' },
  { key: 'high-protein', label: 'High Protein' },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

type SH = { title: string; pad: number; Icon?: React.ComponentType<{ size?: number; color?: string }>; onSeeAll?: () => void };
function SectionHeader({ title, pad, Icon, onSeeAll }: SH) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pad, marginTop: 12, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {Icon ? <Icon size={16} color={Palette.brand} /> : null}
        <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.4 }}>{title}</Text>
      </View>
      {onSeeAll ? (
        <PressableScale onPress={() => { feedback.tap(); onSeeAll(); }} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brand }}>See all</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function CategoryChips({ active, pad, onSelect }: { active: string; pad: number; onSelect: (key: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 8, paddingVertical: 8 }}>
      {CHIP_CATEGORIES.map((c) => {
        const on = c.key === active;
        return (
          <PressableScale key={c.key} onPress={() => { feedback.tap(); onSelect(c.key); }} accessibilityRole="button" accessibilityLabel={`Filter by ${c.label}`}>
            <MotiView animate={{ scale: on ? 1 : 0.97 }} transition={{ type: 'spring', damping: 20, stiffness: 260 }}
              style={{ height: 36, borderRadius: 18, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Palette.brand : Palette.surface, borderWidth: on ? 0 : 1, borderColor: Palette.border }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? '#fff' : Palette.textSecondary }}>{c.label}</Text>
            </MotiView>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function SearchBar({ value, onChangeText, onClear, pad, placeholderIdx }: { value: string; onChangeText: (t: string) => void; onClear: () => void; pad: number; placeholderIdx: number }) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: focused ? 1 : 0, duration: 220, useNativeDriver: false }).start(); }, [focused, anim]);
  const border = anim.interpolate({ inputRange: [0, 1], outputRange: [Palette.border, Palette.brand] });
  return (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', damping: 20, stiffness: 260 }} style={{ paddingHorizontal: pad, paddingBottom: 4 }}>
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 26, backgroundColor: Palette.surface, borderWidth: 1, borderColor: border, paddingLeft: 14, paddingRight: 12, gap: 10, ...Shadow.card }}>
        <Search size={18} color={focused ? Palette.brand : Palette.textMuted} />
        {value.length === 0 && !focused ? (
          <MotiView key={placeholderIdx} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 400 }} style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted }}>{SEARCH_PLACEHOLDERS[placeholderIdx]}</Text>
          </MotiView>
        ) : (
          <TextInput style={{ flex: 1, fontFamily: Font.body, fontSize: 14, color: Palette.ink, padding: 0, margin: 0 }} value={value} onChangeText={onChangeText}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoCorrect={false} autoCapitalize="none" returnKeyType="search" accessibilityLabel="Search meals or kitchens" />
        )}
        {value.length > 0 ? (
          <PressableScale onPress={() => { feedback.tap(); onClear(); }} accessibilityRole="button" accessibilityLabel="Clear search"><X size={16} color={Palette.textSecondary} /></PressableScale>
        ) : null}
      </Animated.View>
    </MotiView>
  );
}

function SearchEmptyState({ query }: { query: string }) {
  return (
    <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20, stiffness: 260 }} style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 }}>
      <Search size={64} color={Palette.border} />
      <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.4, marginTop: 16, textAlign: 'center' }}>
        No results for &ldquo;{query}&rdquo;
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
        Try a different search or browse by category
      </Text>
    </MotiView>
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
  const { data: liveSet = new Set<string>() } = useActiveLiveSessions();
  const { data: meals, isLoading: mealsLoading, isError: mealsError, refetch: refetchMeals } = useFeaturedMeals();
  const { data: drops, refetch: refetchDrops } = useLimitedDrops(6);
  const forYou = usePersonalizedMeals(meals ?? [], user?.id, user?.user_metadata ?? null).slice(0, 6);

  // Batch stock query for all visible meal IDs across sections
  const allMealIds = useMemo(() => [...new Set([...(meals ?? []), ...(drops ?? [])].map((m) => m.id).concat(forYou.map((s) => s.meal.id)))], [meals, drops, forYou]);
  const { data: stockMap = {} } = useTodayStock(allMealIds);
  const rankedPreppers = useRankedPreppers(preppers ?? [], user?.id);

  const { data: addresses = [] } = useAddresses(user?.id);
  const { loc, requestDeviceLocation } = useDeviceLocation();
  const locCapturing = loc.status === 'requesting';
  const locDenied = loc.status === 'denied';
  usePurgeGpsAddresses(user?.id);
  const locationLabel = loc.status === 'granted' && loc.city
    ? [loc.city, loc.state].filter(Boolean).join(', ')
    : (() => {
        const def = addresses.find((a) => a.isDefault) ?? addresses[0];
        return def ? [def.city, def.state].filter(Boolean).join(', ') : 'near you';
      })();

  async function handleGpsTap() {
    if (locCapturing) return;
    feedback.tap();
    const result = await requestDeviceLocation();
    if (result === 'denied' && user && addresses.length > 0) router.push('/addresses');
  }
  function handleAddressTap() {
    feedback.tap();
    if (!user) { router.push('/auth?mode=signin'); return; }
    router.push('/addresses');
  }

  const [refreshing, setRefreshing]         = useState(false);
  const [filterOpen, setFilterOpen]         = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery]       = useState('');
  const [viewMode, setViewMode]             = useState<'list' | 'grid'>('grid');
  const userDietary = (user?.user_metadata?.dietary as string[] | undefined) ?? [];
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(() => ({ ...FILTER_DEFAULTS, dietary: userDietary.map((d: string) => d.toLowerCase()) }));
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  const isTabletUp  = bp !== 'mobile';
  const isDesktop   = bp === 'desktop';
  const prepperCols = bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 0;
  const mealCardW   = gridCardWidth(contentWidth, pad);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % SEARCH_PLACEHOLDERS.length), 3400);
    return () => clearInterval(id);
  }, []);

  const activeFilterCount = countActiveFilters(advFilters);

  const displayPreppers = useMemo(() => {
    if (advFilters.sort !== 'nearest' || !loc.coords) return rankedPreppers;
    return sortByDistance(rankedPreppers, loc.coords.lat, loc.coords.lng);
  }, [rankedPreppers, advFilters.sort, loc.coords]);

  const filteredMeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const noFilterCats = new Set(['all', 'nearby', 'trending', 'new']);
    const catKey = noFilterCats.has(activeCategory) ? null : activeCategory;

    let result = catKey
      ? (meals ?? []).filter((m) => [m.title, m.category ?? ''].join(' ').toLowerCase().includes(catKey.replace('-', ' ')))
      : (meals ?? []);

    if (q.length >= 2) {
      result = result.filter((m) => [m.title, m.prepper, m.category ?? ''].join(' ').toLowerCase().includes(q));
    }

    // Cuisine: match against category key (best effort on client-side data)
    if (advFilters.cuisines.length > 0) {
      result = result.filter((m) =>
        advFilters.cuisines.some((c) => (m.category ?? '').toLowerCase().includes(c.toLowerCase()))
      );
    }

    // Dietary: every selected restriction must appear in title or category text
    if (advFilters.dietary.length > 0) {
      result = result.filter((m) =>
        advFilters.dietary.every((d) => [m.title, m.category ?? ''].join(' ').toLowerCase().includes(d.replace('-', ' ')))
      );
    }

    // Max price
    if (advFilters.maxPrice !== null) {
      result = result.filter((m) => m.price <= advFilters.maxPrice!);
    }

    // Min rating
    if (advFilters.minRating !== null) {
      result = result.filter((m) => (m.rating ?? 0) >= advFilters.minRating!);
    }

    // Fulfillment
    if (advFilters.fulfillment === 'pickup') {
      result = result.filter((m) => m.pickup !== false);
    } else if (advFilters.fulfillment === 'delivery') {
      result = result.filter((m) => m.delivers === true);
    }

    // Sort
    if (advFilters.sort === 'rating') return [...result].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (advFilters.sort === 'price_asc') return [...result].sort((a, b) => a.price - b.price);
    if (advFilters.sort === 'price_desc') return [...result].sort((a, b) => b.price - a.price);
    if (advFilters.sort === 'newest') return [...result].reverse();
    return result;
  }, [meals, activeCategory, searchQuery, advFilters]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPreppers(), refetchMeals(), refetchDrops()]);
    setRefreshing(false);
  }, [refetchPreppers, refetchMeals, refetchDrops]);

  const stickyStyle = Platform.OS === 'web'
    ? ({ position: 'sticky', top: 0, zIndex: 10, backgroundColor: Palette.canvas } as object)
    : { zIndex: 10, backgroundColor: Palette.canvas };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── Sticky header ── */}
        <View style={stickyStyle}>

          {/* Top row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 8, paddingBottom: 2, gap: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.9 }}>explore</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: Radius.pill, height: 40, maxWidth: 200, overflow: 'hidden', ...Shadow.card }}>
              <PressableScale onPress={handleGpsTap} accessibilityRole="button" accessibilityLabel="Detect my location" style={{ paddingLeft: 11, paddingRight: 7, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                {locCapturing ? <ActivityIndicator size="small" color={Palette.brand} /> : <Compass size={13} color={loc.status === 'granted' ? Palette.brand : Palette.textMuted} />}
              </PressableScale>
              <PressableScale onPress={handleAddressTap} accessibilityRole="button" accessibilityLabel={`Location: ${locationLabel}. Tap to change.`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, paddingRight: 10, height: 40, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 13, color: locationLabel !== 'near you' ? Palette.inkSoft : Palette.textSecondary, flexShrink: 1 }}>{locCapturing ? 'detecting...' : locationLabel}</Text>
                <ChevronDown size={12} color={Palette.textSecondary} style={{ flexShrink: 0 }} />
              </PressableScale>
            </View>
            <PressableScale onPress={() => { feedback.tap(); setFilterOpen(true); }} accessibilityRole="button" accessibilityLabel={activeFilterCount > 0 ? `Filters — ${activeFilterCount} active` : 'Open filters'}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: activeFilterCount > 0 ? Palette.brand : Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <SlidersHorizontal size={17} color={activeFilterCount > 0 ? '#fff' : Palette.brand} />
              {activeFilterCount > 0 ? (
                <View style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: Palette.brand, lineHeight: 13 }}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </PressableScale>
            {isTabletUp ? (
              <PressableScale onPress={() => { feedback.tap(); setViewMode((m) => m === 'grid' ? 'list' : 'grid'); }} accessibilityRole="button" accessibilityLabel={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
                {viewMode === 'grid' ? <List size={18} color={Palette.inkSoft} /> : <LayoutGrid size={18} color={Palette.inkSoft} />}
              </PressableScale>
            ) : null}
          </View>

          {/* Search bar */}
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} onClear={() => setSearchQuery('')} pad={pad} placeholderIdx={placeholderIdx} />

          {/* Category chips */}
          <CategoryChips active={activeCategory} pad={pad} onSelect={setActiveCategory} />

          {/* Cuisine tabs */}
          <CuisineTabsRow
            active={advFilters.cuisines.length === 1 ? advFilters.cuisines[0] : 'all'}
            pad={pad}
            onSelect={(c) => setAdvFilters((f) => ({ ...f, cuisines: c === 'all' ? [] : [c] }))}
          />

          <ActiveFilterBar
            filters={advFilters}
            pad={pad}
            onRemoveCuisine={(c) => setAdvFilters((f) => ({ ...f, cuisines: f.cuisines.filter((x) => x !== c) }))}
            onRemoveDietary={(d) => setAdvFilters((f) => ({ ...f, dietary: f.dietary.filter((x) => x !== d) }))}
            onRemoveMaxPrice={() => setAdvFilters((f) => ({ ...f, maxPrice: null }))}
            onRemoveMinRating={() => setAdvFilters((f) => ({ ...f, minRating: null }))}
            onRemoveSort={() => setAdvFilters((f) => ({ ...f, sort: FILTER_DEFAULTS.sort }))}
          />
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
          contentContainerStyle={{ paddingBottom: 32 }}>

          {(preppersError || mealsError) && !preppersLoading && !mealsLoading ? (
            <PressableScale onPress={handleRefresh} accessibilityRole="button" accessibilityLabel="Couldn't load meals. Tap to retry."
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: pad, marginTop: 12, backgroundColor: Palette.danger + '14', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }}>
              <AlertCircle size={18} color={Palette.danger} />
              <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger }}>Couldn't load meals. Tap to retry.</Text>
            </PressableScale>
          ) : null}

          {locDenied && advFilters.sort === 'nearest' ? (
            <PressableScale onPress={() => { feedback.tap(); void Linking.openSettings(); }} accessibilityRole="button" accessibilityLabel="Enable location for nearby kitchens"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: pad, marginTop: 8, paddingVertical: 8 }}>
              <MapPin size={13} color={Palette.brand} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.brand }}>Enable location for nearby kitchens</Text>
            </PressableScale>
          ) : null}

          {/* Top kitchens */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <SectionHeader title="top kitchens near you" pad={pad} Icon={Star} onSeeAll={() => router.push('/kitchens')} />
            {preppersLoading ? (
              <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: pad, paddingBottom: 20 }}>
                {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} width={210} />)}
              </View>
            ) : isTabletUp ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {displayPreppers.map((p, i) => (
                  <MotiView key={p.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 40 }} style={{ width: `${100 / prepperCols}%` as never, flexShrink: 1 }}>
                    <PrepperCard prepper={p} showRank isLive={liveSet.has(p.id)} />
                  </MotiView>
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {displayPreppers.map((p, i) => (
                  <MotiView key={p.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
                    <PrepperCard prepper={p} showRank isLive={liveSet.has(p.id)} />
                  </MotiView>
                ))}
              </ScrollView>
            )}
          </MotiView>

          {/* Cuisines */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 40 }}>
            <SectionHeader title="cuisines" pad={pad} Icon={UtensilsCrossed} onSeeAll={() => router.push('/cuisine-explorer')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
              {CUISINES.map((c, i) => (
                <MotiView key={c.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                  <CuisineCard cuisine={c} onPress={() => { feedback.tap(); router.push(`/search?q=${encodeURIComponent(c.name)}`); }} />
                </MotiView>
              ))}
            </ScrollView>
          </MotiView>

          {/* Popular right now */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
            <SectionHeader title="popular right now" pad={pad} Icon={Flame} onSeeAll={() => router.push('/category?key=all&label=all+meals')} />
            {mealsLoading ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} width={mealCardW} />)}
              </View>
            ) : searchQuery.trim().length >= 2 && filteredMeals.length === 0 ? (
              <SearchEmptyState query={searchQuery.trim()} />
            ) : filteredMeals.length === 0 ? (
              <View style={{ paddingHorizontal: pad, paddingBottom: 24, alignItems: 'flex-start', gap: 12 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted }}>
                  {activeCategory !== 'all' && countActiveFilters(advFilters) === 0 ? `No ${activeCategory} meals available right now.` : 'No meals match your current filters.'}
                </Text>
                <PressableScale onPress={() => { feedback.tap(); setActiveCategory('all'); setAdvFilters({ ...FILTER_DEFAULTS }); setSearchQuery(''); }}
                  accessibilityRole="button" accessibilityLabel="Clear all filters"
                  style={{ height: 40, paddingHorizontal: 20, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>reset filters</Text>
                </PressableScale>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {filteredMeals.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                    <MealCard meal={{ ...m, stockRemaining: stockMap[m.id]?.qtyRemaining ?? null }} width={mealCardW} />
                  </MotiView>
                ))}
              </View>
            )}
          </MotiView>

          {/* Limited Drops */}
          {drops && drops.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
              <SectionHeader title="limited drops" pad={pad} Icon={Zap} onSeeAll={() => router.push('/specials')} />
              {isDesktop ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                  {drops.map((m, i) => (
                    <MotiView key={m.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                      <MealCard meal={{ ...m, stockRemaining: stockMap[m.id]?.qtyRemaining ?? null }} width={mealCardW} />
                    </MotiView>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                  {drops.map((m, i) => (
                    <MotiView key={m.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                      <MealCard meal={{ ...m, stockRemaining: stockMap[m.id]?.qtyRemaining ?? null }} width={carouselCardWidth} />
                    </MotiView>
                  ))}
                </ScrollView>
              )}
            </MotiView>
          ) : null}

          {/* For You */}
          {!mealsLoading && forYou.length === 0 && !!user ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
              <SectionHeader title="for you" pad={pad} Icon={Sparkles} />
              <View style={{ marginHorizontal: pad, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={13} color={Palette.brand} />
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Preorder from a few kitchens to unlock personalized picks.</Text>
              </View>
            </MotiView>
          ) : forYou.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
              <SectionHeader title="for you" pad={pad} Icon={Sparkles} onSeeAll={() => router.push('/category?key=all&label=for+you')} />
              {isDesktop ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                  {forYou.map((s, i) => (
                    <MotiView key={s.meal.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                      <View>
                        <MealCard meal={{ ...s.meal, stockRemaining: stockMap[s.meal.id]?.qtyRemaining ?? null }} width={mealCardW} />
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
                        <MealCard meal={{ ...s.meal, stockRemaining: stockMap[s.meal.id]?.qtyRemaining ?? null }} width={carouselCardWidth} />
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

          {/* Can't Decide? */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push('/surprise'); }} accessibilityRole="button" accessibilityLabel="Surprise me — let us pick your meal" style={{ marginHorizontal: pad, marginBottom: 20 }}>
              <View style={{ backgroundColor: Palette.surface, borderRadius: 16, padding: 20, gap: 14, ...Shadow.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.brand + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Shuffle size={22} color={Palette.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 17, color: Palette.ink }}>can't decide?</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2 }}>Tell us your vibe — we'll pick the perfect meal</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: Palette.ink, borderRadius: 24, paddingVertical: 13, alignItems: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>surprise me 🪄</Text>
                </View>
              </View>
            </PressableScale>
          </MotiView>

        </ScrollView>
      </SafeAreaView>

      <ExploreFilterSheet visible={filterOpen} initial={advFilters} isTabletUp={isTabletUp}
        onClose={() => setFilterOpen(false)} onApply={(f) => { setAdvFilters(f); setFilterOpen(false); }} />
    </View>
  );
}
