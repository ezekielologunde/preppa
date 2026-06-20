/**
 * order-detail.tsx
 * Extracted components for the orders screen receipt expansion.
 * OrderReceiptPanel — inline animated receipt with line items, fee breakdown, payment.
 */
import { MotiView } from 'moti';
import { ActivityIndicator, Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import type { OrderSummary } from '@/lib/queries/orders';
import { useOrderItems } from '@/lib/queries/orders';

const money = (n: number) => `$${n.toFixed(2)}`;

function Divider() {
  return <View style={{ height: 1, backgroundColor: Palette.border, marginVertical: 6 }} />;
}

function ReceiptRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 }}>
      <Text style={{ fontFamily: bold ? Font.semibold : Font.body, fontSize: 13, color: bold ? Palette.ink : Palette.textSecondary }}>
        {label}
      </Text>
      <Text style={{ fontFamily: bold ? Font.display : Font.medium, fontSize: bold ? 15 : 13, color: bold ? Palette.ink : Palette.textSecondary, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function orderDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function orderRef(id: string): string {
  return `#${id.slice(-8).toUpperCase()}`;
}

export function OrderReceiptPanel({ order }: { order: OrderSummary }) {
  const { data: items, isLoading } = useOrderItems(order.id);

  return (
    <MotiView
      from={{ opacity: 0, translateY: -6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 220 }}
      style={{
        backgroundColor: Palette.canvas,
        borderRadius: Radius.sm,
        padding: 14,
        marginTop: 8,
        gap: 2,
      }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.ink }}>
          {orderRef(order.id)}
        </Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
          {orderDate(order.created_at)}
        </Text>
      </View>

      <Divider />

      {/* Line items */}
      {isLoading ? (
        <ActivityIndicator size="small" color={Palette.brand} style={{ marginVertical: 10 }} />
      ) : (
        (items ?? []).map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.inkSoft, flex: 1 }} numberOfLines={1}>
              {it.quantity}x {it.title}
            </Text>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft, fontVariant: ['tabular-nums'], marginLeft: 8 }}>
              {money(it.price_at_time * it.quantity)}
            </Text>
          </View>
        ))
      )}

      <Divider />

      {/* Fee breakdown */}
      <ReceiptRow label="Subtotal" value={money(order.subtotal)} />
      {order.deliveryFee > 0 && <ReceiptRow label="Delivery" value={money(order.deliveryFee)} />}
      {order.tip > 0 && <ReceiptRow label="Tip" value={money(order.tip)} />}
      {order.service_fee != null && order.service_fee > 0 && (
        <ReceiptRow label="Platform fee" value={money(order.service_fee)} />
      )}

      <Divider />

      <ReceiptRow label="Total" value={money(order.total)} bold />

      {/* Payment status */}
      {order.paymentStatus ? (
        <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, marginTop: 6, textAlign: 'right' }}>
          {order.paymentStatus === 'succeeded' ? 'Paid' : order.paymentStatus === 'refunded' ? 'Refunded' : order.paymentStatus}
        </Text>
      ) : null}
    </MotiView>
  );
}
