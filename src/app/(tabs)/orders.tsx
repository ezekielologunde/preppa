import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Package, ShoppingBag } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import type { OrderStatus } from '@/types/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  status: OrderStatus;
  total_pence: number;
  created_at: string;
  kitchen: { display_name: string } | { display_name: string }[] | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVE: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'in_transit'];
const PAST: OrderStatus[]   = ['delivered', 'cancelled', 'refunded'];

function statusCfg(s: OrderStatus) {
  const map: Record<OrderStatus, { label: string; bg: string; text: string }> = {
    pending:    { label: 'pending',    bg: Palette.amberTint,     text: Palette.amberDeep     },
    confirmed:  { label: 'confirmed',  bg: Palette.confirmedTint, text: Palette.confirmedDark  },
    preparing:  { label: 'preparing',  bg: Palette.preparingTint, text: Palette.preparingDark  },
    ready:      { label: 'ready',      bg: Palette.successTint,   text: Palette.successDark    },
    in_transit: { label: 'on the way', bg: Palette.confirmedTint, text: Palette.confirmedDark  },
    delivered:  { label: 'delivered',  bg: Palette.successTint,   text: Palette.successDark    },
    cancelled:  { label: 'cancelled',  bg: Palette.cancelledTint, text: Palette.danger         },
    refunded:   { label: 'refunded',   bg: Palette.cancelledTint, text: Palette.textSecondary  },
  };
  return map[s];
}

function kitchenName(k: OrderRow['kitchen']): string {
  if (!k) return 'unknown kitchen';
  if (Array.isArray(k)) return k[0]?.display_name ?? 'unknown kitchen';
  return k.display_name;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function OrderCard({ order, onPress }: { order: OrderRow; onPress: () => void }) {
  const cfg   = statusCfg(order.status);
  const price = `£${(order.total_pence / 100).toFixed(2)}`;
  const name  = kitchenName(order.kitchen);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78} style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.cardIcon}>
          <Package size={18} color={Palette.brand} strokeWidth={1.8} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardKitchen} numberOfLines={1}>{name}</Text>
          <Text style={styles.cardDate}>{fmtDate(order.created_at)}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardPrice}>{price}</Text>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ tab }: { tab: 'active' | 'past' }) {
  const router = useRouter();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <ShoppingBag size={32} color={Palette.textMuted} strokeWidth={1.4} />
      </View>
      <Text style={styles.emptyTitle}>
        {tab === 'active' ? 'no active orders' : 'no past orders'}
      </Text>
      <Text style={styles.emptySub}>
        {tab === 'active'
          ? 'your ongoing orders will appear here'
          : 'your order history will appear here'}
      </Text>
      {tab === 'active' && (
        <TouchableOpacity
          onPress={() => router.push('/search' as never)}
          activeOpacity={0.85}
          style={styles.emptyBtn}
        >
          <Text style={styles.emptyBtnText}>browse meals</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const { user } = useAuth();
  const router   = useRouter();
  const params   = useLocalSearchParams<{ paid?: string }>();

  const [tab, setTab]             = useState<'active' | 'past'>('active');
  const [orders, setOrders]       = useState<OrderRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paidBanner, setPaidBanner] = useState(params.paid === '1');

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const statuses = tab === 'active' ? ACTIVE : PAST;
    const { data } = await supabase
      .from('orders')
      .select('id, status, total_pence, created_at, kitchen:kitchens(display_name)')
      .eq('customer_id', user.id)
      .in('status', statuses)
      .order('created_at', { ascending: false });
    setOrders((data as OrderRow[]) ?? []);
  }, [user, tab]);

  useEffect(() => {
    setLoading(true);
    fetchOrders().finally(() => setLoading(false));
  }, [fetchOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  if (!user) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <ShoppingBag size={32} color={Palette.textMuted} strokeWidth={1.4} />
          </View>
          <Text style={styles.emptyTitle}>sign in to view orders</Text>
          <TouchableOpacity
            onPress={() => router.push('/auth' as never)}
            activeOpacity={0.85}
            style={styles.emptyBtn}
          >
            <Text style={styles.emptyBtnText}>sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>your orders</Text>
      </View>

      {/* ── Success banner (after payment return) ────────────────── */}
      {paidBanner && (
        <Pressable onPress={() => setPaidBanner(false)} style={styles.paidBanner}>
          <Text style={styles.paidBannerText}>
            ✓ payment received — your order is confirmed!
          </Text>
        </Pressable>
      )}

      {/* ── Tab switcher ─────────────────────────────────────────── */}
      <View style={styles.tabContainer}>
        <TabSwitcher
          tabs={[{ key: 'active', label: 'active' }, { key: 'past', label: 'past' }]}
          selected={tab}
          onSelect={(key) => setTab(key as 'active' | 'past')}
        />
      </View>

      {/* ── Content ──────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => <View key={i} style={styles.skeletonCard} />)}
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Palette.brand}
            />
          }
          ListEmptyComponent={<EmptyState tab={tab} />}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push(`/order/${item.id}` as never)}
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

  header: { paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 16 },
  headerTitle: {
    fontFamily: Font.display, fontSize: Type.displayLg,
    color: Palette.ink, letterSpacing: -0.8,
  },

  paidBanner: {
    marginHorizontal: Space.xl, marginBottom: 12,
    borderRadius: Radius.sm, backgroundColor: Palette.successTint,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  paidBannerText: {
    fontFamily: Font.semibold, fontSize: Type.label, color: Palette.successDark,
  },

  tabContainer: { marginHorizontal: Space.xl, marginBottom: 16 },

  list: { paddingHorizontal: Space.xl, paddingBottom: 32 },
  skeletons: { paddingHorizontal: Space.xl, gap: 12 },
  skeletonCard: { height: 76, borderRadius: 18, backgroundColor: Palette.chip },

  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Palette.surface, borderRadius: 18,
    padding: 16, marginBottom: 10, ...Shadow.card,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Palette.brandTint,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardKitchen: { fontFamily: Font.display, fontSize: Type.body, color: Palette.ink },
  cardDate: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  cardPrice: { fontFamily: Font.display, fontSize: Type.label, color: Palette.ink },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  badgeText: { fontFamily: Font.semibold, fontSize: 10 },

  empty: {
    flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: Space.xl,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: Font.display, fontSize: Type.title,
    color: Palette.ink, marginBottom: 8, letterSpacing: -0.3,
  },
  emptySub: {
    fontFamily: Font.body, fontSize: Type.body,
    color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: Palette.brand, borderRadius: Radius.pill,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  emptyBtnText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },
});
