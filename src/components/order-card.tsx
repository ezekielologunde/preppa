import { Image } from 'expo-image';
import { AlertTriangle, Lock, MessageCircle, RotateCcw, Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ActivityIndicator, Text, View } from 'react-native';

import { HandoffCard } from '@/components/handoff-card';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import type { OrderSummary } from '@/lib/queries/orders';
import type { OrderStatus } from '@/types/database.types';

export const money = (n: number) => `$${n.toFixed(2)}`;

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Prepping',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  completed: 'Complete',
  cancelled: 'Cancelled',
};

const TIMELINE_STEPS = [
  { key: 'pending',   label: 'Received' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Cooking' },
  { key: 'ready',     label: 'Ready' },
  { key: 'completed', label: 'Done' },
];

function timelineIdx(status: OrderStatus): number {
  if (status === 'pending') return 0;
  if (status === 'confirmed') return 1;
  if (status === 'preparing') return 2;
  if (status === 'ready' || status === 'out_for_delivery') return 3;
  if (status === 'completed') return 4;
  return 0;
}

function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null;
  const curr = timelineIdx(status);
  const inFlight = status !== 'completed';
  return (
    <View style={{ marginTop: 4, marginBottom: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 18 }}>
        {TIMELINE_STEPS.map((step, i) => {
          const done = i <= curr;
          const active = i === curr;
          const nodeStyle = {
            width: active ? 11 : 8,
            height: active ? 11 : 8,
            borderRadius: 6,
            backgroundColor: done ? Palette.brand : Palette.border,
            ...(active ? { shadowColor: Palette.brand, shadowRadius: 5, shadowOpacity: 0.55, elevation: 3 } : {}),
          };
          return (
            <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center', flex: i < TIMELINE_STEPS.length - 1 ? 1 : 0 }}>
              {active && inFlight ? (
                <MotiView from={{ opacity: 0.55, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'timing', duration: 950, loop: true, repeatReverse: true }}>
                  <View style={nodeStyle} />
                </MotiView>
              ) : (
                <View style={nodeStyle} />
              )}
              {i < TIMELINE_STEPS.length - 1 ? (
                <View style={{ flex: 1, height: 2, backgroundColor: i < curr ? Palette.brand : Palette.border, marginHorizontal: 2, borderRadius: 1 }} />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {TIMELINE_STEPS.map((step, i) => {
          const active = i === curr;
          const done = i < curr;
          return (
            <View key={step.key} style={{ flex: i < TIMELINE_STEPS.length - 1 ? 1 : 0, minWidth: 32, alignItems: i === 0 ? 'flex-start' : i === TIMELINE_STEPS.length - 1 ? 'flex-end' : 'center' }}>
              <Text style={{ fontFamily: active ? Font.semibold : Font.body, fontSize: 9.5, color: active ? Palette.brand : done ? Palette.inkSoft : Palette.textMuted }}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function statusStyle(s: OrderStatus): { bg: string; fg: string } {
  if (s === 'completed') return { bg: Palette.success + '1A', fg: Palette.success };
  if (s === 'cancelled') return { bg: Palette.canvas, fg: Palette.textSecondary };
  return { bg: Palette.brandTint, fg: Palette.brandPressed };
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function OrderCard({ order, onCancel, onReview, onPay, onReorder, onReport, onMessage, onChat, cancelling, needsPayment, paying, reordering }: {
  order: OrderSummary; onCancel: () => void; onReview: () => void; onPay: () => void;
  onReorder: () => void; onReport: () => void; onMessage: () => void; onChat: () => void;
  cancelling: boolean; needsPayment: boolean; paying: boolean; reordering: boolean;
}) {
  const st = statusStyle(order.status);
  return (
    <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PressableScale onPress={onMessage} accessibilityRole="button" accessibilityLabel={`View ${order.prepper}'s kitchen`} style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }} numberOfLines={1}>{order.prepper}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1, textTransform: 'capitalize' }}>{dateLabel(order.created_at)} · {order.fulfillment === 'meetup' ? 'meet up' : order.fulfillment === 'home_cook' ? 'home cook' : order.fulfillment}</Text>
        </PressableScale>
        <View style={{ paddingHorizontal: 11, height: 26, borderRadius: Radius.pill, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: st.fg }}>{STATUS_LABEL[order.status]}</Text>
        </View>
      </View>

      {order.status !== 'cancelled' ? (
        <View style={{ backgroundColor: Palette.canvas, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10 }}>
          <OrderTimeline status={order.status} />
        </View>
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

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Palette.chip, paddingTop: 11 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Total</Text>
        <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink, fontVariant: ['tabular-nums'] }}>{money(order.total)}</Text>
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

      {(order.status === 'completed' || order.status === 'cancelled') ? (
        order.disputed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
            <AlertTriangle size={13} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>Issue reported — we&apos;re looking into it.</Text>
          </View>
        ) : (
          <PressableScale onPress={onReport} accessibilityRole="button" accessibilityLabel="Report an issue with this preorder"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 36, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border }}>
            <AlertTriangle size={13} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>Report an issue</Text>
          </PressableScale>
        )
      ) : null}
    </View>
  );
}
