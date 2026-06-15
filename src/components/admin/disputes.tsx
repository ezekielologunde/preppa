import { AlertTriangle, Check, Receipt, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Radius } from '@/constants/theme';
import { useAdminDisputes, useAdminOrderItems, useResolveDispute } from '@/lib/queries/admin';
import { feedback } from '@/lib/feedback';
import type { AdminDisputeRow } from '@/types/database.types';
import { Admin, Card, SectionState } from './ui';

const FILTERS: { key: 'open' | 'resolved' | 'dismissed' | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'all', label: 'All' },
];

const money = (n: number) => `$${Number(n).toFixed(2)}`;

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return dateLabel(iso);
}

function ResolveForm({ dispute, onDone }: { dispute: AdminDisputeRow; onDone: () => void }) {
  const resolve = useResolveDispute();
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function act(resolution: 'resolved' | 'dismissed') {
    setErr(null);
    resolve.mutate(
      { disputeId: dispute.id, resolution, note: note.trim() || undefined },
      { onSuccess: () => { feedback.success(); onDone(); }, onError: (e) => { feedback.error(); setErr(e instanceof Error ? e.message : 'Could not resolve dispute.'); } },
    );
  }

  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Admin note (optional)"
        placeholderTextColor={Admin.textDim}
        multiline
        maxLength={500}
        accessibilityLabel="Admin note"
        style={{ minHeight: 60, backgroundColor: Admin.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Admin.border, padding: 10, fontFamily: Font.body, fontSize: 13, color: Admin.text, textAlignVertical: 'top' }}
      />
      {err ? <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Admin.danger }}>{err}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PressableScale
          onPress={() => act('resolved')}
          disabled={resolve.isPending}
          accessibilityRole="button"
          accessibilityLabel="Mark as resolved"
          style={{ flex: 1, flexDirection: 'row', gap: 6, height: 42, borderRadius: Radius.sm, backgroundColor: Admin.success, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={15} color="#fff" strokeWidth={3} />
          <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: '#fff' }}>Resolve</Text>
        </PressableScale>
        <PressableScale
          onPress={() => act('dismissed')}
          disabled={resolve.isPending}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dispute"
          style={{ flex: 1, flexDirection: 'row', gap: 6, height: 42, borderRadius: Radius.sm, borderWidth: 1, borderColor: Admin.border, alignItems: 'center', justifyContent: 'center' }}>
          <X size={15} color={Admin.textDim} />
          <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Admin.textDim }}>Dismiss</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function DisputeCard({ d }: { d: AdminDisputeRow }) {
  const [expanded, setExpanded] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const { data: orderItems, isLoading: itemsLoading } = useAdminOrderItems(d.order_id, showOrder);

  const statusColor =
    d.status === 'open' ? Admin.danger :
    d.status === 'resolved' ? Admin.success :
    Admin.textDim;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: statusColor + '22', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          <AlertTriangle size={17} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Admin.text }}>{d.reporter_name ?? 'Customer'}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: d.status === 'open' ? Admin.warn : Admin.textDim }}>{relativeTime(d.created_at)}</Text>
          </View>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim, marginTop: 1 }}>
            {d.prepper_name} · {money(d.order_total)} · {d.order_status}
          </Text>
          <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Admin.textMuted, marginTop: 1 }}>
            order #{d.order_id.slice(-8)}
          </Text>
        </View>
      </View>

      <Text style={{ fontFamily: Font.body, fontSize: 13, color: Admin.text, marginTop: 10, lineHeight: 19 }}>
        {d.reason}
      </Text>

      {d.admin_note ? (
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim, marginTop: 6, fontStyle: 'italic' }}>
          Note: {d.admin_note}
        </Text>
      ) : null}

      {/* Drill-down: what was actually ordered — the context to judge a refund fairly */}
      <PressableScale
        onPress={() => { feedback.tap(); setShowOrder((x) => !x); }}
        accessibilityRole="button"
        accessibilityLabel={showOrder ? 'Hide order contents' : 'View order contents'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <Receipt size={13} color={Admin.brand} />
        <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Admin.brand }}>{showOrder ? 'Hide order' : 'View order contents'}</Text>
      </PressableScale>

      {showOrder ? (
        <MotiView
          from={{ opacity: 0, translateY: -6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 200 }}
          style={{ marginTop: 8, backgroundColor: Admin.bg, borderRadius: Radius.sm, padding: 12, gap: 6 }}>
          {itemsLoading ? (
            <ActivityIndicator color={Admin.brand} />
          ) : !orderItems || orderItems.length === 0 ? (
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textMuted }}>No line items found for this order.</Text>
          ) : (
            <>
              {orderItems.map((it, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 12.5, color: Admin.text }} numberOfLines={1}>
                    {it.quantity}× {it.title}
                  </Text>
                  <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Admin.textDim, fontVariant: ['tabular-nums'] }}>{money(it.total)}</Text>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: Admin.border, marginVertical: 4 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Admin.text }}>Order total</Text>
                <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Admin.text, fontVariant: ['tabular-nums'] }}>{money(d.order_total)}</Text>
              </View>
            </>
          )}
        </MotiView>
      ) : null}

      {d.status === 'open' ? (
        <PressableScale
          onPress={() => { feedback.tap(); setExpanded((x) => !x); }}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse resolution form' : 'Resolve this dispute'}
          style={{ marginTop: 12, height: 38, borderRadius: Radius.sm, borderWidth: 1, borderColor: Admin.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.textDim }}>{expanded ? 'Cancel' : 'Take action'}</Text>
        </PressableScale>
      ) : (
        <View style={{ marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, alignSelf: 'flex-start', backgroundColor: statusColor + '1A' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: statusColor, textTransform: 'capitalize' }}>{d.status}</Text>
        </View>
      )}

      {expanded ? (
        <MotiView
          from={{ opacity: 0, translateY: -6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 200 }}>
          <ResolveForm dispute={d} onDone={() => setExpanded(false)} />
        </MotiView>
      ) : null}
    </Card>
  );
}

