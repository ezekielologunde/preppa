import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { useMealSearch } from '@/lib/queries/meals';
import { usePrepperSearch } from '@/lib/queries/preppers';
import { useMealCategories } from '@/lib/queries/my-meals';

const ORANGE = Palette.brand;
const INK = Palette.ink;

const PRICES = [
  { key: 'under10', label: 'under $10', min: null, max: 10 },
  { key: '10to15', label: '$10–15', min: 10, max: 15 },
  { key: 'over15', label: '$15+', min: 15, max: null },
] as const;
type PriceKey = (typeof PRICES)[number]['key'] | null;

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected }}
      style={{
        paddingHorizontal: 14,
        height: 36,
        borderRadius: 999,
        backgroundColor: selected ? INK : '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: selected ? '#fff' : Palette.inkSoft }}>{label}</Text>
    </PressableScale>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  // Frame-aware grid: 2 columns on phones, 3 on tablet, 4 on desktop.
  const CARD_W = gridCardWidth(useContentWidth());
  const { q } = useLocalSearchParams<{ q?: string }>();
  const initial = (q || '').toString();
  const [text, setText] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priceKey, setPriceKey] = useState<PriceKey>(null);

  const { data: categories } = useMealCategories();
  const price = PRICES.find((p) => p.key === priceKey);
  const { data: preppers } = usePrepperSearch(debounced);
  const { data: results, isLoading, isFetching } = useMealSearch(debounced, {
    categoryId,
    priceMin: price?.min ?? null,
    priceMax: price?.max ?? null,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 250);
    return () => clearTimeout(t);
  }, [text]);

  const hasFilters = categoryId !== null || priceKey !== null;
  const active = debounced.trim().length >= 2 || hasFilters;
  const loading = active && (isLoading || isFetching);

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8 }}>
          <PressableScale onPress={() => router.back()} accessibilityLabel="Back" style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={24} color={INK} />
          </PressableScale>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, height: 50, gap: 8 }}>
            <Search size={19} color={Palette.textMuted} />
            <TextInput
              autoFocus
              value={text}
              onChangeText={setText}
              placeholder="search meals, cuisines, preppers"
              placeholderTextColor={Palette.textMuted}
              returnKeyType="search"
              style={{ flex: 1, fontFamily: Font.body, fontSize: 15, color: INK }}
            />
            {text.length > 0 ? (
              <Pressable onPress={() => setText('')} accessibilityLabel="Clear" hitSlop={8}>
                <X size={18} color={Palette.textMuted} />
              </Pressable>
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
        </ScrollView>

        {/* Results */}
        {!active ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <Search size={40} color={Palette.divider} />
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.textSecondary }}>find your next meal</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>type to search — or tap a filter to browse</Text>
          </View>
        ) : loading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 20 }}>
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} width={CARD_W} />)}
          </View>
        ) : (results && results.length > 0) || (preppers && preppers.length > 0) ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {preppers && preppers.length > 0 ? (
              <View style={{ paddingTop: 14 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, paddingHorizontal: 20, marginBottom: 10 }}>kitchens</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
                  {preppers.map((p) => <PrepperCard key={p.id} prepper={p} />)}
                </ScrollView>
              </View>
            ) : null}
            {results && results.length > 0 ? (
              <View style={{ padding: 20, paddingTop: 16 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, marginBottom: 12 }}>meals</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {results.map((m) => <MealCard key={m.id} meal={m} width={CARD_W} />)}
                </View>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>nothing found</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>
              {hasFilters ? 'try removing a filter, or search something else' : 'try a meal, cuisine, or kitchen — like "bowl" or "Kelsey"'}
            </Text>
            {hasFilters ? (
              <PressableScale onPress={() => { setCategoryId(null); setPriceKey(null); }} accessibilityRole="button" accessibilityLabel="Clear all filters" style={{ marginTop: 6, paddingHorizontal: 18, height: 42, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>clear filters</Text>
              </PressableScale>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
