import { AlertTriangle, Check, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Radius } from '@/constants/theme';
import { useAdminDisputes, useResolveDispute } from '@/lib/queries/admin';
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

function ResolveForm({ dispute, onDone }: { dispute: AdminDisputeRow; onDone: () => void }) {
  const resolve = useResolveDispute();
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function act(resolution: 'resolved' | 'dismissed') {
    setErr(null);
    resolve.mutate(
      { disputeId: dispute.id, resolution, note: note.trim() || undefined },
      { onSuccess: onDone, onError: (e) => setErr(e instanceof Error ? e.message : 'Could not resolve dispute.') },
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
            <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Admin.textDim }}>{dateLabel(d.created_at)}</Text>
          </View>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim, marginTop: 1 }}>
            {d.prepper_name} · {money(d.order_total)} · {d.order_status}
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

      {d.status === 'open' ? (
        <PressableScale
          onPress={() => setExpanded((x) => !x)}
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
  const { data, isLoading, isError } = useAdminDisputes(filter);

  const openCount = filter === 'open' ? (data?.length ?? 0) : undefined;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <MotiView
              key={f.key}
              animate={{ backgroundColor: active ? Admin.brand : Admin.card, borderColor: active ? Admin.brand : Admin.border }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ borderRadius: Radius.pill, borderWidth: 1, overflow: 'hidden' }}>
              <PressableScale
                onPress={() => setFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={f.label}
                style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : Admin.textDim }}>{f.label}</Text>
              </PressableScale>
            </MotiView>
          );
        })}
        {openCount ? (
          <View style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Admin.danger + '22' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.danger }}>{openCount} open</Text>
          </View>
        ) : null}
      </View>

      <SectionState loading={isLoading} error={isError} empty={!data?.length} emptyText={`No ${filter} disputes.`} Icon={AlertTriangle} />

      {(data ?? []).map((d) => <DisputeCard key={d.id} d={d} />)}
    </View>
  );
}
