import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
import { usePrepper } from '@/lib/use-prepper';
import { StatCard } from '@/components/ui/stat-card';

type DayStats = {
  orderCount: number;
  revenuePence: number;
  pending: number;
};

type ActiveOrder = {
  id: string;
  status: string;
  total_pence: number;
  created_at: string;
  customer_email: string | null;
};

export default function PrepperDashboard() {
  const router = useRouter();
  const { kitchen, loading: kLoading, refresh } = usePrepper(true);
  const [stats, setStats] = useState<DayStats | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (kitchen) setIsOpen(kitchen.is_open ?? false);
  }, [kitchen]);

  const fetchData = useCallback(async () => {
    if (!kitchen) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const [ordersRes, activeRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, total_pence')
        .eq('kitchen_id', kitchen.id)
        .gte('created_at', todayISO),
      supabase
        .from('orders')
        .select('id, status, total_pence, created_at')
        .eq('kitchen_id', kitchen.id)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: true })
        .limit(5),
    ]);

    const todayOrders = (ordersRes.data ?? []) as { status: string; total_pence: number }[];
    const revenue = todayOrders.reduce((s, o) => s + (o.total_pence ?? 0), 0);
    const pending = todayOrders.filter((o) => o.status === 'pending').length;

    setStats({ orderCount: todayOrders.length, revenuePence: revenue, pending });
    setActiveOrders((activeRes.data ?? []) as ActiveOrder[]);
  }, [kitchen]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    await fetchData();
    setRefreshing(false);
  }, [fetchData, refresh]);

  const toggleOpen = async (val: boolean) => {
    if (!kitchen || togglingOpen) return;
    setTogglingOpen(true);
    setIsOpen(val);
    await supabase
      .from('kitchens')
      .update({ is_open: val })
      .eq('id', kitchen.id);
    setTogglingOpen(false);
  };

  if (kLoading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={Palette.brand} /></View>
      </SafeAreaView>
    );
  }

  if (!kitchen) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.noKitchenTitle}>kitchen not found</Text>
          <Text style={styles.noKitchenSub}>your account isn't linked to a kitchen yet</Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)' as never)} style={styles.backToCustomerBtn}>
            <Text style={styles.backToCustomerText}>back to customer mode</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const revenue = stats ? `£${(stats.revenuePence / 100).toFixed(2)}` : '—';
  const score = kitchen.health_score != null ? `${kitchen.health_score}` : '—';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.brand} />}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>prep dashboard</Text>
            <Text style={styles.kitchenName} numberOfLines={1}>{kitchen.display_name}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)' as never)}
            style={styles.exitBtn}
            accessibilityLabel="Switch to customer mode"
            accessibilityRole="button"
          >
            <ArrowLeft size={18} color={Palette.textSecondary} strokeWidth={2} />
            <Text style={styles.exitBtnText}>customer</Text>
          </TouchableOpacity>
        </View>

        {/* ── Kitchen open/closed toggle ──────────────────────────── */}
        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, { backgroundColor: isOpen ? Palette.successDark : Palette.danger }]} />
            <View>
              <Text style={styles.statusLabel}>{isOpen ? 'accepting orders' : 'kitchen closed'}</Text>
              <Text style={styles.statusSub}>{isOpen ? 'customers can order now' : 'customers see you as closed'}</Text>
            </View>
          </View>
          <Switch
            value={isOpen}
            onValueChange={toggleOpen}
            disabled={togglingOpen}
            trackColor={{ true: Palette.brand, false: Palette.border }}
            thumbColor={Palette.surface}
          />
        </View>

        {/* ── Today stats ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>today</Text>
        <View style={styles.statsRow}>
          <StatCard label="orders" value={String(stats?.orderCount ?? 0)} />
          <StatCard label="revenue" value={revenue} accent />
          <StatCard label="pending" value={String(stats?.pending ?? 0)} sub="need action" />
        </View>

        {/* ── Health score / ratings link ────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push('/prepper/reviews' as never)}
          activeOpacity={0.78}
          style={styles.healthCard}
          accessibilityLabel={`Health score ${score}, tap to view ratings`}
          accessibilityRole="button"
        >
          <View style={styles.healthLeft}>
            <Star size={18} color={Palette.amberDeep} strokeWidth={1.8} />
            <Text style={styles.healthLabel}>health score</Text>
          </View>
          <View style={styles.healthRight}>
            <Text style={[styles.healthScore, { color: (kitchen.health_score ?? 0) >= 80 ? Palette.successDark : Palette.amberDeep }]}>
              {score}
            </Text>
            <Text style={styles.seeAll}>ratings →</Text>
          </View>
        </TouchableOpacity>

        {/* ── Active orders ──────────────────────────────────────── */}
        {activeOrders.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>active orders</Text>
              <TouchableOpacity onPress={() => router.push('/prepper/orders' as never)}>
                <Text style={styles.seeAll}>see all</Text>
              </TouchableOpacity>
            </View>
            {activeOrders.map((o) => (
              <TouchableOpacity
                key={o.id}
                onPress={() => router.push(`/prepper/orders` as never)}
                activeOpacity={0.78}
                style={styles.orderCard}
                accessibilityLabel={`Order ${o.status}, placed at ${new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, £${(o.total_pence / 100).toFixed(2)}`}
                accessibilityRole="button"
              >
                <View style={styles.orderLeft}>
                  <View style={[styles.orderStatusDot, {
                    backgroundColor: o.status === 'pending' ? Palette.amberDeep
                      : o.status === 'confirmed' ? Palette.confirmedDark
                      : o.status === 'preparing' ? Palette.brand
                      : Palette.successDark,
                  }]} />
                  <View>
                    <Text style={styles.orderStatus}>{o.status}</Text>
                    <Text style={styles.orderTime}>{new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
                <Text style={styles.orderTotal}>£{(o.total_pence / 100).toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {activeOrders.length === 0 && stats !== null && (
          <View style={styles.emptyOrders}>
            <CheckCircle size={28} color={Palette.textMuted} strokeWidth={1.4} />
            <Text style={styles.emptyOrdersText}>no active orders right now</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  scroll: { paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 32 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  kitchenName: { fontFamily: Font.display, fontSize: Type.displayLg, color: Palette.ink, letterSpacing: -0.8, marginTop: 2 },
  exitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: Radius.pill, backgroundColor: Palette.chip },
  exitBtnText: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Palette.surface, borderRadius: 18, padding: 18, marginBottom: 20, ...Shadow.card,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontFamily: Font.display, fontSize: Type.label, color: Palette.ink },
  statusSub: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 2 },

  sectionTitle: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  seeAll: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.brand },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },

  healthCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Palette.surface, borderRadius: 16, padding: 16, marginBottom: 20, ...Shadow.card,
  },
  healthLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  healthRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  healthLabel: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink },
  healthScore: { fontFamily: Font.display, fontSize: Type.title },

  orderCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Palette.surface, borderRadius: 14, padding: 14, marginBottom: 8, ...Shadow.card,
  },
  orderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderStatusDot: { width: 8, height: 8, borderRadius: 4 },
  orderStatus: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink },
  orderTime: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 1 },
  orderTotal: { fontFamily: Font.display, fontSize: Type.label, color: Palette.brand },

  emptyOrders: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyOrdersText: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textMuted },

  noKitchenTitle: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink, marginBottom: 8 },
  noKitchenSub: { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, textAlign: 'center', marginBottom: 24 },
  backToCustomerBtn: { backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 },
  backToCustomerText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },
});
