import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUpRight, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, TouchTarget, Type } from '@/constants/theme';
import { formatMoney } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import { usePrepper } from '@/lib/use-prepper';
import {
  getMyPayouts,
  getMyStripeAccount,
  readiness,
  stripeConnectAction,
  type ConnectAction,
  type Payout,
  type PayoutStatus,
  type StripeAccount,
} from '@/lib/stripe-connect';

// ── Types ────────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'all';
type EarningsSummary = { grossPence: number; feePence: number; payoutPence: number; orderCount: number };

// ── Helpers ──────────────────────────────────────────────────────────────────

function periodStart(p: Period): string | null {
  if (p === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (p === 'week' ? 7 : 30));
  return d.toISOString();
}

const PAYOUT_CHIP: Record<PayoutStatus, { bg: string; fg: string; label: string }> = {
  paid:       { bg: Palette.successTint,   fg: Palette.successDark,   label: 'paid' },
  in_transit: { bg: Palette.confirmedTint, fg: Palette.confirmedDark, label: 'in transit' },
  pending:    { bg: Palette.amberTint,     fg: Palette.amberDeep,     label: 'pending' },
  failed:     { bg: Palette.cancelledTint, fg: Palette.danger,        label: 'failed' },
  canceled:   { bg: Palette.chip,          fg: Palette.textSecondary, label: 'canceled' },
};

