import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ChevronDown,
  Coffee,
  Compass,
  Cookie,
  Flame,
  IceCream,
  LayoutGrid,
  List,
  Moon,
  MoreHorizontal,
  QrCode,
  Search,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Star,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { MotiView } from 'moti';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CuisineCard } from '@/components/cuisine-card';
import { type AdvancedFilters, countActiveFilters, ExploreFilterSheet, FILTER_DEFAULTS } from '@/components/explore-filter-sheet';
import { QuickAddButton } from '@/components/home-feed';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { CUISINES, SEARCH_PLACEHOLDERS } from '@/lib/explore-constants';
import {
  gridCardWidth,
  useBreakpoint,
  useCarouselCardWidth,
  useContentWidth,
  usePagePadding,
} from '@/lib/layout';
import { useRankedPreppers } from '@/lib/match';
import { useAddresses } from '@/lib/queries/addresses';
import { useDeviceLocation, usePurgeGpsAddresses } from '@/lib/use-location';
import { useFeaturedMeals, useLimitedDrops } from '@/lib/queries/meals';
import { useTopPreppers } from '@/lib/queries/preppers';
import { usePersonalizedMeals } from '@/lib/queries/recommend';
import { useAuth } from '@/providers/auth-provider';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CIRCLES = [
  { key: 'all',       label: 'all',       Icon: LayoutGrid,      color: Palette.ink },
  { key: 'breakfast', label: 'breakfast', Icon: Coffee,          color: Palette.amber },
  { key: 'lunch',     label: 'lunch',     Icon: UtensilsCrossed, color: Palette.success },
  { key: 'dinner',    label: 'dinner',    Icon: Moon,            color: Palette.brand },
  { key: 'snacks',    label: 'snacks',    Icon: Cookie,          color: '#F97316' },
  { key: 'desserts',  label: 'desserts',  Icon: IceCream,        color: '#EC4899' },
  { key: 'more',      label: 'more',      Icon: MoreHorizontal,  color: Palette.textSecondary },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, pad, Icon, onSeeAll }: { title: string; pad: number; Icon?: ComponentType<{ size?: number; color?: string }>; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pad, marginTop: 12, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {Icon ? <Icon size={16} color={Palette.brand} /> : null}
        <Text style={{ fontFamily: Font.display, fontSize: 17, color: Palette.ink, letterSpacing: -0.35 }}>{title}</Text>
      </View>
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingVertical: 8 }}>
      {CATEGORY_CIRCLES.map((c) => {
        const isActive = c.key === active;
        return (
          <PressableScale key={c.key} onPress={() => { feedback.tap(); onSelect(c.key); }} accessibilityRole="button" accessibilityLabel={`Filter by ${c.label}`} style={{ alignItems: 'center', gap: 5 }}>
            <MotiView
              animate={{ backgroundColor: isActive ? Palette.brandTint : Palette.surface, borderColor: isActive ? '#F6C6AC' : 'transparent' }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, ...(!isActive ? Shadow.card : {}) }}>
              <c.Icon size={22} color={isActive ? Palette.brand : c.color} />
            </MotiView>
            <Text style={{ fontFamily: Font.medium, fontSize: 10.5, color: isActive ? Palette.brand : Palette.textSecondary }}>{c.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}


function ActiveFilterBar({
  activeCategory, dietary, sort, pad, onClearCategory, onClearDietary, onClearSort,
}: {
  activeCategory: string; dietary: string[]; sort: string; pad: number;
  onClearCategory: () => void; onClearDietary: (d: string) => void; onClearSort: () => void;
}) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (activeCategory !== 'all') {
    const cat = CATEGORY_CIRCLES.find((c) => c.key === activeCategory);
    chips.push({ key: 'cat', label: cat?.label ?? activeCategory, onRemove: onClearCategory });
  }
  dietary.forEach((d) => chips.push({ key: `diet-${d}`, label: d, onRemove: () => onClearDietary(d) }));
  if (sort !== FILTER_DEFAULTS.sort) chips.push({ key: 'sort', label: sort, onRemove: onClearSort });
  if (chips.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 6, paddingBottom: 6 }}>
      {chips.map((chip) => (
        <PressableScale key={chip.key} onPress={() => { feedback.tap(); chip.onRemove(); }} accessibilityRole="button" accessibilityLabel={`Remove filter: ${chip.label}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: Palette.brandTint, borderWidth: 1, borderColor: '#F6C6AC' }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.brand }}>{chip.label}</Text>
          <X size={10} color={Palette.brand} />
        </PressableScale>
      ))}
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
  const forYou = usePersonalizedMeals(meals ?? [], user?.id, user?.user_metadata ?? null).slice(0, 6);
  const rankedPreppers = useRankedPreppers(preppers ?? [], user?.id);

  const { data: addresses = [] } = useAddresses(user?.id);
  const { loc, requestDeviceLocation } = useDeviceLocation();
  const locCapturing = loc.status === 'requesting';
  usePurgeGpsAddresses(user?.id);
  // Label: prefer live device location, fall back to saved default address, then 'near you'
  const locationLabel = loc.status === 'granted' && loc.city
    ? [loc.city, loc.state].filter(Boolean).join(', ')
    : (() => {
        const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
        return defaultAddress ? [defaultAddress.city, defaultAddress.state].filter(Boolean).join(', ') : 'near you';
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

  const [refreshing, setRefreshing]     = useState(false);
  const [filterOpen, setFilterOpen]     = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode]         = useState<'list' | 'grid'>('grid');
  const userDietary = (user?.user_metadata?.dietary as string[] | undefined) ?? [];
  const [advFilters, setAdvFilters]     = useState<AdvancedFilters>(() => ({
    ...FILTER_DEFAULTS,
    dietary: userDietary.map((d: string) => d.toLowerCase()),
  }));
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

  const activeFilterCount = countActiveFilters(advFilters);

  function handleCategorySelect(key: string) {
    if (key === 'more') { feedback.tap(); router.push('/search'); return; }
    setActiveCategory(key);
  }

  const filteredMeals = useMemo(() => {
    const catKey = activeCategory === 'all' ? null : activeCategory;
    const afterCat = catKey
      ? (meals ?? []).filter((m) => [m.title, m.category ?? ''].join(' ').toLowerCase().includes(catKey.replace('-', ' ')))
      : (meals ?? []);
    const afterDiet = advFilters.dietary.length === 0
      ? afterCat
      : afterCat.filter((m) => {
          const hay = [m.title, m.category ?? ''].join(' ').toLowerCase();
          return advFilters.dietary.every((d) => hay.includes(d.replace('-', ' ')));
        });
    if (advFilters.sort === 'rating') return [...afterDiet].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
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

          {/* Top row: title | location | filter | [tablet: view toggle] */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingTop: 8, paddingBottom: 2, gap: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.9 }}>explore</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: Radius.pill, height: 40, maxWidth: 200, overflow: 'hidden', ...Shadow.card }}>
              <PressableScale onPress={handleGpsTap} accessibilityRole="button" accessibilityLabel="Detect my location"
                style={{ paddingLeft: 11, paddingRight: 7, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                {locCapturing
                  ? <ActivityIndicator size="small" color={Palette.brand} />
                  : <Compass size={13} color={loc.status === 'granted' ? Palette.brand : Palette.textMuted} />}
              </PressableScale>
              <PressableScale onPress={handleAddressTap} accessibilityRole="button" accessibilityLabel={`Location: ${locationLabel}. Tap to change.`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, paddingRight: 10, height: 40, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 13, color: locationLabel !== 'near you' ? Palette.inkSoft : Palette.textMuted, flexShrink: 1 }}>
                  {locCapturing ? 'detecting...' : locationLabel}
                </Text>
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

          {/* Search + QR */}
          <View style={{ paddingHorizontal: pad, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }} accessibilityRole="search" accessibilityLabel="Search meals or kitchens"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, backgroundColor: Palette.surface, paddingHorizontal: 14, gap: 10, overflow: 'hidden', ...Shadow.card }}>
              <Search size={18} color={Palette.textMuted} />
              <MotiView key={placeholderIdx} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 400 }} style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted }}>
                  {SEARCH_PLACEHOLDERS[placeholderIdx]}
                </Text>
              </MotiView>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); router.push('/qr-scan' as never); }} accessibilityRole="button" accessibilityLabel="Scan QR code"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <QrCode size={18} color={Palette.textMuted} />
            </PressableScale>
          </View>

          {/* Category icon circles */}
          <CategoryCircles active={activeCategory} pad={pad} onSelect={handleCategorySelect} />
          <ActiveFilterBar
            activeCategory={activeCategory}
            dietary={advFilters.dietary}
            sort={advFilters.sort}
            pad={pad}
            onClearCategory={() => setActiveCategory('all')}
            onClearDietary={(d) => setAdvFilters((f) => ({ ...f, dietary: f.dietary.filter((x) => x !== d) }))}
            onClearSort={() => setAdvFilters((f) => ({ ...f, sort: FILTER_DEFAULTS.sort }))}
          />
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

          {/* Top Preppers Near You — dynamic/personalized first */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <SectionHeader title="top kitchens near you" pad={pad} Icon={Star} onSeeAll={() => router.push('/kitchens')} />
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

          {/* Meals Grid */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
            <SectionHeader title="popular right now" pad={pad} Icon={Flame} onSeeAll={() => router.push('/category?key=all&label=all+meals')} />
            {mealsLoading ? (
              <View style={{ paddingBottom: 20 }}><CardRowSkeleton count={4} /></View>
            ) : filteredMeals.length === 0 ? (
              <View style={{ paddingHorizontal: pad, paddingBottom: 24, alignItems: 'flex-start', gap: 12 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted }}>
                  {activeCategory !== 'all' && advFilters.dietary.length === 0
                    ? `No ${activeCategory} meals available right now.`
                    : 'No meals match your current filters.'}
                </Text>
                <PressableScale
                  onPress={() => { feedback.tap(); setActiveCategory('all'); setAdvFilters(FILTER_DEFAULTS); }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all filters"
                  style={{ height: 40, paddingHorizontal: 20, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>reset filters</Text>
                </PressableScale>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                {filteredMeals.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                    <MealCard meal={m} width={mealCardW} action={<QuickAddButton meal={m} />} />
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
                      <MealCard meal={m} width={mealCardW} action={<QuickAddButton meal={m} />} />
                    </MotiView>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                  {drops.map((m, i) => (
                    <MotiView key={m.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                      <MealCard meal={m} width={carouselCardWidth} action={<QuickAddButton meal={m} />} />
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
                        <MealCard meal={s.meal} width={mealCardW} action={<QuickAddButton meal={s.meal} />} />
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
                        <MealCard meal={s.meal} width={carouselCardWidth} action={<QuickAddButton meal={s.meal} />} />
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
            <PressableScale onPress={() => { feedback.tap(); router.push('/surprise'); }} accessibilityRole="button" accessibilityLabel="Surprise me — let us pick your meal"
              style={{ marginHorizontal: pad, marginBottom: 20 }}>
              <View style={{ backgroundColor: Palette.surface, borderRadius: 16, padding: 20, gap: 14, borderWidth: 1, borderColor: Palette.border, ...Shadow.card }}>
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
