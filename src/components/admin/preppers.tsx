import { BadgeCheck, Check, ChevronDown, ChevronRight, ChevronUp, ExternalLink, Star, Store, X } from 'lucide-react-native';
import { useAdminToggleFeatured } from '@/lib/queries/featured';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAdminPreppers, usePrepperEarnings, useSetPrepperStatus, useVerifyPrepper } from '@/lib/queries/admin';
import type { AdminPrepper } from '@/lib/queries/admin';
import { supabase } from '@/lib/supabase';
import type { PrepperEarningsRow, PrepperStatus } from '@/types/database.types';
import { Admin, Avatar, Card, money, compact, Pill, SectionState } from './ui';

const FILTERS: { key: PrepperStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function PrepperCard({ p, earnings }: { p: AdminPrepper; earnings?: PrepperEarningsRow }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [actionErr, setActionErr] = useState<string | null>(null);
  const setStatus = useSetPrepperStatus();
  const verify = useVerifyPrepper();
  const toggleFeatured = useAdminToggleFeatured();

  function approve() {
    setActionErr(null);
    setStatus.mutate({ prepperId: p.id, status: 'approved' }, {
      onSuccess: () => {
        feedback.success();
        void supabase.from('prepper_profiles').select('user_id').eq('id', p.id).single().then(({ data }) => {
          const uid = (data as { user_id: string } | null)?.user_id;
          if (uid) {
            void supabase.functions.invoke('notify', {
              body: { user_id: uid, title: 'You\'re approved!', body: 'Your kitchen is now live on Preppa. Time to publish your first meal!', data: { type: 'approved' } },
            });
          }
        });
      },
      onError: () => { feedback.error(); setActionErr('Could not approve. Please try again.'); },
    });
  }
  function suspend() {
    setActionErr(null);
    setStatus.mutate({ prepperId: p.id, status: 'suspended' }, {
      onSuccess: () => feedback.success(),
      onError: () => { feedback.error(); setActionErr('Could not suspend. Please try again.'); },
    });
  }
  function confirmReject() {
    setActionErr(null);
    setStatus.mutate(
      { prepperId: p.id, status: 'rejected', note: note.trim() || undefined },
      {
        onSuccess: () => {
          feedback.success();
          setRejecting(false);
          setNote('');
          void supabase.from('prepper_profiles').select('user_id').eq('id', p.id).single().then(({ data }) => {
            const uid = (data as { user_id: string } | null)?.user_id;
            if (uid) {
              void supabase.functions.invoke('notify', {
                body: { user_id: uid, title: 'Application update', body: 'Your kitchen application wasn\'t approved this time. Tap to review and reapply.', data: { type: 'rejected' } },
              });
            }
          });
        },
        onError: () => { feedback.error(); setActionErr('Could not reject. Please try again.'); },
      },
    );
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
        {p.status === 'approved' ? (
          <PressableScale
            onPress={() => {
              toggleFeatured.mutate({ prepperId: p.id, featured: !p.is_featured }, {
                onSuccess: () => feedback.success(),
                onError: () => feedback.error(),
              });
            }}
            disabled={toggleFeatured.isPending}
            accessibilityRole="button"
            accessibilityLabel={p.is_featured ? 'Remove from featured' : 'Mark as featured'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Star size={16} color={p.is_featured ? Palette.amber : Admin.textDim} fill={p.is_featured ? Palette.amber : 'none'} />
          </PressableScale>
        ) : null}
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
          {earnings && Number(earnings.completed_sales) > 0 ? (
            <View style={{ marginTop: 10, flexDirection: 'row', gap: 16, flexWrap: 'wrap', backgroundColor: Admin.bg, borderRadius: Radius.sm, padding: 10 }}>
              <View>
                <Text style={{ fontFamily: Font.display, fontSize: 18, color: Admin.success, fontVariant: ['tabular-nums'] }}>{money(earnings.completed_sales)}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Admin.textMuted }}>completed sales</Text>
              </View>
              <View>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Admin.text, fontVariant: ['tabular-nums'] }}>{compact(earnings.completed_orders)}/{compact(earnings.total_orders)}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Admin.textMuted }}>orders</Text>
              </View>
              {Number(earnings.rating) > 0 ? (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Star size={12} color={Palette.amber} fill={Palette.amber} />
                    <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.amber, fontVariant: ['tabular-nums'] }}>{Number(earnings.rating).toFixed(1)}</Text>
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Admin.textMuted }}>avg rating</Text>
                </View>
              ) : null}
            </View>
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
          onPress={() => {
            setActionErr(null);
            verify.mutate({ prepperId: p.id, verified: !p.verified }, {
              onSuccess: () => feedback.success(),
              onError: () => { feedback.error(); setActionErr('Could not update verification. Please try again.'); },
            });
          }}
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

      {actionErr ? <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Admin.danger, marginTop: 8 }}>{actionErr}</Text> : null}

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
            maxLength={500}
            accessibilityLabel="Rejection note"
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

      {p.status === 'approved' ? (
        <PressableScale
          onPress={() => { feedback.tap(); router.push(`/prepper?id=${p.id}`); }}
          accessibilityRole="link"
          accessibilityLabel="View public profile"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Admin.border }}>
          <ExternalLink size={16} color={Admin.textDim} />
          <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Admin.textDim }}>View public kitchen</Text>
          <ChevronRight size={16} color={Admin.textDim} />
        </PressableScale>
      ) : null}
    </Card>
  );
}

export function AdminPreppers() {
  const [filter, setFilter] = useState<PrepperStatus>('pending');
  const { data: all, isLoading, isError } = useAdminPreppers();
  const { data: earningsData } = usePrepperEarnings();
  const earningsMap = Object.fromEntries((earningsData ?? []).map((r) => [r.prepper_id, r]));

  const counts = (all ?? []).reduce<Partial<Record<PrepperStatus, number>>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const filtered = (all ?? []).filter((p) => p.status === filter);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key] ?? 0;
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
                accessibilityLabel={`${f.label} preppers (${count})`}
                style={{ paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : Admin.textDim }}>{f.label}</Text>
                {count > 0 ? (
                  <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: active ? 'rgba(255,255,255,0.25)' : Admin.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 10, color: active ? '#fff' : Admin.textMuted }}>{count > 99 ? '99+' : count}</Text>
                  </View>
                ) : null}
              </PressableScale>
            </MotiView>
          );
        })}
      </View>

      {filtered.length > 0 ? (
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>{filtered.length} {filter} prepper{filtered.length === 1 ? '' : 's'}</Text>
      ) : null}

      <SectionState loading={isLoading} error={isError} empty={!filtered.length} emptyText={`No ${filter} preppers.`} Icon={Store} />

      {filtered.map((p) => <PrepperCard key={p.id} p={p} earnings={earningsMap[p.id]} />)}
    </View>
  );
}
