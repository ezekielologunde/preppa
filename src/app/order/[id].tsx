import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking } from 'react-native';
import { ArrowLeft, ChefHat, CheckCircle, Clock, CreditCard, KeyRound, Lock, MapPin, ShieldCheck, XCircle } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { formatMoney } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import { consumePin } from '@/lib/orders/pin-store';
import { payForOrder } from '@/lib/orders/create-order';
import { useAuth } from '@/providers/auth-provider';
import type { EscrowStatus, OrderStatus } from '@/types/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string;
  listing_name: string;
  quantity: number;
  unit_pence: number;
};

type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'in_escrow' | 'released' | 'refunded' | 'failed';

type OrderDetail = {
  id: string;
  status: OrderStatus;
  total_pence: number;
  platform_fee_pence: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_verified: boolean;
  escrow_status: EscrowStatus | null;
  kitchen: { display_name: string } | { display_name: string }[] | null;
  items: OrderItem[];
  payment: { status: PaymentStatus } | { status: PaymentStatus }[] | null;
};

function paymentStatus(p: OrderDetail['payment']): PaymentStatus | null {
  if (!p) return null;
  return (Array.isArray(p) ? p[0]?.status : p.status) ?? null;
}

// ── Status flow ──────────────────────────────────────────────────────────────

const FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'in_transit', 'delivered'];
const FLOW_LABELS: Record<string, string> = {
  pending:    'placed',
  confirmed:  'confirmed',
  preparing:  'preparing',
  ready:      'ready',
  in_transit: 'on the way',
  delivered:  'delivered',
};

