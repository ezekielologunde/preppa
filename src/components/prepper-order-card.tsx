import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { QrCode, X, MapPin, Clock, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/ui/avatar';
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

// ── Status pipeline ─────────────────────────────────────────────────────────

const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending: { next: 'confirmed', cta: 'Confirm →' },
  confirmed: { next: 'preparing', cta: 'Start Prepping →' },
  preparing: { next: 'ready', cta: 'Mark Ready →' },
  ready: { next: 'completed', cta: 'Mark Complete →' },
  out_for_delivery: { next: 'completed', cta: 'Mark Complete →' },
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

const STATUS_CHIP_COLOR: Record<string, string> = {
  New: '#F59E0B',
  Confirmed: '#3B82F6',
  Preparing: '#3B82F6',
  Ready: Palette.success,
  'On the way': '#3B82F6',
  Complete: Palette.textMuted,
  Cancelled: Palette.textMuted,
};

// ── Relative time helper ────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Status filter types & helpers (exported for screen) ─────────────────────

export type StatusFilter = 'all' | 'pending' | 'prepping' | 'ready' | 'done';

interface FilterChipDef {
  key: StatusFilter;
  label: string;
  color: string;
  statuses: OrderStatus[];
}

const FILTER_CHIPS: FilterChipDef[] = [
  { key: 'pending', label: 'Pending', color: '#F59E0B', statuses: ['pending'] },
  { key: 'prepping', label: 'Prepping', color: '#3B82F6', statuses: ['confirmed', 'preparing', 'out_for_delivery'] },
  { key: 'ready', label: 'Ready', color: Palette.success, statuses: ['ready'] },
  { key: 'done', label: 'Done', color: Palette.textMuted, statuses: ['completed', 'cancelled'] },
];

export function applyStatusFilter(orders: OrderSummary[], filter: StatusFilter): OrderSummary[] {
  if (filter === 'all') return orders;
  const chip = FILTER_CHIPS.find((c) => c.key === filter);
  if (!chip) return orders;
  return orders.filter((o) => chip.statuses.includes(o.status));
}

// ── Status filter strip ──────────────────────────────────────────────────────

interface StatusFilterStripProps {
  orders: OrderSummary[];
  active: StatusFilter;
  onChange: (f: StatusFilter) => void;
}

export function StatusFilterStrip({ orders, active, onChange }: StatusFilterStripProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10, flexWrap: 'wrap' }}>
      {FILTER_CHIPS.map((chip) => {
        const count = chip.statuses.reduce((s, st) => s + orders.filter((o) => o.status === st).length, 0);
        const isActive = active === chip.key;
        return (
          <PressableScale
            key={chip.key}
            onPress={() => { feedback.tap(); onChange(isActive ? 'all' : chip.key); }}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${chip.label}`}
            accessibilityState={{ selected: isActive }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: Radius.pill,
              backgroundColor: isActive ? chip.color + '22' : CARD,
              borderWidth: 1,
              borderColor: isActive ? chip.color + '88' : 'transparent',
              minHeight: 44,
            }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: chip.color }} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isActive ? chip.color : Palette.textMuted }}>
              {chip.label}
            </Text>
            {count > 0 ? (
              <View style={{
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: isActive ? chip.color : chip.color + '44',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: isActive ? '#fff' : chip.color }}>{count}</Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

// ── Per-filter empty state ───────────────────────────────────────────────────

const EMPTY_COPY: Record<StatusFilter, { emoji: string; title: string; body: string }> = {
  all: { emoji: '🛍️', title: 'No active preorders', body: 'New preorders from customers appear here in real time.' },
  pending: { emoji: '🎉', title: 'All caught up!', body: 'No pending orders right now — you\'re on top of things.' },
  prepping: { emoji: '🧑‍🍳', title: 'Nothing in progress', body: 'Confirmed or in-prep orders will show here.' },
  ready: { emoji: '✅', title: 'Nothing ready yet', body: 'Orders you\'ve marked ready for pickup appear here.' },
  done: { emoji: '📦', title: 'No completed orders', body: 'Finished or cancelled orders build up here over time.' },
};

export function FilterEmptyState({ filter }: { filter: StatusFilter }) {
  const copy = EMPTY_COPY[filter];
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 10 }}>
      <Text style={{ fontSize: 40 }}>{copy.emoji}</Text>
      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff', textAlign: 'center' }}>{copy.title}</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textMuted, textAlign: 'center', lineHeight: 19 }}>{copy.body}</Text>
    </View>
  );
}

// ── Order detail bottom sheet ────────────────────────────────────────────────

interface OrderDetailModalProps {
  order: OrderSummary | null;
  onClose: () => void;
}

export function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  if (!order) return null;
  const label = STATUS_LABEL[order.status];
  const chipColor = STATUS_CHIP_COLOR[label] ?? Palette.textMuted;
  return (
    <Modal visible={!!order} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close order details"
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessible={false}
          style={{ backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14, maxHeight: '85%' }}>
          {/* Drag handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#2e3341', alignSelf: 'center', marginBottom: 4 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Font.display, fontSize: 18, color: '#fff', letterSpacing: -0.4 }}>Order details</Text>
            <PressableScale onPress={() => { feedback.tap(); onClose(); }} accessibilityRole="button" accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#252a34', alignItems: 'center', justifyContent: 'center' }}>
              <X size={17} color={Palette.textMuted} />
            </PressableScale>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {/* Customer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={order.customer} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14.5, color: '#fff' }}>{order.customer}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 1 }}>{relTime(order.created_at)}</Text>
              </View>
              <View style={{ paddingHorizontal: 11, height: 26, borderRadius: Radius.pill, backgroundColor: chipColor + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: chipColor }}>{label}</Text>
              </View>
            </View>

            {/* Items */}
            <View style={{ backgroundColor: '#1d2129', borderRadius: 14, padding: 12, gap: 8 }}>
              {order.items.map((it) => (
                <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }} numberOfLines={1}>{it.quantity}× {it.title}</Text>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textMuted, fontVariant: ['tabular-nums'] }}>{money(it.total)}</Text>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: '#252a34', marginVertical: 2 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>Total</Text>
                <Text style={{ fontFamily: Font.display, fontSize: 14, color: ORANGE, letterSpacing: -0.2, fontVariant: ['tabular-nums'] }}>{money(order.total)}</Text>
              </View>
            </View>

            {/* Fulfillment */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#1d2129', borderRadius: 12, padding: 10 }}>
              <MapPin size={13} color={order.fulfillment === 'home_cook' ? HC : ORANGE} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: order.fulfillment === 'home_cook' ? HC_TINT : ORANGE, textTransform: 'capitalize' }}>
                  {order.fulfillment === 'meetup' ? 'Meet up' : order.fulfillment === 'home_cook' ? 'Home cook' : order.fulfillment}
                </Text>
                {order.fulfillmentNote ? (
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, marginTop: 2, lineHeight: 17 }}>{order.fulfillmentNote}</Text>
                ) : null}
              </View>
            </View>

            {/* Scheduled */}
            {order.scheduled_at ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#1d2129', borderRadius: 12, padding: 10 }}>
                <Clock size={13} color={Palette.textMuted} />
                <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>
                  Scheduled: {new Date(order.scheduled_at).toLocaleString()}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Order card ───────────────────────────────────────────────────────────────

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
  const [detailOpen, setDetailOpen] = useState(false);
  const router = useRouter();
  const step = NEXT[order.status];
  const needsHandoff = step?.next === 'completed' && (
    order.fulfillment === 'pickup' || order.fulfillment === 'meetup' || order.fulfillment === 'home_cook'
  );
  const canCancel = order.status === 'pending' || order.status === 'confirmed';
  const done = order.status === 'completed' || order.status === 'cancelled';
  const label = STATUS_LABEL[order.status];
  const chipColor = STATUS_CHIP_COLOR[label] ?? Palette.textMuted;

  const mealSummary = order.items.length === 0
    ? 'Custom job'
    : order.items.length === 1
      ? order.items[0].title
      : `${order.items[0].title} +${order.items.length - 1} more`;

  return (
    <>
      <PressableScale
        onPress={() => { feedback.tap(); setDetailOpen(true); }}
        accessibilityRole="button"
        accessibilityLabel={`View order from ${order.customer}`}
        style={{ backgroundColor: CARD, borderRadius: 20, padding: 16, gap: 12 }}>

        {/* Customer row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={order.customer} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }} numberOfLines={1}>{order.customer}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted, marginTop: 1 }}>{relTime(order.created_at)}</Text>
          </View>
          <PressableScale
            onPress={(e) => { (e as any).stopPropagation?.(); feedback.tap(); router.push(`/order-chat?orderId=${order.id}` as never); }}
            accessibilityRole="button"
            accessibilityLabel="Message customer"
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#1d2129', alignItems: 'center', justifyContent: 'center' }}>
            <MessageCircle size={16} color={Palette.textMuted} />
          </PressableScale>
          <View style={{ paddingHorizontal: 10, height: 24, borderRadius: Radius.pill, backgroundColor: chipColor + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: chipColor }}>{label}</Text>
          </View>
        </View>

        {/* Meal + price */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }} numberOfLines={1}>{mealSummary}</Text>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: ORANGE, letterSpacing: -0.3, fontVariant: ['tabular-nums'] }}>{money(order.total)}</Text>
        </View>

        {/* Actions */}
        {step ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {canCancel ? (
              <PressableScale
                onPress={(e) => { (e as any).stopPropagation?.(); feedback.warning(); onCancel(); }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Decline preorder"
                style={{ paddingHorizontal: 4, minHeight: 44, justifyContent: 'center', opacity: busy ? 0.4 : 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.danger }}>Decline</Text>
              </PressableScale>
            ) : null}
            <PressableScale
              onPress={(e) => { (e as any).stopPropagation?.(); feedback.tap(); if (needsHandoff) onVerify(); else onAdvance(step.next); }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={needsHandoff ? 'Verify handoff and complete' : step.cta}
              style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: ORANGE, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  {needsHandoff ? <QrCode size={15} color="#fff" /> : null}
                  <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: '#fff' }}>{needsHandoff ? 'Verify & complete' : step.cta}</Text>
                </>
              )}
            </PressableScale>
          </View>
        ) : done ? (
          <View style={{ height: 36, borderRadius: Radius.pill, backgroundColor: '#1d2129', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textMuted }}>{label}</Text>
          </View>
        ) : null}
      </PressableScale>

      <OrderDetailModal order={detailOpen ? order : null} onClose={() => setDetailOpen(false)} />
    </>
  );
}
