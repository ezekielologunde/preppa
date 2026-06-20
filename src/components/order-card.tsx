import { Image } from 'expo-image';
import { AlertTriangle, ArrowRight, CalendarClock, Lock, MessageCircle, RefreshCcw, RotateCcw, ShoppingBag, Star } from 'lucide-react-native';
import { ActivityIndicator, Text, View } from 'react-native';

import { HandoffCard } from '@/components/handoff-card';
import { DeliveryEtaBanner, OrderTimeline } from '@/components/order-timeline';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { statusChip, STATUS_LABEL_CUSTOMER } from '@/lib/orders/pipeline';
import type { OrderSummary } from '@/lib/queries/orders';

export const money = (n: number) => `$${n.toFixed(2)}`;

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Compact list-row card shown in the customer orders screen. */
export function OrderListCard({ order, tab, twoCol, reordering, onPress, onReorder, onTrack }: {
  order: OrderSummary;
  tab: 'active' | 'upcoming' | 'past';
  twoCol: boolean;
  reordering: boolean;
  onPress: () => void;
  onReorder: () => void;
  onTrack: () => void;
}) {
  const chip = statusChip(order.status);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tab === 'past' ? `Toggle receipt for order from ${order.prepper}` : `View order status for ${order.prepper}`}
      style={{ backgroundColor: Palette.surface, borderRadius: 18, padding: 16, marginHorizontal: twoCol ? 0 : 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {order.items[0]?.image ? (
          <Image source={order.items[0].image} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: Palette.canvas, flexShrink: 0 }} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShoppingBag size={22} color={Palette.border} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{order.items[0]?.title ?? order.prepper}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>{order.prepper}</Text>
          {order.scheduled_at ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <CalendarClock size={11} color={Palette.brand} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.brand }}>
                {new Date(order.scheduled_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ height: 24, borderRadius: 12, backgroundColor: chip.bg, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: chip.fg }}>{STATUS_LABEL_CUSTOMER[order.status]}</Text>
        </View>
      </View>
      {order.fulfillmentNote ? (
        <Text numberOfLines={2} style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, fontStyle: 'italic', marginTop: 8 }}>
          &ldquo;{order.fulfillmentNote}&rdquo;
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Palette.border }}>
        <Text style={{ fontFamily: Font.display, fontSize: 16, color: Palette.brand, fontVariant: ['tabular-nums'] }}>${order.total.toFixed(2)}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
          {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>
      {order.status === 'completed' ? (
        <PressableScale onPress={onReorder} accessibilityRole="button" accessibilityLabel="Reorder these meals"
          style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: Radius.pill, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.brand + '40', marginTop: 10 }}>
          {reordering ? <ActivityIndicator size="small" color={Palette.brand} /> : <RefreshCcw size={13} color={Palette.brand} />}
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.brand }}>Reorder</Text>
        </PressableScale>
      ) : order.status !== 'cancelled' ? (
        <PressableScale onPress={onTrack} accessibilityRole="button" accessibilityLabel="Track this order"
          style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: Radius.pill, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.brand + '40', marginTop: 10 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.brand }}>Track order</Text>
          <ArrowRight size={13} color={Palette.brand} />
        </PressableScale>
      ) : null}
    </PressableScale>
  );
}

