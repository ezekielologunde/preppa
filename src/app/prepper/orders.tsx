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
import { Check, X, Clock, Package, ChevronRight } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { usePrepper } from '@/lib/use-prepper';

// ── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

type QueueItem = {
  id: string;
  status: OrderStatus;
  total_pence: number;
  notes: string | null;
  created_at: string;
  items: { listing_name: string; quantity: number }[];
};

// ── Config ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'pending',  label: 'incoming',  statuses: ['pending']                    },
  { key: 'active',   label: 'preparing', statuses: ['confirmed', 'preparing']     },
  { key: 'ready',    label: 'ready',     statuses: ['ready']                      },
  { key: 'done',     label: 'done',      statuses: ['delivered', 'cancelled']     },
] as const;

type TabKey = typeof TABS[number]['key'];

const STATUS_ACTIONS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  pending:   { next: 'confirmed',  label: 'accept'     },
  confirmed: { next: 'preparing',  label: 'start prep' },
  preparing: { next: 'ready',      label: 'mark ready' },
  ready:     { next: 'delivered',  label: 'delivered'  },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function OrderCard({ order, kitchenId, onStatusChange }: {
  order: QueueItem;
  kitchenId: string;
  onStatusChange: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const action = STATUS_ACTIONS[order.status];
  const itemSummary = order.items.slice(0, 2).map((i) => `${i.quantity}× ${i.listing_name}`).join(', ');
  const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} more` : '';

  const advanceStatus = async () => {
    if (!action || loading) return;
    setLoading(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: action.next })
      .eq('id', order.id)
      .eq('kitchen_id', kitchenId); // ownership guard on every write
    setLoading(false);
    if (error) { Alert.alert('error', error.message); return; }
    onStatusChange();
  };

  const cancelOrder = () => {
    Alert.alert(
      'cancel order',
      'are you sure? the customer will be notified.',
      [
        { text: 'keep', style: 'cancel' },
        {
          text: 'cancel order', style: 'destructive',
          onPress: async () => {
            await supabase
              .from('orders')
              .update({ status: 'cancelled' })
              .eq('id', order.id)
              .eq('kitchen_id', kitchenId);
            onStatusChange();
          },
        },
      ],
    );
  };

  const time = new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <Clock size={13} color={Palette.textMuted} strokeWidth={1.8} />
          <Text style={styles.cardTime}>{time}</Text>
        </View>
        <Text style={styles.cardTotal}>£{(order.total_pence / 100).toFixed(2)}</Text>
      </View>

      <Text style={styles.cardItems} numberOfLines={2}>{itemSummary}{moreItems}</Text>
      {order.notes ? (
        <View style={styles.noteBadge}>
          <Text style={styles.noteText}>note: {order.notes}</Text>
        </View>
      ) : null}

      {action && (
        <View style={styles.cardActions}>
          {order.status === 'pending' && (
            <TouchableOpacity onPress={cancelOrder} activeOpacity={0.8} style={styles.rejectBtn}>
              <X size={15} color={Palette.danger} strokeWidth={2} />
              <Text style={styles.rejectBtnText}>reject</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={advanceStatus}
            activeOpacity={0.85}
            style={[styles.acceptBtn, loading && { opacity: 0.6 }]}
          >
            {loading
              ? <ActivityIndicator size="small" color={Palette.surface} />
              : <><Check size={15} color={Palette.surface} strokeWidth={2.5} /><Text style={styles.acceptBtnText}>{action.label}</Text></>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PrepperOrdersScreen() {
  const { kitchen, loading: kLoading } = usePrepper(true);
  const [tab, setTab] = useState<TabKey>('pending');
  const [orders, setOrders] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!kitchen) return;
    const currentTab = TABS.find((t) => t.key === tab)!;
    const { data } = await supabase
      .from('orders')
      .select('id, status, total_pence, notes, created_at, items:order_items(listing_name, quantity)')
      .eq('kitchen_id', kitchen.id) // ownership: only this kitchen's orders
      .in('status', currentTab.statuses as string[])
      .order('created_at', { ascending: tab !== 'done' });
    setOrders((data as QueueItem[]) ?? []);
  }, [kitchen, tab]);

  useEffect(() => {
    setLoading(true);
    fetchOrders().finally(() => setLoading(false));
  }, [fetchOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

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
        <Text style={styles.headerTitle}>orders</Text>
        {orders.length > 0 && <Text style={styles.headerCount}>{orders.length}</Text>}
      </View>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} activeOpacity={0.7} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Palette.brand} /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.brand} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Package size={32} color={Palette.textMuted} strokeWidth={1.4} />
              <Text style={styles.emptyText}>no {TABS.find((t) => t.key === tab)?.label} orders</Text>
            </View>
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              kitchenId={kitchen!.id}
              onStatusChange={fetchOrders}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontFamily: Font.display, fontSize: Type.displayLg, color: Palette.ink, letterSpacing: -0.8 },
  headerCount: { backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2, fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.surface, overflow: 'hidden' },

  tabRow: { flexDirection: 'row', marginHorizontal: Space.xl, marginBottom: 16, backgroundColor: Palette.chip, borderRadius: Radius.md, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Palette.surface, ...Shadow.card },
  tabLabel: { fontFamily: Font.semibold, fontSize: 10, color: Palette.textSecondary },
  tabLabelActive: { color: Palette.ink },

  list: { paddingHorizontal: Space.xl, paddingBottom: 32 },

  card: { backgroundColor: Palette.surface, borderRadius: 18, padding: 16, marginBottom: 12, ...Shadow.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTime: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted },
  cardTotal: { fontFamily: Font.display, fontSize: Type.body, color: Palette.ink },
  cardItems: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink, lineHeight: 20 },

  noteBadge: { backgroundColor: Palette.amberTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  noteText: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.amberDeep },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Palette.dangerBorder, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  rejectBtnText: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.danger },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Palette.brand, borderRadius: Radius.md, paddingVertical: 10 },
  acceptBtnText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textMuted },
});
