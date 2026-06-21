import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotiView } from 'moti';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpRight, Clock, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { type AdvancedFilters, countActiveFilters, ExploreFilterSheet, FILTER_DEFAULTS } from '@/components/explore-filter-sheet';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { gridCardWidth, useBreakpoint, useCarouselCardWidth, useContentWidth, usePagePadding } from '@/lib/layout';
import { useFeaturedMeals } from '@/lib/queries/meals';
import { usePrepperSearch, useTopPreppers } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

// ─── Recent search persistence ────────────────────────────────────────────────

const RECENT_KEY = 'preppa.recent_searches.v1';
const MAX_RECENT = 8;

async function loadRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function persistSearch(q: string): Promise<void> {
  try {
    const cur = await loadRecent();
    await AsyncStorage.setItem(
      RECENT_KEY,
      JSON.stringify([q, ...cur.filter((r) => r !== q)].slice(0, MAX_RECENT)),
    );
  } catch { /* non-fatal */ }
}

// ─── OmniSearch ───────────────────────────────────────────────────────────────

export function OmniSearch({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const pad = usePagePadding();
  const contentWidth = useContentWidth();
  const carouselCardWidth = useCarouselCardWidth();
  const bp = useBreakpoint();
  const cardWidth = gridCardWidth(contentWidth, pad);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>(() => ({
    ...FILTER_DEFAULTS,
    dietary: (user?.user_metadata?.dietary as string[] | undefined) ?? [],
  }));

  const { data: meals } = useFeaturedMeals();
  const { data: trendingPreppers } = useTopPreppers(6);
  const { data: searchedPreppers } = usePrepperSearch(debouncedQuery);
  const filterCount = countActiveFilters(filters);

  // Load recent searches each time modal opens; reset input
  useEffect(() => {
    if (visible) {
      loadRecent().then(setRecent);
      setQuery('');
      setDebouncedQuery('');
    }
  }, [visible]);

  // 300ms debounce — prevents stale results on fast typing (red-team patch #3)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const hasQuery = debouncedQuery.trim().length >= 2;
  const lc = debouncedQuery.trim().toLowerCase();

  const filteredMeals = useMemo(() => {
    if (!hasQuery) return [];
    let result = (meals ?? []).filter((m) =>
      [m.title, m.prepper, m.category ?? ''].join(' ').toLowerCase().includes(lc),
    );
    if (filters.dietary.length > 0) {
      result = result.filter((m) =>
        filters.dietary.every((d) =>
          [m.title, m.category ?? ''].join(' ').toLowerCase().includes(d.replace('-', ' ')),
        ),
      );
    }
    if (filters.maxPrice !== null) result = result.filter((m) => m.price <= filters.maxPrice!);
    if (filters.minRating !== null) result = result.filter((m) => (m.rating ?? 0) >= filters.minRating!);
    return result.slice(0, 12);
  }, [meals, lc, hasQuery, filters]);

  const filteredPreppers = (hasQuery ? (searchedPreppers ?? []) : []).slice(0, 4);

  function onSearch(q: string) {
    setQuery(q);
    const trimmed = q.trim();
    if (trimmed.length >= 2) {
      void persistSearch(trimmed);
      setRecent((prev) => [trimmed, ...prev.filter((r) => r !== trimmed)].slice(0, MAX_RECENT));
    }
  }

  function onRecentTap(q: string) {
    feedback.tap();
    setQuery(q);
    setDebouncedQuery(q);
  }

  function onSurpriseMe() {
    feedback.tap();
    onClose();
    router.push('/surprise');
  }

  const isTabletUp = bp !== 'mobile';
  const defaultDietary = (user?.user_metadata?.dietary as string[] | undefined) ?? [];

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
        statusBarTranslucent>

        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: Palette.canvas }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* ── Pinned header: search bar + Surprise Me / chips ── */}
          <View style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: pad,
            paddingBottom: 12,
            backgroundColor: Palette.canvas,
            borderBottomWidth: 1,
            borderBottomColor: Palette.border,
          }}>

            {/* Search input row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
                height: 48, borderRadius: 24,
                backgroundColor: Palette.surface,
                paddingHorizontal: 16, gap: 10, ...Shadow.card,
              }}>
                <Search size={17} color={Palette.brand} />
                <TextInput
                  autoFocus
                  style={{ flex: 1, fontFamily: Font.body, fontSize: 15, color: Palette.ink, padding: 0 }}
                  value={query}
                  onChangeText={onSearch}
                  placeholder="Search meals, kitchens…"
                  placeholderTextColor={Palette.textSecondary}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  accessibilityLabel="Search meals or kitchens"
                />
                {query.length > 0 ? (
                  <PressableScale
                    onPress={() => { feedback.tap(); setQuery(''); setDebouncedQuery(''); }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search">
                    <X size={16} color={Palette.textSecondary} />
                  </PressableScale>
                ) : null}
              </View>

              {/* Filter button with active count badge */}
              <PressableScale
                onPress={() => { feedback.tap(); setFilterOpen(true); }}
                accessibilityRole="button"
                accessibilityLabel={filterCount > 0 ? `Filters — ${filterCount} active` : 'Filters'}
                style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: filterCount > 0 ? Palette.brand : Palette.surface,
                  alignItems: 'center', justifyContent: 'center', ...Shadow.card,
                }}>
                <SlidersHorizontal size={18} color={filterCount > 0 ? '#fff' : Palette.brand} />
                {filterCount > 0 ? (
                  <View style={{
                    position: 'absolute', top: 9, right: 9,
                    width: 14, height: 14, borderRadius: 7,
                    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: Palette.brand, lineHeight: 12 }}>
                      {filterCount}
                    </Text>
                  </View>
                ) : null}
              </PressableScale>

              <PressableScale
                onPress={() => { feedback.tap(); onClose(); }}
                accessibilityRole="button"
                accessibilityLabel="Cancel search">
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.brand }}>Cancel</Text>
              </PressableScale>
            </View>

            {/* Surprise Me — full-width hero in zero state, inline chip while typing */}
            {!hasQuery ? (
              <MotiView
                from={{ opacity: 0, translateY: 6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 200 }}>
                <PressableScale
                  onPress={onSurpriseMe}
                  accessibilityRole="button"
                  accessibilityLabel="Surprise me — AI picks your perfect meal"
                  style={{
                    marginTop: 10, height: 46, borderRadius: 23,
                    backgroundColor: Palette.brand,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  <Sparkles size={16} color="#fff" />
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Surprise Me</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
                    · let AI pick the perfect meal
                  </Text>
                </PressableScale>
              </MotiView>
            ) : (
              <MotiView
                from={{ opacity: 0, translateY: -4 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 180 }}>
                <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}>
                  <PressableScale
                    onPress={onSurpriseMe}
                    accessibilityRole="button"
                    accessibilityLabel="Surprise me"
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      height: 32, paddingHorizontal: 14, borderRadius: 16,
                      backgroundColor: Palette.brand,
                    }}>
                    <Sparkles size={13} color="#fff" />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff' }}>Surprise Me</Text>
                  </PressableScale>
                  {filterCount > 0 ? (
                    <PressableScale
                      onPress={() => {
                        feedback.tap();
                        setFilters({ ...FILTER_DEFAULTS, dietary: defaultDietary });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Clear ${filterCount} active filters`}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        height: 32, paddingHorizontal: 14, borderRadius: 16,
                        backgroundColor: Palette.brandTint,
                      }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.brand }}>
                        Clear filters ({filterCount})
                      </Text>
                    </PressableScale>
                  ) : null}
                </View>
              </MotiView>
            )}
          </View>

          {/* ── Scrollable results / zero state ── */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 48 }}>

            {!hasQuery ? (
              /* Zero state: recent searches + trending strip */
              <View>
                {recent.length > 0 ? (
                  <View style={{ paddingTop: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pad, marginBottom: 6 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary, letterSpacing: 0.5 }}>
                        RECENT
                      </Text>
                      <PressableScale
                        onPress={async () => { await AsyncStorage.removeItem(RECENT_KEY); setRecent([]); }}
                        accessibilityRole="button"
                        accessibilityLabel="Clear recent searches">
                        <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.brand }}>Clear</Text>
                      </PressableScale>
                    </View>
                    {recent.map((q) => (
                      <PressableScale
                        key={q}
                        onPress={() => onRecentTap(q)}
                        accessibilityRole="button"
                        accessibilityLabel={`Search ${q}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 11 }}>
                        <Clock size={15} color={Palette.textSecondary} />
                        <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 14.5, color: Palette.ink }}>{q}</Text>
                        <ArrowUpRight size={14} color={Palette.border} />
                      </PressableScale>
                    ))}
                    <View style={{ height: 1, backgroundColor: Palette.border, marginHorizontal: pad, marginTop: 8, marginBottom: 20 }} />
                  </View>
                ) : null}

                {(trendingPreppers ?? []).length > 0 ? (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary, letterSpacing: 0.5, paddingHorizontal: pad, marginBottom: 10 }}>
                      TOP KITCHENS
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 4 }}>
                      {(trendingPreppers ?? []).map((p) => <PrepperCard key={p.id} prepper={p} />)}
                    </ScrollView>
                    <View style={{ height: 1, backgroundColor: Palette.border, marginHorizontal: pad, marginTop: 16 }} />
                  </View>
                ) : null}

                {(meals ?? []).length > 0 ? (
                  <View>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary, letterSpacing: 0.5, paddingHorizontal: pad, marginBottom: 10 }}>
                      TRENDING MEALS
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 4 }}>
                      {(meals ?? []).slice(0, 6).map((m) => (
                        <MealCard key={m.id} meal={{ ...m, stockRemaining: null }} width={carouselCardWidth} />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            ) : (
              /* Live results: KITCHENS + MEALS */
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 160 }}>

                {filteredPreppers.length > 0 ? (
                  <View style={{ paddingTop: 16 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary, letterSpacing: 0.5, paddingHorizontal: pad, marginBottom: 10 }}>
                      KITCHENS
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 4 }}>
                      {filteredPreppers.map((p) => <PrepperCard key={p.id} prepper={p} />)}
                    </ScrollView>
                    <View style={{ height: 1, backgroundColor: Palette.border, marginHorizontal: pad, marginTop: 16 }} />
                  </View>
                ) : null}

                <View style={{ paddingTop: 16 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary, letterSpacing: 0.5, paddingHorizontal: pad, marginBottom: 10 }}>
                    {filteredMeals.length > 0 ? `MEALS · ${filteredMeals.length}` : 'MEALS'}
                  </Text>
                  {filteredMeals.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12 }}>
                      {filteredMeals.map((m) => <MealCard key={m.id} meal={{ ...m, stockRemaining: null }} width={cardWidth} />)}
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: pad }}>
                      <Search size={36} color={Palette.border} />
                      <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, marginTop: 12, textAlign: 'center' }}>
                        No results for "{debouncedQuery.trim()}"
                      </Text>
                    </View>
                  )}
                </View>

              </MotiView>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Filter sheet renders outside the Modal so it layers correctly */}
      <ExploreFilterSheet
        visible={filterOpen}
        initial={filters}
        isTabletUp={isTabletUp}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => { setFilters(f); setFilterOpen(false); }}
      />
    </>
  );
}
