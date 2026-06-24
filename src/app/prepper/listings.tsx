import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Pause, Play, Archive, Plus } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, TouchTarget, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { usePrepper } from '@/lib/use-prepper';
import { EmptyState } from '@/components/ui/empty-state';

// ── Types ────────────────────────────────────────────────────────────────────

type ListingStatus = 'active' | 'paused' | 'archived' | 'draft';

type Listing = {
  id: string;
  name: string;
  tagline: string | null;
  price_pence: number;
  status: ListingStatus;
  servings: number | null;
  dietary_tags: string[] | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ListingStatus, { label: string; bg: string; text: string }> = {
  active:   { label: 'live',     bg: Palette.successTint,   text: Palette.successDark   },
  paused:   { label: 'paused',   bg: Palette.amberTint,     text: Palette.amberDeep     },
  archived: { label: 'archived', bg: Palette.cancelledTint, text: Palette.textSecondary  },
  draft:    { label: 'draft',    bg: Palette.chip,          text: Palette.textSecondary  },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function ListingCard({ listing, kitchenId, onMutate }: {
  listing: Listing;
  kitchenId: string;
  onMutate: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const cfg = STATUS_CFG[listing.status] ?? STATUS_CFG.draft;

  const setStatus = async (next: ListingStatus) => {
    if (loading) return;
    setLoading(true);
    const { error } = await supabase
      .from('listings')
      .update({ status: next })
      .eq('id', listing.id)
      .eq('kitchen_id', kitchenId); // ownership guard
    setLoading(false);
    if (error) { Alert.alert('error', error.message); return; }
    onMutate();
  };

  const archive = () =>
    Alert.alert('archive meal', `"${listing.name}" will disappear from search.`, [
      { text: 'cancel', style: 'cancel' },
      { text: 'archive', style: 'destructive', onPress: () => setStatus('archived') },
    ]);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{listing.name}</Text>
          {listing.tagline ? <Text style={styles.cardTagline} numberOfLines={1}>{listing.tagline}</Text> : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <Text style={styles.cardPrice}>£{(listing.price_pence / 100).toFixed(2)}</Text>
        {listing.servings ? <Text style={styles.cardServings}>{listing.servings} servings</Text> : null}
      </View>

      {listing.dietary_tags && listing.dietary_tags.length > 0 && (
        <View style={styles.tagRow}>
          {listing.dietary_tags.slice(0, 3).map((t) => (
            <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
          ))}
        </View>
      )}

      {listing.status !== 'archived' && (
        <View style={styles.actions}>
          {listing.status === 'active' ? (
            <TouchableOpacity
              onPress={() => setStatus('paused')}
              activeOpacity={0.8}
              style={styles.actionBtn}
              accessibilityLabel={`Pause ${listing.name}`}
              accessibilityRole="button"
            >
              <Pause size={14} color={Palette.amberDeep} strokeWidth={2} />
              <Text style={[styles.actionText, { color: Palette.amberDeep }]}>pause</Text>
            </TouchableOpacity>
          ) : listing.status === 'paused' ? (
            <TouchableOpacity
              onPress={() => setStatus('active')}
              activeOpacity={0.8}
              style={styles.actionBtn}
              accessibilityLabel={`Make ${listing.name} live`}
              accessibilityRole="button"
            >
              <Play size={14} color={Palette.successDark} strokeWidth={2} />
              <Text style={[styles.actionText, { color: Palette.successDark }]}>go live</Text>
            </TouchableOpacity>
          ) : null}
          {listing.status !== 'archived' && (
            <TouchableOpacity
              onPress={archive}
              activeOpacity={0.8}
              style={styles.actionBtn}
              accessibilityLabel={`Archive ${listing.name}`}
              accessibilityRole="button"
            >
              <Archive size={14} color={Palette.textMuted} strokeWidth={2} />
              <Text style={[styles.actionText, { color: Palette.textMuted }]}>archive</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PrepperListingsScreen() {
  const router = useRouter();
  const { kitchen, loading: kLoading } = usePrepper(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'paused' | 'archived'>('active');

  const fetchListings = useCallback(async () => {
    if (!kitchen) return;
    const { data } = await supabase
      .from('listings')
      .select('id, name, tagline, price_pence, status, servings, dietary_tags')
      .eq('kitchen_id', kitchen.id) // ownership: only this kitchen's listings
      .eq('status', filter)
      .order('name');
    setListings((data as Listing[]) ?? []);
  }, [kitchen, filter]);

  useEffect(() => {
    setLoading(true);
    fetchListings().finally(() => setLoading(false));
  }, [fetchListings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  }, [fetchListings]);

  if (kLoading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={Palette.brand} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>meals</Text>
        <TouchableOpacity
          onPress={() => router.push('/create-listing' as never)}
          activeOpacity={0.85}
          style={styles.addBtn}
        >
          <Plus size={16} color={Palette.surface} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>add meal</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter pills ─────────────────────────────────────────── */}
      <View style={styles.filterRow}>
        {(['active', 'paused', 'archived'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Palette.brand} /></View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.brand} />}
          ListEmptyComponent={
            <EmptyState
              title={`no ${filter} meals`}
              action={filter === 'active' ? { label: 'create your first meal', onPress: () => router.push('/create-listing' as never) } : undefined}
            />
          }
          renderItem={({ item }) => (
            <ListingCard listing={item} kitchenId={kitchen!.id} onMutate={fetchListings} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontFamily: Font.display, fontSize: Type.displayLg, color: Palette.ink, letterSpacing: -0.8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },

  filterRow: { flexDirection: 'row', paddingHorizontal: Space.xl, gap: Space.md, marginBottom: Space.lg },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Palette.chip, minHeight: TouchTarget, justifyContent: 'center' },
  filterChipActive: { backgroundColor: Palette.brand },
  filterLabel: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.inkSoft },
  filterLabelActive: { color: Palette.surface },

  list: { paddingHorizontal: Space.xl, paddingBottom: Space.xxl },

  card: { backgroundColor: Palette.surface, borderRadius: Radius.card, padding: Space.lg, marginBottom: 12, ...Shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  cardInfo: { flex: 1, marginRight: 12 },
  cardName: { fontFamily: Font.display, fontSize: Type.body, color: Palette.ink },
  cardTagline: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, flexShrink: 0 },
  statusText: { fontFamily: Font.semibold, fontSize: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardPrice: { fontFamily: Font.display, fontSize: Type.label, color: Palette.brand },
  cardServings: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary },
  tagRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginBottom: 12 },
  tag: { backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: Font.semibold, fontSize: 9, color: Palette.brandPressed },
  actions: { flexDirection: 'row', gap: Space.md, borderTopWidth: 1, borderTopColor: Palette.border, paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: Palette.chip, minHeight: TouchTarget, justifyContent: 'center' },
  actionText: { fontFamily: Font.semibold, fontSize: Type.micro },
});
