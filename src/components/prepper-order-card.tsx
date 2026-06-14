import { ActivityIndicator, Text, View } from 'react-native';
import { QrCode } from 'lucide-react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';
import type { OrderSummary } from '@/lib/queries/orders';
import type { OrderStatus } from '@/types/database.types';

export const HC = '#5B21B6';
export const HC_TINT = '#EDE9FE';
export const ORANGE = Palette.brand;
export const CARD = Palette.prepperCard;
export const BG = Palette.prepperBg;
export const money = (n: number) => `$${n.toFixed(2)}`;

const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending: { next: 'confirmed', cta: 'Confirm preorder' },
  confirmed: { next: 'preparing', cta: 'Start prepping' },
  preparing: { next: 'ready', cta: 'Mark ready' },
  ready: { next: 'completed', cta: 'Mark complete' },
  out_for_delivery: { next: 'completed', cta: 'Mark complete' },
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  completed: 'Complete',
  cancelled: 'Cancelled',
};

export function OrderCard({
  order,
  onAdvance,
  onCancel,
  onVerify,
  busy,
}: {
  order: OrderSummary;
  onAdvance: (next: OrderStatus) => void;
  onCancel: () => void;
  onVerify: () => void;
  busy: boolean;
}) {
  const step = NEXT[order.status];
  const needsHandoff = step?.next === 'completed' && (order.fulfillment === 'pickup' || order.fulfillment === 'meetup' || order.fulfillment === 'home_cook');
  const canCancel = order.status === 'pending' || order.status === 'confirmed';
  const done = order.status === 'completed' || order.status === 'cancelled';
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }} numberOfLines={1}>{order.customer}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 1 }}>
            {order.items.length === 0
              ? `Custom job · ${money(order.total)}`
              : `${order.items.reduce((s, i) => s + i.quantity, 0)} item${order.items.length === 1 ? '' : 's'} · ${money(order.total)}`}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 11, height: 26, borderRadius: Radius.pill, backgroundColor: done ? '#252a34' : ORANGE + '26', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: done ? Palette.textMuted : ORANGE }}>{STATUS_LABEL[order.status]}</Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        {order.items.map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }} numberOfLines={1}>{it.quantity}× {it.title}</Text>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textMuted, fontVariant: ['tabular-nums'] }}>{money(it.total)}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: '#1d2129', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: order.fulfillment === 'home_cook' ? HC : ORANGE, textTransform: 'capitalize' }}>
          {order.fulfillment === 'meetup' ? 'Meet up' : order.fulfillment === 'home_cook' ? 'Home cook' : order.fulfillment}
        </Text>
        {order.fulfillmentNote ? <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted }} numberOfLines={2}>· {order.fulfillmentNote}</Text> : null}
      </View>

      {step ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {canCancel ? (
            <PressableScale onPress={onCancel} disabled={busy} accessibilityRole="button" accessibilityLabel="Decline preorder" style={{ height: 46, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: '#3f4451', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textMuted }}>Decline</Text>
            </PressableScale>
          ) : null}
          <PressableScale onPress={() => { feedback.tap(); if (needsHandoff) onVerify(); else onAdvance(step.next); }} disabled={busy} accessibilityRole="button" accessibilityLabel={needsHandoff ? 'Verify handoff and complete' : step.cta} style={{ flex: 1, height: 46, borderRadius: Radius.pill, backgroundColor: ORANGE, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                {needsHandoff ? <QrCode size={16} color="#fff" /> : null}
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>{needsHandoff ? 'Verify & complete' : step.cta}</Text>
              </>
            )}
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}
