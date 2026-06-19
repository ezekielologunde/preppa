/**
 * Tablet inline order detail panel.
 * Shown as the right column in the prepper-orders master-detail split
 * when an order is selected on tablet (width >= 600px).
 * Displays a simplified version of the full order detail screen.
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Check,
  ChevronRight,
  MessageSquare,
  QrCode,
  RotateCcw,
  ShoppingBag,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import type { OrderSummary } from '@/lib/queries/orders';
import type { FulfillmentType, OrderStatus } from '@/types/database.types';

// ── helpers ───────────────────────────────────────────────────────────────────

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const CARD = Palette.prepperCard;
const money = (n: number) => `$${n.toFixed(2)}`;

const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  pickup: 'Pickup', delivery: 'Delivery', meetup: 'Meet-up', home_cook: 'Home cook',
};
const FULFILLMENT_COLOR: Record<FulfillmentType, string> = {
  pickup: '#f59e0b', delivery: '#06b6d4', meetup: '#a78bfa', home_cook: '#22c55e',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New', confirmed: 'Confirmed', preparing: 'Preparing',
  ready: 'Ready', out_for_delivery: 'On the way', completed: 'Complete', cancelled: 'Cancelled',
};
const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
  pending: ORANGE, confirmed: '#06b6d4', preparing: '#a78bfa',
  ready: GREEN, out_for_delivery: '#22c55e', completed: GREEN, cancelled: '#5b6170',
};

const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending: { next: 'confirmed', cta: 'Confirm preorder' },
  confirmed: { next: 'preparing', cta: 'Start prepping' },
  preparing: { next: 'ready', cta: 'Mark ready' },
  ready: { next: 'completed', cta: 'Mark complete' },
  out_for_delivery: { next: 'completed', cta: 'Mark complete' },
};

// ── types ─────────────────────────────────────────────────────────────────────

export type OrderDetailPanelProps = {
  order: OrderSummary;
  advancePending?: boolean;
  onAdvance: (next: OrderStatus) => void;
  onCancel: () => void;
  onVerify: () => void;
  onChat?: () => void;
};

// ── component ─────────────────────────────────────────────────────────────────

export function OrderDetailPanel({ order, advancePending, onAdvance, onCancel, onVerify, onChat }: OrderDetailPanelProps) {
  const router = useRouter();
  const step = NEXT[order.status];
  const statusColor = STATUS_COLOR[order.status] ?? '#5b6170';
  const isActive = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
  const isPickup = order.fulfillment === 'pickup' || order.fulfillment === 'meetup' || order.fulfillment === 'home_cook';
  const canVerify = isPickup && (order.status === 'ready' || order.status === 'out_for_delivery');

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {order.items[0]?.image ? (
            <Image source={order.items[0].image} style={styles.mealImg} contentFit="cover" accessibilityLabel={order.items[0].title} />
          ) : (
            <View style={[styles.mealImg, styles.mealImgFallback]}>
              <UtensilsCrossed size={22} color="#5b6170" />
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.customerName} numberOfLines={1}>{order.customer}</Text>
            <Text style={styles.orderRef} numberOfLines={1}>
              #{order.id.slice(-8).toUpperCase()} · {FULFILLMENT_LABEL[order.fulfillment]}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusLabel, { color: statusColor }]}>{STATUS_LABEL[order.status]}</Text>
          </View>
        </View>

        {/* Meta chips */}
        <View style={styles.metaRow}>
          <View style={[styles.chip, { backgroundColor: order.paymentStatus === 'succeeded' ? GREEN + '24' : '#252a34' }]}>
            {order.paymentStatus === 'succeeded' ? <Check size={11} color={GREEN} strokeWidth={2.5} /> : null}
            <Text style={[styles.chipText, { color: order.paymentStatus === 'succeeded' ? GREEN : '#5b6170' }]}>
              {order.paymentStatus === 'succeeded' ? 'paid' : 'unpaid'}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: FULFILLMENT_COLOR[order.fulfillment] + '22' }]}>
            <Text style={[styles.chipText, { color: FULFILLMENT_COLOR[order.fulfillment] }]}>
              {FULFILLMENT_LABEL[order.fulfillment]}
            </Text>
          </View>
          <Text style={styles.totalText}>{money(order.total)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Items */}
      <Text style={styles.sectionLabel}>Items</Text>
      <View style={styles.itemsList}>
        {order.items.map((it) => (
          <View key={it.id ?? it.mealId} style={styles.itemRow}>
            {it.image ? (
              <Image source={it.image} style={styles.itemImg} contentFit="cover" accessibilityLabel={it.title} />
            ) : (
              <View style={[styles.itemImg, styles.itemImgFallback]}>
                <ShoppingBag size={14} color="#5b6170" />
              </View>
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={1}>{it.title}</Text>
              <Text style={styles.itemQty}>Qty {it.quantity}</Text>
            </View>
            <Text style={styles.itemTotal}>{money(it.total)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Receipt summary */}
      <View style={styles.receiptRow}>
        <Text style={styles.receiptLabel}>Total</Text>
        <Text style={styles.receiptTotal}>{money(order.total)}</Text>
      </View>

      <View style={styles.divider} />

      {/* Actions */}
      <View style={styles.actions}>
        {step ? (
          <PressableScale
            onPress={() => { feedback.tap(); onAdvance(step.next); }}
            disabled={advancePending}
            accessibilityRole="button"
            accessibilityLabel={step.cta}
            style={[styles.advanceBtn, advancePending && { opacity: 0.7 }]}>
            <Text style={styles.advanceBtnLabel}>{step.cta}</Text>
          </PressableScale>
        ) : null}

        {canVerify ? (
          <PressableScale onPress={() => { feedback.tap(); onVerify(); }} accessibilityRole="button" accessibilityLabel="Verify handoff"
            style={styles.secondaryBtn}>
            <QrCode size={16} color={ORANGE} />
            <Text style={styles.secondaryBtnLabel}>Verify handoff</Text>
          </PressableScale>
        ) : null}

        {isActive && onChat ? (
          <PressableScale onPress={() => { feedback.tap(); onChat(); }} accessibilityRole="button" accessibilityLabel="Message customer"
            style={styles.secondaryBtn}>
            <MessageSquare size={16} color="#5b6170" />
            <Text style={[styles.secondaryBtnLabel, { color: '#5b6170' }]}>Message customer</Text>
          </PressableScale>
        ) : null}

        {order.status === 'completed' ? (
          <PressableScale onPress={() => { feedback.tap(); router.push({ pathname: '/orders/[id]', params: { id: order.id } }); }} accessibilityRole="button" accessibilityLabel="View full order details"
            style={styles.ghostBtn}>
            <RotateCcw size={15} color="#5b6170" />
            <Text style={styles.ghostBtnLabel}>Full details</Text>
            <ChevronRight size={14} color="#5b6170" />
          </PressableScale>
        ) : null}

        {(order.status === 'pending' || order.status === 'confirmed') ? (
          <PressableScale onPress={() => { feedback.warning(); onCancel(); }} accessibilityRole="button" accessibilityLabel="Decline preorder"
            style={styles.cancelBtn}>
            <X size={15} color="#fca5a5" />
            <Text style={styles.cancelBtnLabel}>Decline preorder</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: Radius.md,
    padding: 20,
    gap: 14,
    ...Shadow.card,
  },
  header: {
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealImg: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  mealImgFallback: {
    backgroundColor: '#1d2129',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 3,
  },
  customerName: {
    fontFamily: Font.heading,
    fontSize: 16,
    color: '#fff',
  },
  orderRef: {
    fontFamily: Font.body,
    fontSize: 12,
    color: Palette.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  statusLabel: {
    fontFamily: Font.semibold,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    minHeight: 28,
  },
  chipText: {
    fontFamily: Font.semibold,
    fontSize: 11.5,
  },
  totalText: {
    fontFamily: Font.display,
    fontSize: 18,
    color: '#fff',
    marginLeft: 'auto',
  },
  divider: {
    height: 1,
    backgroundColor: '#252a34',
  },
  sectionLabel: {
    fontFamily: Font.semibold,
    fontSize: 11,
    color: Palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemsList: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  itemImg: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  itemImgFallback: {
    backgroundColor: '#1d2129',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontFamily: Font.semibold,
    fontSize: 13,
    color: '#fff',
  },
  itemQty: {
    fontFamily: Font.body,
    fontSize: 12,
    color: Palette.textMuted,
  },
  itemTotal: {
    fontFamily: Font.medium,
    fontSize: 13,
    color: '#fff',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontFamily: Font.semibold,
    fontSize: 14,
    color: '#fff',
  },
  receiptTotal: {
    fontFamily: Font.display,
    fontSize: 20,
    color: '#fff',
  },
  actions: {
    gap: 10,
  },
  advanceBtn: {
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceBtnLabel: {
    fontFamily: Font.heading,
    fontSize: 15.5,
    color: '#fff',
  },
  secondaryBtn: {
    height: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#3f4451',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
  },
  secondaryBtnLabel: {
    fontFamily: Font.semibold,
    fontSize: 14,
    color: ORANGE,
  },
  ghostBtn: {
    height: 44,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1d2129',
  },
  ghostBtnLabel: {
    fontFamily: Font.medium,
    fontSize: 13,
    color: '#5b6170',
  },
  cancelBtn: {
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  cancelBtnLabel: {
    fontFamily: Font.semibold,
    fontSize: 13.5,
    color: '#fca5a5',
  },
});
