import { ChevronDown, ChevronUp, Receipt } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Radius } from '@/constants/theme';
import { useAdminOrders } from '@/lib/queries/admin';
import type { OrderStatus } from '@/types/database.types';
import { Admin, Card, money, Pill, SectionState } from './ui';

const ORDER_FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

function relativeOrderTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ReceiptLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: strong ? 8 : 4 }}>
      <Text style={{ fontFamily: strong ? Font.heading : Font.body, fontSize: strong ? 14 : 12, color: strong ? Admin.text : Admin.textDim }}>{label}</Text>
      <Text style={{ fontFamily: strong ? Font.heading : Font.medium, fontSize: strong ? 14 : 12, color: strong ? Admin.text : Admin.textDim, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

export function AdminOrders() {
  const [filter, setFilter] = useState<OrderStatus | undefined>(undefined);
  const { data, isLoading, isError } = useAdminOrders(filter);
  const [open, setOpen] = useState<string | null>(null);
  const filteredTotal = (data ?? []).reduce((s, o) => s + (o.total ?? 0), 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayOrders = !filter ? (data ?? []).filter((o) => new Date(o.created_at) >= todayStart) : [];
  const todayTotal = todayOrders.reduce((s, o) => s + (o.total ?? 0), 0);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {ORDER_FILTERS.map((f) => {
          const active = (f.key === 'all' ? undefined : f.key) === filter;
          return (
            <MotiView
              key={f.key}
              animate={{ backgroundColor: active ? Admin.brand : Admin.card, borderColor: active ? Admin.brand : Admin.border }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ borderRadius: Radius.pill, borderWidth: 1, overflow: 'hidden' }}>
              <PressableScale
                onPress={() => setFilter(f.key === 'all' ? undefined : f.key as OrderStatus)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${f.label} orders`}
                style={{ paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: active ? '#fff' : Admin.textDim }}>{f.label}</Text>
              </PressableScale>
            </MotiView>
          );
        })}
      </View>

      {data && data.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>{data.length} order{data.length === 1 ? '' : 's'}</Text>
            {todayOrders.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: Admin.success }} />
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.success }}>
                  {todayOrders.length} today · {money(todayTotal)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Admin.text, fontVariant: ['tabular-nums'] }}>{money(filteredTotal)}</Text>
        </View>
      ) : null}

      <SectionState loading={isLoading} error={isError} empty={!data?.length} emptyText="No orders yet. Receipts appear here once customers check out." Icon={Receipt} />

      {(data ?? []).map((o) => {
        const expanded = open === o.id;
        const customer = o.customer?.full_name ?? o.customer?.email?.split('@')[0] ?? 'guest';
        const date = relativeOrderTime(o.created_at);
        return (
          <Card key={o.id} style={{ padding: 0, overflow: 'hidden' }}>
            <PressableScale
              onPress={() => setOpen(expanded ? null : o.id)}
              accessibilityRole="button"
              accessibilityLabel={`Order from ${customer}, ${money(o.total)}`}
              style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Admin.text }}>{money(o.total)}</Text>
                  <Pill label={o.status} />
                </View>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim, marginTop: 3 }}>
                  {customer} → {o.prepper?.display_name ?? 'prepper'} · {date}
                </Text>
              </View>
              {expanded ? <ChevronUp size={18} color={Admin.textMuted} /> : <ChevronDown size={18} color={Admin.textMuted} />}
            </PressableScale>

            {expanded ? (
              <MotiView
                from={{ opacity: 0, translateY: -6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 200 }}
                style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: Admin.border, paddingTop: 12 }}>
                {o.items.map((it, i) => (
                  <ReceiptLine key={i} label={`${it.quantity}× ${it.meal?.title ?? 'item'}`} value={money(it.total)} />
                ))}
                <View style={{ height: 1, backgroundColor: Admin.border, marginVertical: 10 }} />
                <ReceiptLine label="Subtotal" value={money(o.subtotal)} />
                {o.tax ? <ReceiptLine label="Tax" value={money(o.tax)} /> : null}
                {o.delivery_fee ? <ReceiptLine label="Delivery" value={money(o.delivery_fee)} /> : null}
                {o.service_fee ? <ReceiptLine label="Service" value={money(o.service_fee)} /> : null}
                {o.tip ? <ReceiptLine label="Tip" value={money(o.tip)} /> : null}
                <ReceiptLine label="Total" value={money(o.total)} strong />
                <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Admin.textMuted }}>Payment</Text>
                  <Pill label={o.payment?.status ?? 'unpaid'} />
                  {o.payment ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textMuted }}>· {o.payment.provider}</Text> : null}
                </View>
              </MotiView>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
