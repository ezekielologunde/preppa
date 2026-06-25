import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Font } from '@/constants/fonts';
import { Gradients, Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { formatMoney } from '@/lib/currency';
import { searchListings, type ListingWithCover, type SearchFilters } from '@/lib/search-service';
import { EmptyState } from '@/components/ui/empty-state';

// ── Static data ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',       label: 'all' },
  { id: 'breakfast', label: 'breakfast' },
  { id: 'lunch',     label: 'lunch' },
  { id: 'dinner',    label: 'dinner' },
  { id: 'healthy',   label: 'healthy' },
  { id: 'vegan',     label: 'vegan' },
] as const;

// Map a category chip to structured filters (vegan → dietary tag, the rest →
// use-case facets that match how listings are tagged in the DB).
function categoryFilter(cat: string): Partial<SearchFilters> {
  if (cat === 'all') return {};
  if (cat === 'vegan') return { dietaryTags: ['vegan'] };
  return { useCases: [cat] };
}

// Deterministic gradient per listing (avoids same colour for every card)
const GRADIENTS = [
  Gradients.brand,
  Gradients.mealWarm,
  Gradients.mealGold,
  Gradients.mealGreen,
  Gradients.mealBlue,
] as const;

function pickGradient(id: string): readonly [string, string] {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ResultRow({ item, onPress }: { item: ListingWithCover; onPress: () => void }) {
  const price    = formatMoney(item.price_pence);
  const kitchen  = item.kitchen_name;
  const tags     = (item.dietary_tags ?? []).slice(0, 3);
  const gradient = pickGradient(item.id);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78} style={styles.row}>
      <View style={styles.rowPhoto}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={2}>{item.name}</Text>
        {kitchen ? (
          <Text style={styles.rowKitchen} numberOfLines={1}>by {kitchen}</Text>
        ) : null}
        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Text style={styles.rowPrice}>{price}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router   = useRouter();
  const params   = useLocalSearchParams<{ q?: string }>();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery]       = useState(params.q ?? '');
  const [category, setCategory] = useState('all');

  // Debounce the free-text query so we don't fire a request per keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const delay = query.trim() ? 350 : 0;
    const t = setTimeout(() => setDebouncedQuery(query), delay);
    return () => clearTimeout(t);
  }, [query]);

  const filters = useMemo<SearchFilters>(() => ({
    query: debouncedQuery.trim() || undefined,
    ...categoryFilter(category),
  }), [debouncedQuery, category]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search-listings', filters],
    queryFn: () => searchListings(filters, 30),
  });
  const loading = isFetching;

  // Auto-focus after first paint
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Search header ────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.backBtn}
          hitSlop={8}
        >
          <ArrowLeft size={20} color={Palette.ink} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <Search size={15} color={Palette.textSecondary} strokeWidth={2} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="search meals, kitchens…"
            placeholderTextColor={Palette.textMuted}
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={15} color={Palette.textMuted} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Category chips ───────────────────────────────────────── */}
      <FlatList
        data={CATEGORIES}
        keyExtractor={(c) => c.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
        style={styles.chipScroll}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setCategory(item.id)}
            activeOpacity={0.75}
            style={[styles.chip, category === item.id && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, category === item.id && styles.chipLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Results ──────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3].map((i) => <View key={i} style={styles.skeletonRow} />)}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.results}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title={query.trim() ? `no results for "${query}"` : 'what are you craving?'}
              sub={query.trim()
                ? 'try different words or browse a category above'
                : 'start typing to find meals and kitchens near you'}
            />
          }
          renderItem={({ item }) => (
            <ResultRow
              item={item}
              onPress={() => router.push(`/meal/${item.id}` as never)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 14,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: Palette.surface,
    borderWidth: 1, borderColor: Palette.border,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.card, flexShrink: 0,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 48, borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1, borderColor: Palette.border,
    paddingHorizontal: 16, ...Shadow.card,
  },
  input: {
    flex: 1, fontFamily: Font.body, fontSize: Type.body,
    color: Palette.ink, paddingVertical: 0,
  },

  chipScroll: { maxHeight: 48, marginBottom: 8 },
  chipList: { paddingLeft: Space.xl, paddingRight: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: Radius.pill, backgroundColor: Palette.chip, marginRight: 8,
  },
  chipActive: { backgroundColor: Palette.brand },
  chipLabel: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.inkSoft },
  chipLabelActive: { color: Palette.surface },

  results: { paddingHorizontal: Space.xl, paddingTop: 4, paddingBottom: 32 },
  skeletons: { paddingHorizontal: Space.xl, gap: 10, paddingTop: 8 },
  skeletonRow: { height: 76, borderRadius: 14, backgroundColor: Palette.chip },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Palette.surface, borderRadius: 16,
    padding: 14, marginBottom: 10, ...Shadow.card,
  },
  rowPhoto: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', flexShrink: 0 },
  rowInfo: { flex: 1 },
  rowName: {
    fontFamily: Font.display, fontSize: Type.label,
    color: Palette.ink, lineHeight: 18,
  },
  rowKitchen: {
    fontFamily: Font.body, fontSize: Type.micro,
    color: Palette.textSecondary, marginTop: 2,
  },
  tagRow: { flexDirection: 'row', gap: 4, marginTop: 5, flexWrap: 'wrap' },
  tag: {
    backgroundColor: Palette.brandTint, borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  tagText: { fontFamily: Font.semibold, fontSize: 9, color: Palette.brandPressed },
  rowPrice: { fontFamily: Font.display, fontSize: Type.label, color: Palette.brand, flexShrink: 0 },

});
