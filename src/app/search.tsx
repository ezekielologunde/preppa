import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpDown, Check, ChevronLeft, Search, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';

import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { useMealSearch, useMealsByIds } from '@/lib/queries/meals';
import { usePrepperSearch } from '@/lib/queries/preppers';
import { useMealCategories } from '@/lib/queries/my-meals';
import { useMyOrders } from '@/lib/queries/orders';
import { useFavoriteKeys } from '@/lib/favorites';
import { useRecentlyViewedIds } from '@/lib/recently-viewed';
import { buildMatchSignals } from '@/lib/match';
import { rankSearchResults, boostBySignals, MEAL_FIELDS, getSuggestions } from '@/lib/search-rank';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

const PRICES = [
  { key: 'under10', label: 'under $10', min: null, max: 10 },
  { key: '10to15', label: '$10–15', min: 10, max: 15 },
  { key: 'over15', label: '$15+', min: 15, max: null },
] as const;
type PriceKey = (typeof PRICES)[number]['key'] | null;

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'top-rated';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Relevance' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'top-rated', label: 'Top rated' },
];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <MotiView
      animate={{
        backgroundColor: selected ? INK : Palette.surface,
        borderColor: selected ? INK : Palette.border,
      }}
      transition={{ type: 'timing', duration: 180 }}
      style={{ borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}>
      <PressableScale
        onPress={() => { feedback.tap(); onPress(); }}
        accessibilityRole="button"
        accessibilityLabel={`Filter: ${label}`}
        accessibilityState={{ selected }}
        style={{ paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: selected ? '#fff' : Palette.inkSoft }}>{label}</Text>
      </PressableScale>
    </MotiView>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const contentWidth = useContentWidth();
  const CARD_W = gridCardWidth(contentWidth);
  const { q } = useLocalSearchParams<{ q?: string }>();
  const initial = (q || '').toString();
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const { user } = useAuth();
  const [text, setText] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priceKey, setPriceKey] = useState<PriceKey>(null);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortOpen, setSortOpen] = useState(false);

  const recentIds = useRecentlyViewedIds().slice(0, 8);
  const { data: recentMeals } = useMealsByIds(recentIds);

  const { data: categories } = useMealCategories();
  const price = PRICES.find((p) => p.key === priceKey);
  const { data: preppers } = usePrepperSearch(debounced);
  const { data: results, isLoading, isFetching } = useMealSearch(debounced, {
    categoryId,
    priceMin: price?.min ?? null,
    priceMax: price?.max ?? null,
  });
  const { data: orders } = useMyOrders(user?.id);
  const favKeys = useFavoriteKeys();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 250);
    return () => clearTimeout(t);
  }, [text]);

  const hasFilters = categoryId !== null || priceKey !== null || sortKey !== 'default';
  const active = debounced.trim().length >= 2 || hasFilters;

  const sortedResults = useMemo(() => {
    if (!results) return results;
    if (sortKey === 'price-asc') return [...results].sort((a, b) => a.price - b.price);
    if (sortKey === 'price-desc') return [...results].sort((a, b) => b.price - a.price);
    if (sortKey === 'top-rated') return [...results].sort((a, b) => b.rating - a.rating);
    if (debounced.trim()) {
      const signals = buildMatchSignals(orders ?? [], favKeys);
      const items = results as unknown as Record<string, unknown>[];
      const ranked = rankSearchResults(debounced, items, MEAL_FIELDS<Record<string, unknown>>());
      return boostBySignals(ranked, signals) as unknown as typeof results;
    }
    return results;
  }, [results, sortKey, debounced, orders, favKeys]);

  const suggestions = useMemo(() => getSuggestions(text), [text]);
  const loading = active && (isLoading || isFetching);

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={isDesktop ? { flex: 1, maxWidth: 900, alignSelf: 'center', width: '100%' } : { flex: 1 }}>
        {/* Search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: 16, paddingHorizontal: 14, height: 50, gap: 8 }}>
            <Search size={19} color={Palette.textMuted} />
            <TextInput
              autoFocus
              value={text}
              onChangeText={setText}
              placeholder="search meals, cuisines, preppers"
              placeholderTextColor={Palette.textMuted}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, fontFamily: Font.body, fontSize: 15, color: INK }}
            />
            {text.length > 0 ? (
              <PressableScale onPress={() => { feedback.tap(); setText(''); }} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
                <X size={18} color={Palette.textMuted} />
              </PressableScale>
            ) : null}
          </View>
        </View>

        {/* Filters — categories then price; tap again to clear */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8, alignItems: 'center' }}>
          {(categories ?? []).map((c) => (
            <Chip key={c.id} label={c.name.toLowerCase()} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
          ))}
          <View style={{ width: 1, height: 22, backgroundColor: Palette.divider, marginHorizontal: 2 }} />
          {PRICES.map((p) => (
            <Chip key={p.key} label={p.label} selected={priceKey === p.key} onPress={() => setPriceKey(priceKey === p.key ? null : p.key)} />
          ))}
          <View style={{ width: 1, height: 22, backgroundColor: Palette.divider, marginHorizontal: 2 }} />
          <MotiView
            animate={{ backgroundColor: sortKey !== 'default' ? INK : Palette.surface }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ borderRadius: Radius.pill, overflow: 'hidden' }}>
            <PressableScale
              onPress={() => { feedback.tap(); setSortOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel={`Sort: ${SORTS.find(s => s.key === sortKey)?.label ?? 'Relevance'}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, height: 36 }}>
              <ArrowUpDown size={14} color={sortKey !== 'default' ? '#fff' : Palette.inkSoft} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: sortKey !== 'default' ? '#fff' : Palette.inkSoft }}>sort</Text>
            </PressableScale>
          </MotiView>
        </ScrollView>

        {/* Results count — visible when query is active and data has loaded */}
        {active && !loading && ((sortedResults?.length ?? 0) > 0 || (preppers?.length ?? 0) > 0) ? (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 200 }}>
            <Text style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2, fontFamily: Font.medium, fontSize: 12, color: Palette.textMuted }}>
              {[
                (sortedResults?.length ?? 0) > 0 ? `${sortedResults!.length} meal${sortedResults!.length !== 1 ? 's' : ''}` : null,
                (preppers?.length ?? 0) > 0 ? `${preppers!.length} kitchen${preppers!.length !== 1 ? 's' : ''}` : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          </MotiView>
        ) : null}

        {/* Results */}
        {!active ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {recentMeals && recentMeals.length > 0 ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, paddingHorizontal: 20, marginTop: 18, marginBottom: 10 }}>recently viewed</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
                  {recentMeals.map((m, i) => (
                    <MotiView key={m.id} from={{ opacity: 0, translateX: 12 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                      <MealCard meal={m} width={160} />
                    </MotiView>
                  ))}
                </ScrollView>
              </MotiView>
            ) : null}
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 260, delay: recentMeals?.length ? 60 : 0 }}
              style={{ alignItems: 'center', padding: 32, gap: 10 }}>
              <Search size={36} color={Palette.textMuted} />
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.textSecondary }}>find your next meal</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>type to search — or tap a filter to browse</Text>
              {suggestions.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                  {suggestions.map((s) => (
                    <PressableScale key={s} onPress={() => { feedback.tap(); setText(s); }} accessibilityRole="button" accessibilityLabel={`Search for ${s}`} style={{ paddingHorizontal: 14, height: 34, borderRadius: Radius.pill, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>{s}</Text>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
            </MotiView>
          </ScrollView>
        ) : loading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 20 }}>
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} width={CARD_W} />)}
          </View>
        ) : (sortedResults && sortedResults.length > 0) || (preppers && preppers.length > 0) ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {preppers && preppers.length > 0 ? (
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 240 }}
                style={{ paddingTop: 14 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, paddingHorizontal: 20, marginBottom: 10 }}>kitchens</Text>
                {isDesktop ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 20, paddingBottom: 4 }}>
                    {preppers.map((p, i) => (
                      <MotiView key={p.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                        <PrepperCard prepper={p} />
                      </MotiView>
                    ))}
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
                    {preppers.map((p, i) => (
                      <MotiView key={p.id} from={{ opacity: 0, translateX: 12 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
                        <PrepperCard prepper={p} />
                      </MotiView>
                    ))}
                  </ScrollView>
                )}
              </MotiView>
            ) : null}
            {sortedResults && sortedResults.length > 0 ? (
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 240, delay: preppers?.length ? 60 : 0 }}
                style={{ padding: 20, paddingTop: 16 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, marginBottom: 12 }}>meals</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {sortedResults.map((m, i) => (
                    <MotiView key={m.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 28 }}>
                      <MealCard meal={m} width={CARD_W} />
                    </MotiView>
                  ))}
                </View>
              </MotiView>
            ) : null}
          </ScrollView>
        ) : (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 240 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>nothing found</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>
              {hasFilters ? 'try removing a filter, or search something else' : 'try a meal, cuisine, or kitchen — like "bowl" or "Kelsey"'}
            </Text>
            {hasFilters ? (
              <PressableScale onPress={() => { feedback.tap(); setCategoryId(null); setPriceKey(null); setSortKey('default'); }} accessibilityRole="button" accessibilityLabel="Clear all filters" style={{ marginTop: 6, paddingHorizontal: 18, height: 42, borderRadius: 12, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>clear filters</Text>
              </PressableScale>
            ) : null}
          </MotiView>
        )}
        </View>
      </SafeAreaView>

      {/* Sort overlay */}
      <Modal visible={sortOpen} transparent animationType="slide" onRequestClose={() => setSortOpen(false)}>
        <Pressable onPress={() => setSortOpen(false)} style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 44, ...(bp !== 'mobile' ? { maxWidth: 480, alignSelf: 'center', width: '100%' } : {}) }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginTop: 12, marginBottom: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 14 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.4 }}>sort by</Text>
              <PressableScale onPress={() => { feedback.tap(); setSortOpen(false); }} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={Palette.textSecondary} />
              </PressableScale>
            </View>
            {SORTS.map((s, i) => (
              <PressableScale
                key={s.key}
                onPress={() => { feedback.tap(); setSortKey(s.key); setSortOpen(false); }}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${s.label}`}
                accessibilityState={{ selected: sortKey === s.key }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                <Text style={{ flex: 1, fontFamily: sortKey === s.key ? Font.semibold : Font.medium, fontSize: 15, color: sortKey === s.key ? ORANGE : INK }}>{s.label}</Text>
                {sortKey === s.key ? <Check size={18} color={ORANGE} /> : null}
              </PressableScale>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
