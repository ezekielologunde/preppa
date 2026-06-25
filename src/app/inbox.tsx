import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  CreditCard,
  Package,
  ShieldCheck,
  Star,
  Wallet,
} from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  subscribeToNotifications,
  type AppNotification,
  type NotificationType,
} from '@/lib/notification-service';

// ── Icon + tint per notification family ────────────────────────────────────────

function iconFor(type: NotificationType) {
  switch (type) {
    case 'new_order':
    case 'order_update':
    case 'order_cancelled':   return Package;
    case 'payment':           return CreditCard;
    case 'payout':
    case 'payout_failed':     return Wallet;
    case 'account_status':
    case 'application_status':return ShieldCheck;
    case 'review':            return Star;
    default:                  return Bell;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Row ────────────────────────────────────────────────────────────────────────

function Row({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const Icon = iconFor(item.type);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.row, !item.read && styles.rowUnread]}>
      <View style={[styles.iconWell, !item.read && { backgroundColor: Palette.brandTint }]}>
        <Icon size={18} color={item.read ? Palette.textSecondary : Palette.brand} strokeWidth={1.9} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowTime}>{relativeTime(item.created_at)}</Text>
        </View>
        <Text style={styles.rowText} numberOfLines={2}>{item.body}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function InboxScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await getNotifications(50)); } catch { /* keep stale list */ }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  // Live updates: prepend new notifications as they arrive.
  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.id, (n) => setItems((prev) => [n, ...prev]));
  }, [user]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const openItem = useCallback(async (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markAsRead([n.id]).catch(() => {});
    }
    const orderId = n.data?.order_id as string | undefined;
    if (orderId) router.push(`/order/${orderId}` as never);
    else if (n.type === 'payout' || n.type === 'payout_failed' || n.type === 'account_status') router.push('/prepper/earnings' as never);
  }, [router]);

  const onMarkAll = useCallback(async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    markAllAsRead().catch(() => {});
  }, []);

  const hasUnread = items.some((i) => !i.read);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={20} color={Palette.ink} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>notifications</Text>
        {hasUnread ? (
          <TouchableOpacity onPress={onMarkAll} activeOpacity={0.7} style={styles.markAllBtn} hitSlop={8}>
            <CheckCheck size={18} color={Palette.brand} strokeWidth={2} />
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Palette.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.brand} />}
          renderItem={({ item }) => <Row item={item} onPress={() => openItem(item)} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Bell size={26} color={Palette.textMuted} strokeWidth={1.6} /></View>
              <Text style={styles.emptyTitle}>no notifications yet</Text>
              <Text style={styles.emptySub}>order updates, payments and payouts will show up here</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: Palette.surface,
    borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', ...Shadow.card,
  },
  headerTitle: { fontFamily: Font.display, fontSize: Type.body, color: Palette.ink, letterSpacing: -0.3 },
  markAllBtn: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: Palette.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },

  list: { paddingHorizontal: Space.xl, paddingTop: 4, paddingBottom: 32 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Palette.surface, borderRadius: 16, padding: 14, marginBottom: 10, ...Shadow.card,
  },
  rowUnread: { backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.brandTint },
  iconWell: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: Palette.chip,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, fontFamily: Font.semibold, fontSize: Type.label, color: Palette.inkSoft },
  rowTitleUnread: { fontFamily: Font.display, color: Palette.ink },
  rowTime: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted, flexShrink: 0 },
  rowText: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 3, lineHeight: 16 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.brand, flexShrink: 0 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Space.xl },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 20, backgroundColor: Palette.chip,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink, marginBottom: 6 },
  emptySub: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },
});