export function AdminDisputes() {
  const [filter, setFilter] = useState<'open' | 'resolved' | 'dismissed' | 'all'>('open');
  const [sort, setSort] = useState<'recent' | 'value'>('recent');
  const { data, isLoading, isError } = useAdminDisputes(filter);
  const { data: openData } = useAdminDisputes('open');
  const openCount = openData?.length ?? 0;
  const atStake = (openData ?? []).reduce((s, d) => s + Number(d.order_total ?? 0), 0);
  const sorted = [...(data ?? [])].sort((a, b) =>
    sort === 'value'
      ? Number(b.order_total ?? 0) - Number(a.order_total ?? 0)
      : b.created_at.localeCompare(a.created_at),
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const badge = f.key === 'open' && openCount > 0;
          return (
            <MotiView
              key={f.key}
              animate={{ backgroundColor: active ? Admin.brand : Admin.card, borderColor: active ? (badge ? Admin.danger : Admin.brand) : badge ? Admin.danger + '55' : Admin.border }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ borderRadius: Radius.pill, borderWidth: 1, overflow: 'hidden' }}>
              <PressableScale
                onPress={() => { feedback.tap(); setFilter(f.key); }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={badge ? `${f.label} (${openCount})` : f.label}
                style={{ paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : badge ? Admin.danger : Admin.textDim }}>{f.label}</Text>
                {badge ? (
                  <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: active ? 'rgba(255,255,255,0.25)' : Admin.danger + '22', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 10, color: active ? '#fff' : Admin.danger }}>{openCount > 9 ? '9+' : openCount}</Text>
                  </View>
                ) : null}
              </PressableScale>
            </MotiView>
          );
        })}
      </View>

      {openCount > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Admin.danger + '12', borderWidth: 1, borderColor: Admin.danger + '33', borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={15} color={Admin.danger} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Admin.text }}>
              {openCount} open dispute{openCount === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Admin.danger, fontVariant: ['tabular-nums'] }}>{money(atStake)} at stake</Text>
        </View>
      ) : null}

      {sorted.length > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textMuted }}>Sort</Text>
          {(['recent', 'value'] as const).map((s) => {
            const active = sort === s;
            return (
              <PressableScale key={s} onPress={() => { feedback.tap(); setSort(s); }}
                accessibilityRole="button" accessibilityState={{ selected: active }}
                accessibilityLabel={s === 'recent' ? 'Sort by recent' : 'Sort by highest value'}
                style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: active ? Admin.brand : Admin.card, borderWidth: 1, borderColor: active ? Admin.brand : Admin.border }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: active ? '#fff' : Admin.textDim }}>{s === 'recent' ? 'Recent' : 'Highest value'}</Text>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      <SectionState loading={isLoading} error={isError} empty={!data?.length} emptyText={`No ${filter} disputes.`} Icon={AlertTriangle} />

      {sorted.map((d) => <DisputeCard key={d.id} d={d} />)}
    </View>
  );
}
