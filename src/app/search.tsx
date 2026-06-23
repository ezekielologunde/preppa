import { useCallback, useEffect, useRef, useState } from 'react';
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
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

type SearchListing = {
  id: string;
  name: string;
  tagline: string | null;
  price_pence: number;
  dietary_tags: string[] | null;
  kitchen: { display_name: string } | { display_name: string }[] | null;
};

// ── Static data ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',       label: 'all',       query: '' },
  { id: 'breakfast', label: 'breakfast', query: 'breakfast' },
  { id: 'lunch',     label: 'lunch',     query: 'lunch' },
  { id: 'dinner',    label: 'dinner',    query: 'dinner' },
  { id: 'healthy',   label: 'healthy',   query: 'healthy' },
  { id: 'vegan',     label: 'vegan',     query: 'vegan' },
];

// Deterministic gradient per listing (avoids same colour for every card)
const GRADIENTS = [
  ['#E8611A', '#C84E10'],
  ['#FF8C42', '#B94010'],
  ['#F5A623', '#C77800'],
  ['#78C850', '#2A5A00'],
  ['#4DB6E3', '#006A8E'],
] as const;

function pickGradient(id: string): readonly [string, string] {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function kitchenName(k: SearchListing['kitchen']): string {
  if (!k) return '';
  if (Array.isArray(k)) return k[0]?.display_name ?? '';
  return k.display_name;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ResultRow({ item, onPress }: { item: SearchListing; onPress: () => void }) {
  const price    = `£${(item.price_pence / 100).toFixed(2)}`;
  const kitchen  = kitchenName(item.kitchen);
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
  const [results, setResults]   = useState<SearchListing[]>([]);
  const [loading, setLoading]   = useState(false);

  const search = useCallback(async (q: string, cat: string) => {
    setLoading(true);
    let builder = supabase
      .from('listings')
      .select('id, name, tagline, price_pence, dietary_tags, kitchen:kitchens(display_name)')
      .eq('status', 'active');

    if (q.trim()) {
      builder = builder.ilike('name', `%${q.trim()}%`);
    }
    if (cat && cat !== 'all') {
      const catQuery = CATEGORIES.find((c) => c.id === cat)?.query ?? '';
      if (catQuery) builder = builder.ilike('name', `%${catQuery}%`);
    }

    const { data } = await builder.order('name').limit(30);
    setResults((data as SearchListing[]) ?? []);
    setLoading(false);
  }, []);

  // Debounce text input; immediate on category change
  useEffect(() => {
    const delay = query.trim() ? 350 : 0;
    const t = setTimeout(() => search(query, category), delay);
    return () => clearTimeout(t);
  }, [query, category, search]);

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
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {query.trim() ? `no results for "${query}"` : 'what are you craving?'}
              </Text>
              <Text style={styles.emptySub}>
                {query.trim()
                  ? 'try different words or browse a category above'
                  : 'start typing to find meals and kitchens near you'}
              </Text>
            </View>
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

  empty: { paddingTop: 60, alignItems: 'center', paddingHorizontal: Space.xl },
  emptyTitle: {
    fontFamily: Font.display, fontSize: Type.title,
    color: Palette.ink, marginBottom: 8, textAlign: 'center', letterSpacing: -0.3,
  },
  emptySub: {
    fontFamily: Font.body, fontSize: Type.body,
    color: Palette.textSecondary, textAlign: 'center', lineHeight: 22,
  },
});