const TONE_BG: Record<string, string> = {
  neutral: Palette.brandTint, warning: Palette.amberTint,
  success: Palette.successTint, danger: Palette.dangerTint,
};
const TONE_FG: Record<string, string> = {
  neutral: Palette.brandPressed, warning: Palette.amberDeep,
  success: Palette.successDark, danger: Palette.dangerDeep,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryRow({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <View style={s.summaryRow}>
      <Text style={[s.summaryLabel, muted && { color: Palette.textMuted }]}>{label}</Text>
      <Text style={[s.summaryValue, accent && { color: Palette.brand }, muted && { color: Palette.textMuted }]}>{value}</Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PrepperEarningsScreen() {
  const { kitchen, loading: kLoading, refresh } = usePrepper(true);
  const [period, setPeriod]       = useState<Period>('week');
  const [account, setAccount]     = useState<StripeAccount | null>(null);
  const [payouts, setPayouts]     = useState<Payout[]>([]);
  const [summary, setSummary]     = useState<EarningsSummary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    const [acct, pys] = await Promise.all([getMyStripeAccount(), getMyPayouts(10)]);
    setAccount(acct);
    setPayouts(pys);

    if (kitchen) {
      const since = periodStart(period);
      let q = supabase
        .from('payments')
        .select('amount_pence, prepper_payout_pence, created_at, order:orders!inner(kitchen_id)')
        .eq('order.kitchen_id', kitchen.id);
      if (since) q = q.gte('created_at', since);
      const { data } = await q.order('created_at', { ascending: false }).limit(200);
      const rows = (data ?? []) as { amount_pence: number; prepper_payout_pence: number }[];
      setSummary({
        grossPence:  rows.reduce((t, r) => t + (r.amount_pence ?? 0), 0),
        feePence:    rows.reduce((t, r) => t + ((r.amount_pence ?? 0) - (r.prepper_payout_pence ?? 0)), 0),
        payoutPence: rows.reduce((t, r) => t + (r.prepper_payout_pence ?? 0), 0),
        orderCount:  rows.length,
      });
    }
  }, [kitchen, period]);

  useEffect(() => { setLoading(true); fetchAll().finally(() => setLoading(false)); }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    // Pull fresh capability + balance from Stripe, then reload.
    try { await stripeConnectAction('sync_status'); await stripeConnectAction('get_balance'); } catch { /* offline-safe */ }
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll, refresh]);

  const runConnect = useCallback(async (action: ConnectAction) => {
    if (connectBusy) return;
    setConnectBusy(true);
    try {
      const res = await stripeConnectAction(action);
      if (action === 'create_account') {
        const link = await stripeConnectAction('get_onboarding_link');
        if (link.url) await Linking.openURL(link.url);
      } else if (res.url) {
        await Linking.openURL(res.url);
      }
      await fetchAll();
    } catch (e) {
      Alert.alert('Stripe', e instanceof Error ? e.message : 'Could not reach Stripe. Try again.');
    } finally {
      setConnectBusy(false);
    }
  }, [connectBusy, fetchAll]);

  const ready = readiness(account);
  const onBannerCta = () => {
    if (ready.cta === 'connect') return account?.stripe_account_id ? runConnect('get_onboarding_link') : runConnect('create_account');
    if (ready.cta === 'resume' || ready.cta === 'fix') return runConnect('get_onboarding_link');
    if (ready.cta === 'manage') return runConnect('get_dashboard_link');
  };

  if (kLoading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.center}><ActivityIndicator color={Palette.brand} /></View>
      </SafeAreaView>
    );
  }

  const reqDue = account?.requirements_due ?? [];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.brand} />}
      >
        <Text style={s.headerTitle}>earnings</Text>

        {/* ── Stripe Connect readiness banner ───────────────────── */}
        <View style={[s.banner, { backgroundColor: TONE_BG[ready.tone] }]}>
          {ready.tone === 'success' ? <CheckCircle size={20} color={TONE_FG.success} strokeWidth={2} />
            : ready.tone === 'danger' ? <XCircle size={20} color={TONE_FG.danger} strokeWidth={2} />
            : <AlertCircle size={20} color={TONE_FG[ready.tone]} strokeWidth={1.8} />}
          <View style={{ flex: 1 }}>
            <Text style={[s.bannerTitle, { color: TONE_FG[ready.tone] }]}>{ready.label}</Text>
            {account?.disabled_reason ? (
              <Text style={[s.bannerSub, { color: TONE_FG[ready.tone] }]}>{account.disabled_reason.replace(/[._]/g, ' ')}</Text>
            ) : ready.cta === 'resume' ? (
              <Text style={[s.bannerSub, { color: TONE_FG[ready.tone] }]}>verification in progress</Text>
            ) : null}
          </View>
          {ready.cta && (
            <TouchableOpacity onPress={onBannerCta} activeOpacity={0.85} disabled={connectBusy}
              style={[s.bannerBtn, { backgroundColor: TONE_FG[ready.tone] }]}>
              {connectBusy ? <ActivityIndicator size="small" color={Palette.surface} />
                : <><Text style={s.bannerBtnText}>{ready.cta === 'manage' ? 'dashboard' : ready.cta === 'fix' ? 'fix' : 'set up'}</Text>
                    <ArrowUpRight size={13} color={Palette.surface} strokeWidth={2} /></>}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Requirements due (pending / restricted) ───────────── */}
        {reqDue.length > 0 && (
          <View style={s.reqCard}>
            <Text style={s.reqTitle}>stripe needs</Text>
            {reqDue.slice(0, 5).map((r) => (
              <View key={r} style={s.reqRow}>
                <View style={s.reqDot} />
                <Text style={s.reqText}>{r.replace(/[._]/g, ' ')}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Balances (payouts-enabled accounts) ───────────────── */}
        {account?.payouts_enabled && (
          <View style={s.balanceRow}>
            <View style={[s.balanceCard, { marginRight: Space.md }]}>
              <Text style={s.balanceLabel}>available</Text>
              <Text style={s.balanceValue}>{formatMoney(account.available_pence)}</Text>
            </View>
            <View style={s.balanceCard}>
              <Text style={s.balanceLabel}>pending</Text>
              <Text style={[s.balanceValue, { color: Palette.textSecondary }]}>{formatMoney(account.pending_pence)}</Text>
            </View>
          </View>
        )}

        {/* ── Period switcher ───────────────────────────────────── */}
        <View style={s.periodRow}>
          {(['week', 'month', 'all'] as const).map((p) => (
            <TouchableOpacity key={p} onPress={() => setPeriod(p)} activeOpacity={0.7}
              style={[s.periodChip, period === p && s.periodChipActive]}>
              <Text style={[s.periodLabel, period === p && s.periodLabelActive]}>{p === 'all' ? 'all time' : `last ${p}`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Earnings summary ──────────────────────────────────── */}
        {loading ? (
          <View style={{ paddingVertical: Space.xxl, alignItems: 'center' }}><ActivityIndicator color={Palette.brand} /></View>
        ) : summary && (
          <View style={s.summaryCard}>
            <Text style={s.summaryHero}>{formatMoney(summary.payoutPence)}</Text>
            <Text style={s.summaryHeroLabel}>your earnings ({summary.orderCount} orders)</Text>
            <View style={s.divider} />
            <SummaryRow label="gross revenue" value={formatMoney(summary.grossPence)} />
            <SummaryRow label="preppa fee" value={`−${formatMoney(summary.feePence)}`} muted />
            <SummaryRow label="your payout" value={formatMoney(summary.payoutPence)} accent />
          </View>
        )}

        {/* ── Recent payouts (from Stripe) ──────────────────────── */}
        {payouts.length > 0 && (
          <>
            <Text style={s.sectionTitle}>recent payouts</Text>
            {payouts.map((p) => {
              const chip = PAYOUT_CHIP[p.status];
              return (
                <View key={p.id} style={s.payoutRow}>
                  <View style={s.payoutLeft}>
                    <Clock size={13} color={Palette.textMuted} strokeWidth={1.8} />
                    <Text style={s.payoutDate}>
                      {new Date(p.arrival_date ?? p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View style={s.payoutRight}>
                    <Text style={s.payoutAmount}>{formatMoney(p.amount_pence)}</Text>
                    <View style={[s.payoutBadge, { backgroundColor: chip.bg }]}>
                      <Text style={[s.payoutBadgeText, { color: chip.fg }]}>{chip.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: Space.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Space.xl, paddingTop: Space.md, paddingBottom: Space.xxl },
  headerTitle: { fontFamily: Font.display, fontSize: Type.displayLg, color: Palette.ink, letterSpacing: -0.8, marginBottom: Space.lg },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, padding: 14, marginBottom: Space.lg },
  bannerTitle: { fontFamily: Font.display, fontSize: Type.label, marginBottom: 2 },
  bannerSub: { fontFamily: Font.body, fontSize: Type.micro, lineHeight: 16 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36 },
  bannerBtnText: { fontFamily: Font.display, fontSize: Type.micro, color: Palette.surface },

  reqCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 14, marginBottom: Space.lg, ...Shadow.card },
  reqTitle: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  reqDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Palette.amber },
  reqText: { fontFamily: Font.body, fontSize: Type.label, color: Palette.inkSoft, textTransform: 'capitalize' },

  balanceRow: { flexDirection: 'row', marginBottom: Space.lg },
  balanceCard: { flex: 1, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, ...Shadow.card },
  balanceLabel: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginBottom: 4 },
  balanceValue: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink, letterSpacing: -0.4 },

  periodRow: { flexDirection: 'row', gap: Space.md, marginBottom: Space.lg },
  periodChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Palette.chip, minHeight: TouchTarget, justifyContent: 'center' },
  periodChipActive: { backgroundColor: Palette.brand },
  periodLabel: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.inkSoft },
  periodLabelActive: { color: Palette.surface },

  summaryCard: { backgroundColor: Palette.surface, borderRadius: Radius.avatar, padding: 20, marginBottom: 20, ...Shadow.card },
  summaryHero: { fontFamily: Font.display, fontSize: Type.heroLg, color: Palette.ink, letterSpacing: -1 },
  summaryHeroLabel: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, marginBottom: Space.lg },
  divider: { height: 1, backgroundColor: Palette.border, marginBottom: Space.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Palette.border },
  summaryLabel: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink },
  summaryValue: { fontFamily: Font.display, fontSize: Type.label, color: Palette.ink },

  sectionTitle: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12, marginBottom: Space.md, ...Shadow.card },
  payoutLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payoutDate: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary },
  payoutRight: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  payoutAmount: { fontFamily: Font.display, fontSize: Type.label, color: Palette.ink },
  payoutBadge: { paddingHorizontal: Space.md, paddingVertical: 3, borderRadius: Radius.pill },
  payoutBadgeText: { fontFamily: Font.semibold, fontSize: 9 },
});