const STATUS_MESSAGES: Record<OrderStatus, string> = {
  pending:    'your order has been placed and is waiting for the chef to confirm.',
  confirmed:  "the chef has confirmed your order and will start cooking soon.",
  preparing:  'your meal is being freshly prepared right now.',
  ready:      "your meal is ready and waiting for collection or pickup.",
  in_transit: "your meal is on the way — hang tight!",
  delivered:  "your order has been delivered. enjoy!",
  cancelled:  "this order was cancelled.",
  refunded:   "this order has been refunded.",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function kitchenName(k: OrderDetail['kitchen']): string {
  if (!k) return 'unknown kitchen';
  if (Array.isArray(k)) return k[0]?.display_name ?? 'unknown kitchen';
  return k.display_name;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusTracker({ status }: { status: OrderStatus }) {
  const isTerminal = status === 'cancelled' || status === 'refunded';
  if (isTerminal) {
    return (
      <View style={tracker.terminalWrap}>
        <XCircle size={28} color={Palette.danger} strokeWidth={1.8} />
        <View>
          <Text style={tracker.terminalLabel}>{status}</Text>
          <Text style={tracker.terminalSub}>{STATUS_MESSAGES[status]}</Text>
        </View>
      </View>
    );
  }

  const currentIdx = FLOW.indexOf(status);

  return (
    <View style={tracker.wrap}>
      <View style={tracker.stepsRow}>
        {FLOW.map((step, i) => {
          const done    = i <= currentIdx;
          const current = i === currentIdx;
          return (
            <View key={step} style={tracker.stepCol}>
              {i > 0 && (
                <View style={[tracker.connector, done && tracker.connectorDone]} />
              )}
              <View style={[
                tracker.dot,
                done    && tracker.dotDone,
                current && tracker.dotCurrent,
              ]}>
                {done && !current && (
                  <CheckCircle size={10} color={Palette.surface} strokeWidth={3} />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View style={tracker.labelsRow}>
        {FLOW.map((step, i) => (
          <Text
            key={step}
            style={[tracker.stepLabel, i <= currentIdx && tracker.stepLabelDone]}
            numberOfLines={1}
          >
            {FLOW_LABELS[step]}
          </Text>
        ))}
      </View>
      <Text style={tracker.message}>{STATUS_MESSAGES[status]}</Text>
    </View>
  );
}

const tracker = StyleSheet.create({
  wrap: { marginBottom: 4 },
  stepsRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  stepCol: { flex: 1, alignItems: 'center', position: 'relative' },
  connector: {
    position: 'absolute', left: '-50%', right: '50%',
    height: 2, top: 9, backgroundColor: Palette.border,
  },
  connectorDone: { backgroundColor: Palette.brand },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Palette.border,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  dotDone: { backgroundColor: Palette.brand },
  dotCurrent: {
    backgroundColor: Palette.brand,
    borderWidth: 3, borderColor: Palette.brandTint, width: 22, height: 22, borderRadius: 11,
  },
  labelsRow: { flexDirection: 'row', marginBottom: 14 },
  stepLabel: {
    flex: 1, textAlign: 'center',
    fontFamily: Font.body, fontSize: 9, color: Palette.textMuted,
  },
  stepLabelDone: { color: Palette.brand, fontFamily: Font.semibold },
  message: {
    fontFamily: Font.body, fontSize: Type.label,
    color: Palette.textSecondary, lineHeight: 20,
  },
  terminalWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  terminalLabel: { fontFamily: Font.display, fontSize: Type.body, color: Palette.danger },
  terminalSub: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, marginTop: 2, lineHeight: 18 },
});

function ItemRow({ item }: { item: OrderItem }) {
  const lineTotal = `£${((item.unit_pence * item.quantity) / 100).toFixed(2)}`;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <Text style={styles.itemQty}>{item.quantity}×</Text>
        <Text style={styles.itemName} numberOfLines={2}>{item.listing_name}</Text>
      </View>
      <Text style={styles.itemTotal}>{lineTotal}</Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

// One-time handoff PIN + escrow disclosure, shown only right after ordering.
function HandoffCard({ pin }: { pin: string }) {
  return (
    <View style={pinStyles.card}>
      <View style={pinStyles.headerRow}>
        <View style={pinStyles.iconWell}>
          <KeyRound size={18} color={Palette.brand} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pinStyles.title}>your handoff code</Text>
          <Text style={pinStyles.sub}>show this to your chef at pickup to confirm the order</Text>
        </View>
      </View>

      <View style={pinStyles.pinRow} accessibilityLabel={`Handoff code ${pin.split('').join(' ')}`}>
        {pin.split('').map((digit, i) => (
          <View key={i} style={pinStyles.pinCell}>
            <Text style={pinStyles.pinDigit}>{digit}</Text>
          </View>
        ))}
      </View>

      <View style={pinStyles.escrowRow}>
        <Lock size={13} color={Palette.successDark} strokeWidth={2} />
        <Text style={pinStyles.escrowText}>
          your payment is held securely. once you confirm handoff, funds release to the
          chef — and you have 24 hours to raise an issue.
        </Text>
      </View>

      <Text style={pinStyles.warn}>save this code now — it won't be shown again.</Text>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface, borderRadius: 18,
    padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: Palette.brandTint, ...Shadow.card,
  },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  iconWell: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.brandTint,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: { fontFamily: Font.display, fontSize: Type.body, color: Palette.ink },
  sub: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 2 },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 },
  pinCell: {
    width: 52, height: 60, borderRadius: 14, backgroundColor: Palette.chip,
    alignItems: 'center', justifyContent: 'center',
  },
  pinDigit: { fontFamily: Font.display, fontSize: 28, color: Palette.ink, letterSpacing: -0.5 },
  escrowRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Palette.successTint, borderRadius: 12, padding: 12, marginBottom: 10,
  },
  escrowText: { flex: 1, fontFamily: Font.body, fontSize: Type.micro, color: Palette.successDark, lineHeight: 17 },
  warn: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.brandPressed, textAlign: 'center' },
});

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string; justOrdered?: string }>();
  const router   = useRouter();
  const { user } = useAuth();

  const [order, setOrder]   = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  // Consume the one-time handoff PIN from the in-memory store (never the URL).
  // Read once on mount into state so it survives re-renders after the store clears.
  const [pin] = useState<string | undefined>(() => (id ? consumePin(id) : undefined));

  const load = useCallback(async () => {
    if (!id || !user) { setLoading(false); return; }
    const { data } = await supabase
      .from('orders')
      .select(
        'id, status, total_pence, platform_fee_pence, notes, created_at, updated_at,' +
        'is_verified, escrow_status,' +
        'kitchen:kitchens(display_name),' +
        'items:order_items(id, listing_name, quantity, unit_pence),' +
        'payment:payments(status)',
      )
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();
    setOrder(data as OrderDetail | null);
    setLoading(false);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const total    = order ? formatMoney(order.total_pence) : '—';
  const kitchen  = order ? kitchenName(order.kitchen) : '';
  const payStatus = order ? paymentStatus(order.payment) : null;
  const needsPayment = !!order && order.status !== 'cancelled'
    && (payStatus === null || payStatus === 'pending' || payStatus === 'failed');
  const canRefund = order && ['delivered'].includes(order.status);
  const showVerify = order && !order.is_verified &&
    ['confirmed', 'preparing', 'ready', 'in_transit'].includes(order.status);

  const handlePay = useCallback(async () => {
    if (!order || paying) return;
    setPaying(true);
    try {
      const url = await payForOrder(order.id);
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Payment', e instanceof Error ? e.message : 'Could not start checkout.');
    } finally {
      setPaying(false);
    }
  }, [order, paying]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.backBtn}
          hitSlop={8}
        >
          <ArrowLeft size={20} color={Palette.ink} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>order details</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={Palette.brand} />
        </View>
      ) : !order ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorTitle}>order not found</Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Pay now (payment still pending/failed) ─────────── */}
          {needsPayment && (
            <View style={styles.payCard}>
              <View style={styles.payTextWrap}>
                <Text style={styles.payTitle}>
                  {payStatus === 'failed' ? 'payment failed' : 'payment required'}
                </Text>
                <Text style={styles.paySub}>
                  {payStatus === 'failed'
                    ? 'your card was declined — try again to confirm this order'
                    : `pay ${total} to confirm your order`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handlePay}
                activeOpacity={0.88}
                disabled={paying}
                style={[styles.payBtn, paying && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Pay ${total}`}
              >
                {paying ? <ActivityIndicator size="small" color={Palette.surface} />
                  : <><CreditCard size={15} color={Palette.surface} strokeWidth={2} />
                      <Text style={styles.payBtnText}>pay {total}</Text></>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── One-time handoff PIN (only right after ordering) ─ */}
          {pin ? <HandoffCard pin={pin} /> : null}

          {/* ── Status card ──────────────────────────────────── */}
          <View style={styles.card}>
            <StatusTracker status={order.status} />
          </View>

          {/* ── Kitchen ──────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <ChefHat size={18} color={Palette.brand} strokeWidth={1.8} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>prepared by</Text>
                <Text style={styles.rowValue}>{kitchen}</Text>
              </View>
            </View>
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: Palette.border, marginTop: 12, paddingTop: 12 }]}>
              <View style={styles.iconWrap}>
                <Clock size={18} color={Palette.brand} strokeWidth={1.8} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>placed</Text>
                <Text style={styles.rowValue}>{fmtDate(order.created_at)}</Text>
              </View>
            </View>
            {order.notes ? (
              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: Palette.border, marginTop: 12, paddingTop: 12 }]}>
                <View style={styles.iconWrap}>
                  <MapPin size={18} color={Palette.brand} strokeWidth={1.8} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>notes</Text>
                  <Text style={styles.rowValue}>{order.notes}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* ── Items ────────────────────────────────────────── */}
          {order.items.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>items</Text>
              {order.items.map((item) => <ItemRow key={item.id} item={item} />)}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>total</Text>
                <Text style={styles.totalValue}>{total}</Text>
              </View>
            </View>
          )}

          {/* ── Actions ──────────────────────────────────────── */}
          {showVerify && (
            <TouchableOpacity
              onPress={() => router.push(`/order/verify/${order.id}` as never)}
              activeOpacity={0.85}
              style={styles.verifyBtn}
            >
              <ShieldCheck size={16} color={Palette.surface} strokeWidth={2} />
              <Text style={styles.verifyBtnText}>verify handoff</Text>
            </TouchableOpacity>
          )}
          {canRefund && (
            <TouchableOpacity
              onPress={() => router.push('/support' as never)}
              activeOpacity={0.8}
              style={styles.refundBtn}
            >
              <Text style={styles.refundBtnText}>request a refund</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: Palette.surface,
    borderWidth: 1, borderColor: Palette.border,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.card,
  },
  headerTitle: {
    fontFamily: Font.display, fontSize: Type.body,
    color: Palette.ink, letterSpacing: -0.3,
  },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  errorTitle: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink, marginBottom: 20 },
  errorBtn: {
    backgroundColor: Palette.brand, borderRadius: Radius.pill,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  errorBtnText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },

  scroll: { paddingHorizontal: Space.xl, paddingTop: 4, paddingBottom: 32 },

  payCard: {
    backgroundColor: Palette.brandTint, borderRadius: 18, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  payTextWrap: { flex: 1 },
  payTitle: { fontFamily: Font.display, fontSize: Type.label, color: Palette.brandPressed },
  paySub: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.brandPressed, marginTop: 2, lineHeight: 16 },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Palette.brand, borderRadius: Radius.pill,
    paddingHorizontal: 18, paddingVertical: 12, minHeight: 44, flexShrink: 0,
  },
  payBtnText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },

  card: {
    backgroundColor: Palette.surface, borderRadius: 18,
    padding: 18, marginBottom: 12, ...Shadow.card,
  },
  cardTitle: {
    fontFamily: Font.display, fontSize: Type.label,
    color: Palette.ink, marginBottom: 14, letterSpacing: -0.2,
  },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: Palette.brandTint,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowBody: { flex: 1 },
  rowLabel: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary },
  rowValue: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink, marginTop: 2 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Palette.border,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 12 },
  itemQty: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.brand },
  itemName: { fontFamily: Font.body, fontSize: Type.label, color: Palette.ink, flex: 1 },
  itemTotal: { fontFamily: Font.display, fontSize: Type.label, color: Palette.ink },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, marginTop: 4,
  },
  totalLabel: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.textSecondary },
  totalValue: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink },

  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Palette.brand, borderRadius: Radius.md,
    paddingVertical: 14, marginBottom: 8,
  },
  verifyBtnText: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.surface },

  refundBtn: {
    borderWidth: 1, borderColor: Palette.dangerBorder,
    borderRadius: Radius.md, paddingVertical: 14,
    alignItems: 'center', marginBottom: 8,
  },
  refundBtnText: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.danger },
});