export function OrderCard({ order, onCancel, onReview, onPay, onReorder, onReport, onMessage, onChat, onPress, cancelling, needsPayment, paying, reordering }: {
  order: OrderSummary; onCancel: () => void; onReview: () => void; onPay: () => void;
  onReorder: () => void; onReport: () => void; onMessage: () => void; onChat: () => void;
  onPress?: () => void;
  cancelling: boolean; needsPayment: boolean; paying: boolean; reordering: boolean;
}) {
  const chip = statusChip(order.status);
  return (
    <PressableScale onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? `View preorder from ${order.prepper}` : undefined} style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PressableScale onPress={onMessage} accessibilityRole="button" accessibilityLabel={`View ${order.prepper}'s kitchen`} style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }} numberOfLines={1}>{order.prepper}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1, textTransform: 'capitalize' }}>{dateLabel(order.created_at)} · {order.fulfillment === 'meetup' ? 'meet up' : order.fulfillment === 'home_cook' ? 'home cook' : order.fulfillment}</Text>
          {order.scheduled_at ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <CalendarClock size={12} color={Palette.brand} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brand }}>
                Scheduled for {new Date(order.scheduled_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ) : null}
        </PressableScale>
        <View style={{ paddingHorizontal: 11, height: 26, borderRadius: Radius.pill, backgroundColor: chip.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: chip.fg }}>{STATUS_LABEL_CUSTOMER[order.status]}</Text>
        </View>
      </View>

      {order.status !== 'cancelled' ? (
        <View style={{ backgroundColor: Palette.canvas, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10 }}>
          <OrderTimeline status={order.status} />
        </View>
      ) : null}

      {order.status === 'out_for_delivery' && order.fulfillment === 'delivery' ? (
        <DeliveryEtaBanner />
      ) : null}

      <View style={{ gap: 8 }}>
        {order.items.map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {it.image ? <Image source={it.image} style={{ width: 40, height: 40, borderRadius: 10 }} contentFit="cover" accessibilityLabel={it.title} /> : <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: Palette.canvas }} />}
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13.5, color: Palette.inkSoft }} numberOfLines={1}>{it.quantity}× {it.title}</Text>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.ink, fontVariant: ['tabular-nums'] }}>{money(it.total)}</Text>
          </View>
        ))}
      </View>

      {order.handoff && (order.fulfillment === 'pickup' || order.fulfillment === 'meetup' || order.fulfillment === 'home_cook') && order.status !== 'completed' && order.status !== 'cancelled' ? (
        <HandoffCard
          pin={order.handoff.pin}
          token={order.handoff.token}
          verified={order.handoff.verified}
          label={order.fulfillment === 'pickup' ? 'Pickup code' : order.fulfillment === 'home_cook' ? 'Home cook code' : 'Meet-up code'}
        />
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: Palette.chip, paddingTop: 11, gap: 5 }}>
        {order.service_fee != null && order.service_fee > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Platform fee</Text>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary, fontVariant: ['tabular-nums'] }}>{money(order.service_fee)}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Total</Text>
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink, fontVariant: ['tabular-nums'] }}>{money(order.total)}</Text>
        </View>
      </View>

      {needsPayment ? (
        <View style={{ gap: 8 }}>
          <PressableScale onPress={onPay} disabled={paying} accessibilityRole="button" accessibilityLabel={`Complete payment, ${money(order.total)}`}
            style={{ height: 46, borderRadius: Radius.pill, backgroundColor: Palette.brand, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', opacity: paying ? 0.7 : 1 }}>
            {paying ? <ActivityIndicator color="#fff" /> : (<><Lock size={15} color="#fff" /><Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: '#fff' }}>Complete payment · {money(order.total)}</Text></>)}
          </PressableScale>
          <PressableScale onPress={onCancel} disabled={cancelling} accessibilityRole="button" accessibilityLabel="Cancel preorder"
            style={{ height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', opacity: cancelling ? 0.6 : 1 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textSecondary }}>Cancel preorder</Text>
          </PressableScale>
        </View>
      ) : order.status === 'pending' ? (
        <PressableScale onPress={onCancel} disabled={cancelling} accessibilityRole="button" accessibilityLabel="Cancel preorder"
          style={{ height: 42, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', opacity: cancelling ? 0.6 : 1 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textSecondary }}>Cancel preorder</Text>
        </PressableScale>
      ) : order.status === 'completed' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {!order.reviewed ? (
            <PressableScale onPress={onReview} accessibilityRole="button" accessibilityLabel="Leave a review"
              style={{ flex: 1, height: 44, borderRadius: Radius.sm, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Star size={15} color={Palette.brandPressed} fill={Palette.brandPressed} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brandPressed }}>Leave a review</Text>
            </PressableScale>
          ) : null}
          <Button title="Preorder again" Icon={RotateCcw} variant="primary" size="md" loading={reordering} onPress={onReorder} style={{ flex: 1 }} accessibilityLabel="Preorder these meals again" />
        </View>
      ) : ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status) ? (
        <PressableScale onPress={onChat} accessibilityRole="button" accessibilityLabel="Message your kitchen"
          style={{ height: 44, borderRadius: Radius.sm, backgroundColor: Palette.brandTint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <MessageCircle size={15} color={Palette.brand} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brand }}>Message kitchen</Text>
        </PressableScale>
      ) : null}

      {order.disputed && order.status !== 'completed' && order.status !== 'cancelled' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
          <AlertTriangle size={13} color={Palette.amber} />
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>Dispute filed — under review</Text>
        </View>
      ) : null}

      {(order.status === 'completed' || order.status === 'cancelled') ? (
        order.disputed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
            <AlertTriangle size={13} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>Issue reported — we&apos;re looking into it.</Text>
          </View>
        ) : (
          <PressableScale onPress={onReport} accessibilityRole="button" accessibilityLabel="Report an issue with this preorder"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 36, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border }}>
            <AlertTriangle size={13} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>Report an issue</Text>
          </PressableScale>
        )
      ) : null}
    </PressableScale>
  );
}
