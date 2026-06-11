import { BadgeCheck, Check, ChevronDown, ChevronUp, Store, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Radius } from '@/constants/theme';
import { useAdminPreppers, useSetPrepperStatus, useVerifyPrepper } from '@/lib/queries/admin';
import type { AdminPrepper } from '@/lib/queries/admin';
import type { PrepperStatus } from '@/types/database.types';
import { Admin, Avatar, Card, Pill, SectionState } from './ui';

const FILTERS: { key: PrepperStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function PrepperCard({ p }: { p: AdminPrepper }) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const setStatus = useSetPrepperStatus();
  const verify = useVerifyPrepper();

  function approve() { setStatus.mutate({ prepperId: p.id, status: 'approved' }); }
  function suspend() { setStatus.mutate({ prepperId: p.id, status: 'suspended' }); }
  function confirmReject() {
    setStatus.mutate({ prepperId: p.id, status: 'rejected', note: note.trim() || undefined });
    setRejecting(false);
    setNote('');
  }

  return (
    <Card>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={p.display_name} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Admin.text }}>{p.display_name}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }} numberOfLines={1}>
            {p.user?.email ?? p.user?.full_name ?? 'no contact'}
          </Text>
        </View>
        <Pill label={p.status} />
        <PressableScale
          onPress={() => setExpanded((x) => !x)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse details' : 'Expand details'}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          {expanded ? <ChevronUp size={16} color={Admin.textDim} /> : <ChevronDown size={16} color={Admin.textDim} />}
        </PressableScale>
      </View>

      {/* Collapsed bio — truncated */}
      {!expanded && p.bio ? (
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Admin.textDim, marginTop: 10, lineHeight: 19 }} numberOfLines={3}>
          {p.bio}
        </Text>
      ) : null}

      {/* Expanded detail panel */}
      {expanded ? (
        <MotiView
          from={{ opacity: 0, translateY: -6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 200 }}>
          <View style={{ marginTop: 12, backgroundColor: Admin.bg, borderRadius: Radius.sm, padding: 12, gap: 5 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Admin.textDim }}>Applied {dateLabel(p.created_at)}</Text>
            {p.user?.full_name ? (
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Admin.text }}>{p.user.full_name}</Text>
            ) : null}
            {p.user?.phone ? (
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>{p.user.phone}</Text>
            ) : null}
          </View>
          {p.bio ? (
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Admin.textDim, marginTop: 10, lineHeight: 19 }}>
              {p.bio}
            </Text>
          ) : null}
        </MotiView>
      ) : null}

      {/* Rejection note — always visible when set */}
      {p.rejection_note ? (
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.danger, marginTop: 6 }}>
          Note: {p.rejection_note}
        </Text>
      ) : null}

      {/* Identity verification (approved preppers only) */}
      {p.status === 'approved' ? (
        <PressableScale
          onPress={() => verify.mutate({ prepperId: p.id, verified: !p.verified })}
          disabled={verify.isPending}
          accessibilityRole="button"
          accessibilityLabel={p.verified ? 'Remove verification' : `Verify ${p.display_name}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, height: 36, borderRadius: Radius.pill, alignSelf: 'flex-start', backgroundColor: p.verified ? Admin.success + '22' : Admin.card, borderWidth: 1, borderColor: p.verified ? Admin.success + '66' : Admin.border }}>
          <BadgeCheck size={14} color={p.verified ? Admin.success : Admin.textDim} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: p.verified ? Admin.success : Admin.textDim }}>
            {p.verified ? 'Verified' : 'Mark as verified'}
          </Text>
        </PressableScale>
      ) : null}

      {/* Rejection form — shown instead of action buttons while rejecting */}
      {rejecting ? (
        <MotiView
          from={{ opacity: 0, translateY: -6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 200 }}
          style={{ marginTop: 12, gap: 8 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Rejection note (optional)"
            placeholderTextColor={Admin.textDim}
            multiline
            style={{ minHeight: 56, backgroundColor: Admin.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Admin.border, padding: 10, fontFamily: Font.body, fontSize: 13, color: Admin.text, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PressableScale
              onPress={confirmReject}
              disabled={setStatus.isPending}
              accessibilityRole="button"
              accessibilityLabel="Confirm rejection"
              style={{ flex: 1, height: 42, borderRadius: Radius.sm, backgroundColor: Admin.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: '#fff' }}>Confirm reject</Text>
            </PressableScale>
            <PressableScale
              onPress={() => { setRejecting(false); setNote(''); }}
              accessibilityRole="button"
              accessibilityLabel="Cancel rejection"
              style={{ flex: 1, height: 42, borderRadius: Radius.sm, borderWidth: 1, borderColor: Admin.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Admin.textDim }}>Cancel</Text>
            </PressableScale>
          </View>
        </MotiView>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {p.status !== 'approved' ? (
            <PressableScale
              onPress={approve}
              disabled={setStatus.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Approve ${p.display_name}`}
              style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: Radius.sm, backgroundColor: Admin.success }}>
              <Check size={16} color="#fff" strokeWidth={3} />
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Approve</Text>
            </PressableScale>
          ) : (
            <PressableScale
              onPress={suspend}
              disabled={setStatus.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Suspend ${p.display_name}`}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Admin.border }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Admin.textDim }}>Suspend</Text>
            </PressableScale>
          )}
          {p.status !== 'rejected' && p.status !== 'approved' ? (
            <PressableScale
              onPress={() => setRejecting(true)}
              disabled={setStatus.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Reject ${p.display_name}`}
              style={{ width: 52, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Admin.danger + '55' }}>
              <X size={18} color={Admin.danger} />
            </PressableScale>
          ) : null}
        </View>
      )}
    </Card>
  );
}

export function AdminPreppers() {
  const [filter, setFilter] = useState<PrepperStatus>('pending');
  const { data, isLoading, isError } = useAdminPreppers(filter);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <PressableScale
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${f.label} preppers`}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: active ? Admin.brand : Admin.card, borderWidth: 1, borderColor: active ? Admin.brand : Admin.border }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : Admin.textDim }}>{f.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      <SectionState loading={isLoading} error={isError} empty={!data?.length} emptyText={`No ${filter} preppers.`} Icon={Store} />

      {(data ?? []).map((p) => <PrepperCard key={p.id} p={p} />)}
    </View>
  );
}
