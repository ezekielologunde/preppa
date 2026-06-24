import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUpRight, AlertCircle, CheckCircle, Clock } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, TouchTarget, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { usePrepper } from '@/lib/use-prepper';

// ── Types ────────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'all';

type EarningsSummary = {
  totalRevenuePence:  number;
  platformFeePence:   number;
  prepperPayoutPence: number;
  orderCount:         number;
};

// Earnings always come from the payments table (read model) — never computed client-side
type PayoutRow = {
  id: string;
  amount: number;
  prepper_payout_pence: number;
  status: string;
  created_at: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function periodStart(p: Period): string | null {
  if (p === 'all') return null;
  const d = new Date();
  if (p === 'week') d.setDate(d.getDate() - 7);
  if (p === 'month') d.setDate(d.getDate() - 30);
  return d.toISOString();
}

function EarningsRow({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <View style={earnStyles.row}>
      <Text style={[earnStyles.label, muted && { color: Palette.textMuted }]}>{label}</Text>
      <Text style={[earnStyles.value, accent && { color: Palette.brand }, muted && { color: Palette.textMuted }]}>{value}</Text>
    </View>
  );
}

const earnStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Palette.border },
  label: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink },
  value: { fontFamily: Font.display, fontSize: Type.label, color: Palette.ink },
});

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PrepperEarningsScreen() {
  const { user, session } = useAuth();
  const { kitchen, profile, loading: kLoading, refresh } = usePrepper(true);
  const [period, setPeriod] = useState<Period>('week');
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  const fetchEarnings = useCallback(async () => {
    if (!kitchen) return;
    const since = periodStart(period);

    let builder = supabase
      .from('payments')
      .select('id, amount, prepper_payout_pence, status, created_at, order:orders(kitchen_id)')
      .eq('order.kitchen_id', kitchen.id); // read model: only this kitchen's payments

    if (since) builder = builder.gte('created_at', since);

    const { data } = await builder.order('created_at', { ascending: false }).limit(50);
    const rows = (data ?? []) as (PayoutRow & { order: { kitchen_id: string } | null })[];

    const totalRevenue  = rows.reduce((s, r) => s + (r.amount                ?? 0), 0);
    const platformFee   = rows.reduce((s, r) => s + (r.amount - r.prepper_payout_pence), 0);
    const prepperPayout = rows.reduce((s, r) => s + (r.prepper_payout_pence  ?? 0), 0);

    setSummary({ totalRevenuePence: totalRevenue, platformFeePence: platformFee, prepperPayoutPence: prepperPayout, orderCount: rows.length });
    setPayouts(rows.slice(0, 10));
  }, [kitchen, period]);

  useEffect(() => {
    setLoading(true);
    fetchEarnings().finally(() => setLoading(false));
  }, [fetchEarnings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    await fetchEarnings();
    setRefreshing(false);
  }, [fetchEarnings, refresh]);

  const handleConnectStripe = async (action: 'create_account' | 'get_onboarding_link' | 'get_dashboard_link') => {
    if (!user || connectLoading) return;
    setConnectLoading(true);
    const { data, error } = await supabase.functions.invoke('stripe-connect', {
      body: { action, prepper_id: user.id },
    });
    setConnectLoading(false);
    if (error || !data) { return; }

    if (action === 'create_account' && data.account_id) {
      refresh();
      handleConnectStripe('get_onboarding_link');
      return;
    }
    if (data.url) await Linking.openURL(data.url);
  };

  const stripeStatus = profile?.stripe_account_status;

  if (kLoading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={Palette.brand} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.brand} />}
      >
        <Text style={styles.headerTitle}>earnings</Text>

        {/* ── Stripe Connect status ─────────────────────────────── */}
        {stripeStatus !== 'active' && (
          <View style={[styles.connectCard, stripeStatus === 'pending' ? { backgroundColor: Palette.amberTint } : { backgroundColor: Palette.brandTint }]}>
            {stripeStatus === 'pending'
              ? <AlertCircle size={20} color={Palette.amberDeep} strokeWidth={1.8} />
              : <AlertCircle size={20} color={Palette.brand} strokeWidth={1.8} />
            }
            <View style={{ flex: 1 }}>
              <Text style={[styles.connectTitle, { color: stripeStatus === 'pending' ? Palette.amberDeep : Palette.brandPressed }]}>
                {stripeStatus === 'pending' ? 'finish stripe setup to get paid' : 'connect stripe to receive payouts'}
              </Text>
              <Text style={[styles.connectSub, { color: stripeStatus === 'pending' ? Palette.amberDeep : Palette.brandPressed }]}>
                {stripeStatus === 'pending' ? 'verification in progress — complete your profile' : 'set up payouts in minutes'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (!profile?.stripe_account_id) handleConnectStripe('create_account');
                else if (stripeStatus === 'pending') handleConnectStripe('get_onboarding_link');
                else handleConnectStripe('get_dashboard_link');
              }}
              activeOpacity={0.85}
              style={styles.connectBtn}
              disabled={connectLoading}
            >
              {connectLoading
                ? <ActivityIndicator size="small" color={Palette.surface} />
                : <><Text style={styles.connectBtnText}>set up</Text><ArrowUpRight size={13} color={Palette.surface} strokeWidth={2} /></>
              }
            </TouchableOpacity>
          </View>
        )}

        {stripeStatus === 'active' && (
          <View style={[styles.connectCard, { backgroundColor: Palette.successTint }]}>
            <CheckCircle size={18} color={Palette.successDark} strokeWidth={2} />
            <Text style={[styles.connectTitle, { color: Palette.successDark, flex: 1 }]}>stripe payouts active</Text>
            <TouchableOpacity onPress={() => handleConnectStripe('get_dashboard_link')} activeOpacity={0.8} style={[styles.connectBtn, { backgroundColor: Palette.successDark }]}>
              <Text style={styles.connectBtnText}>dashboard</Text>
              <ArrowUpRight size={13} color={Palette.surface} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Period switcher ───────────────────────────────────── */}
        <View style={styles.periodRow}>
          {(['week', 'month', 'all'] as const).map((p) => (
            <TouchableOpacity key={p} onPress={() => setPeriod(p)} activeOpacity={0.7} style={[styles.periodChip, period === p && styles.periodChipActive]}>
              <Text style={[styles.periodLabel, period === p && styles.periodLabelActive]}>{p === 'all' ? 'all time' : `last ${p}`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Summary card ─────────────────────────────────────── */}
        {loading ? (
          <View style={{ paddingVertical: Space.xxl, alignItems: 'center' }}><ActivityIndicator color={Palette.brand} /></View>
        ) : summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryHero}>£{(summary.prepperPayoutPence / 100).toFixed(2)}</Text>
            <Text style={styles.summaryHeroLabel}>your earnings ({summary.orderCount} orders)</Text>
            <View style={styles.divider} />
            <EarningsRow label="gross revenue" value={`£${(summary.totalRevenuePence / 100).toFixed(2)}`} />
            <EarningsRow label="preppa fee" value={`−£${(summary.platformFeePence / 100).toFixed(2)}`} muted />
            <EarningsRow label="your payout" value={`£${(summary.prepperPayoutPence / 100).toFixed(2)}`} accent />
          </View>
        )}

        {/* ── Recent payouts ────────────────────────────────────── */}
        {payouts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>recent orders</Text>
            {payouts.map((p) => (
              <View key={p.id} style={styles.payoutRow}>
                <View style={styles.payoutLeft}>
                  <Clock size={13} color={Palette.textMuted} strokeWidth={1.8} />
                  <Text style={styles.payoutDate}>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                </View>
                <View style={styles.payoutRight}>
                  <Text style={styles.payoutAmount}>£{(p.prepper_payout_pence / 100).toFixed(2)}</Text>
                  <View style={[styles.payoutBadge, { backgroundColor: p.status === 'released' ? Palette.successTint : Palette.amberTint }]}>
                    <Text style={[styles.payoutBadgeText, { color: p.status === 'released' ? Palette.successDark : Palette.amberDeep }]}>{p.status}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: Space.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: Space.xl, paddingTop: Space.md, paddingBottom: Space.xxl },
  headerTitle: { fontFamily: Font.display, fontSize: Type.displayLg, color: Palette.ink, letterSpacing: -0.8, marginBottom: Space.lg },

  connectCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, padding: 14, marginBottom: Space.lg },
  connectTitle: { fontFamily: Font.display, fontSize: Type.label, marginBottom: 2 },
  connectSub: { fontFamily: Font.body, fontSize: Type.micro, lineHeight: 16 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  connectBtnText: { fontFamily: Font.display, fontSize: Type.micro, color: Palette.surface },

  periodRow: { flexDirection: 'row', gap: Space.md, marginBottom: Space.lg },
  periodChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Palette.chip, minHeight: TouchTarget, justifyContent: 'center' },
  periodChipActive: { backgroundColor: Palette.brand },
  periodLabel: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.inkSoft },
  periodLabelActive: { color: Palette.surface },

  summaryCard: { backgroundColor: Palette.surface, borderRadius: Radius.avatar, padding: 20, marginBottom: 20, ...Shadow.card },
  summaryHero: { fontFamily: Font.display, fontSize: Type.heroLg, color: Palette.ink, letterSpacing: -1 },
  summaryHeroLabel: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, marginBottom: Space.lg },
  divider: { height: 1, backgroundColor: Palette.border, marginBottom: Space.sm },

  sectionTitle: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12, marginBottom: Space.md, ...Shadow.card },
  payoutLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payoutDate: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary },
  payoutRight: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  payoutAmount: { fontFamily: Font.display, fontSize: Type.label, color: Palette.ink },
  payoutBadge: { paddingHorizontal: Space.md, paddingVertical: 3, borderRadius: Radius.pill },
  payoutBadgeText: { fontFamily: Font.semibold, fontSize: 9 },
});
