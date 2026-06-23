import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star, TrendingUp, Clock, CheckCircle } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { usePrepper } from '@/lib/use-prepper';

// ── Types ────────────────────────────────────────────────────────────────────

type PrepperMetrics = {
  average_rating: number | null;
  completion_rate: number;
  total_orders: number;
};

type KitchenMetrics = {
  average_prep_minutes: number | null;
  completed_orders: number;
  cancelled_orders: number;
  utilization_rate: number;
};

type ListingRating = {
  listing_id: string;
  name: string;
  average_rating: number | null;
  orders_count: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ value, size = 14 }: { value: number | null; size?: number }) {
  const filled = Math.round((value ?? 0) * 2) / 2; // nearest 0.5
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          color={filled >= n ? '#F59E0B' : Palette.border}
          fill={filled >= n ? '#F59E0B' : 'transparent'}
          strokeWidth={1.5}
        />
      ))}
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PrepperReviewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { kitchen, loading: kLoading } = usePrepper(true);

  const [metrics, setMetrics] = useState<PrepperMetrics | null>(null);
  const [kitchenM, setKitchenM] = useState<KitchenMetrics | null>(null);
  const [listings, setListings] = useState<ListingRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || !kitchen) return;

    const [pmRes, kmRes, lsRes] = await Promise.all([
      // prepper_metrics: owned by prepper_id = user.id
      supabase
        .from('prepper_metrics')
        .select('average_rating, completion_rate, total_orders')
        .eq('prepper_id', user.id)
        .single(),

      // kitchen_metrics: public read, scoped to this kitchen
      supabase
        .from('kitchen_metrics')
        .select('average_prep_minutes, completed_orders, cancelled_orders, utilization_rate')
        .eq('kitchen_id', kitchen.id)
        .single(),

      // listing_stats joined through listings for kitchen scope
      supabase
        .from('listing_stats')
        .select('listing_id, average_rating, orders_count, listing:listings!inner(name, kitchen_id)')
        .eq('listing.kitchen_id', kitchen.id)
        .not('average_rating', 'is', null)
        .order('average_rating', { ascending: false })
        .limit(20),
    ]);

    if (pmRes.data) setMetrics(pmRes.data as PrepperMetrics);
    if (kmRes.data) setKitchenM(kmRes.data as KitchenMetrics);

    const rows = ((lsRes.data ?? []) as (ListingRating & { listing: { name: string; kitchen_id: string } | null })[])
      .map((r) => ({
        listing_id: r.listing_id,
        name: r.listing?.name ?? 'meal',
        average_rating: r.average_rating,
        orders_count: r.orders_count,
      }));
    setListings(rows);
  }, [user, kitchen]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (kLoading || loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={Palette.brand} /></View>
      </SafeAreaView>
    );
  }

  const rating = metrics?.average_rating ?? null;
  const completionRate = metrics?.completion_rate ?? 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.brand} />}
      >
        {/* ── Back + header ──────────────────────────────────────── */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <ArrowLeft size={20} color={Palette.ink} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ratings</Text>
        </View>

        {/* ── Overall rating hero ───────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroRating}>{rating != null ? rating.toFixed(1) : '—'}</Text>
            <Stars value={rating} size={18} />
            {metrics && (
              <Text style={styles.heroOrders}>from {metrics.total_orders} orders</Text>
            )}
          </View>
          <View style={styles.heroRight}>
            <StatChip label="completion" value={`${completionRate.toFixed(0)}%`} />
            {kitchenM?.average_prep_minutes != null && (
              <StatChip label="avg prep" value={`${Math.round(kitchenM.average_prep_minutes)}m`} />
            )}
          </View>
        </View>

        {/* ── Kitchen performance ───────────────────────────────── */}
        {kitchenM && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>kitchen performance</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <CheckCircle size={16} color={Palette.successDark} strokeWidth={2} />
                <Text style={styles.metricValue}>{kitchenM.completed_orders}</Text>
                <Text style={styles.metricLabel}>completed</Text>
              </View>
              <View style={styles.metricCard}>
                <TrendingUp size={16} color={Palette.brand} strokeWidth={2} />
                <Text style={styles.metricValue}>{kitchenM.utilization_rate.toFixed(0)}%</Text>
                <Text style={styles.metricLabel}>utilisation</Text>
              </View>
              {kitchenM.average_prep_minutes != null && (
                <View style={styles.metricCard}>
                  <Clock size={16} color={Palette.amberDeep} strokeWidth={2} />
                  <Text style={styles.metricValue}>{Math.round(kitchenM.average_prep_minutes)}m</Text>
                  <Text style={styles.metricLabel}>avg prep</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Per-meal ratings ──────────────────────────────────── */}
        {listings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>by meal</Text>
            {listings.map((l) => (
              <View key={l.listing_id} style={styles.mealRow}>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName} numberOfLines={1}>{l.name}</Text>
                  <Text style={styles.mealOrders}>{l.orders_count} orders</Text>
                </View>
                <View style={styles.mealRating}>
                  <Stars value={l.average_rating} size={13} />
                  <Text style={styles.mealRatingText}>
                    {l.average_rating != null ? l.average_rating.toFixed(1) : '—'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Individual reviews placeholder ────────────────────── */}
        <View style={styles.comingSoonCard}>
          <Star size={24} color={Palette.textMuted} strokeWidth={1.4} />
          <Text style={styles.comingSoonTitle}>customer reviews</Text>
          <Text style={styles.comingSoonSub}>
            individual review text and replies are coming in a future update
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 32 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: Palette.surface,
    alignItems: 'center', justifyContent: 'center', ...Shadow.card,
  },
  headerTitle: { fontFamily: Font.display, fontSize: Type.displayLg, color: Palette.ink, letterSpacing: -0.8 },

  heroCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Palette.surface, borderRadius: 20, padding: 20, marginBottom: 20, ...Shadow.card,
  },
  heroLeft: { gap: 6 },
  heroRating: { fontFamily: Font.display, fontSize: 48, color: Palette.ink, letterSpacing: -2, lineHeight: 52 },
  heroOrders: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 4 },
  heroRight: { gap: 12 },

  chip: {
    alignItems: 'center', backgroundColor: Palette.chip,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 8, minWidth: 80,
  },
  chipValue: { fontFamily: Font.display, fontSize: Type.body, color: Palette.ink },
  chipLabel: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },

  metricsGrid: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1, alignItems: 'center', gap: 6, backgroundColor: Palette.surface,
    borderRadius: 16, padding: 14, ...Shadow.card,
  },
  metricValue: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink },
  metricLabel: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary },

  mealRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Palette.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8, ...Shadow.card,
  },
  mealInfo: { flex: 1, marginRight: 12 },
  mealName: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink },
  mealOrders: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 2 },
  mealRating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mealRatingText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.ink },

  comingSoonCard: {
    alignItems: 'center', gap: 10, backgroundColor: Palette.surface,
    borderRadius: 18, padding: 24, ...Shadow.card,
  },
  comingSoonTitle: { fontFamily: Font.display, fontSize: Type.body, color: Palette.ink },
  comingSoonSub: {
    fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
});
