import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDownToLine, ChevronLeft, Download, DollarSign, Lightbulb, Receipt, Shield, TrendingUp, Wallet } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Platform, RefreshControl, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';
import { Palette, Radius } from '@/constants/theme';
import { PayoutSetupCard } from '@/components/payout-setup-card';
import { useMyEarnings, usePrepperRefunds, type EarningsRecent, type RefundRow } from '@/lib/queries/earnings';
import { useStripeConnect } from '@/lib/queries/stripe-connect';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const RED = Palette.danger;
const CARD = Palette.prepperCard;
const BG = Palette.prepperBg;
const MUTED = Palette.textMuted;

const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

type Period = 'month' | 'quarter' | 'year';
const PERIOD_LABELS: { key: Period; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Last 3 mo' },
  { key: 'year', label: 'This year' },
];

function periodCutoff(p: Period): Date {
  const now = new Date();
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === 'quarter') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d; }
  return new Date(now.getFullYear(), 0, 1);
}

function filterByPeriod(items: EarningsRecent[], period: Period) {
  const cutoff = periodCutoff(period);
  return items.filter(it => new Date(it.created_at) >= cutoff);
}

function PeriodPills({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {PERIOD_LABELS.map(({ key, label }) => {
        const active = key === value;
        return (
          <TouchableOpacity key={key} onPress={() => { feedback.tap(); onChange(key); }}
            style={{ borderRadius: Radius.pill, paddingHorizontal: 14, height: 44, alignItems: 'center', justifyContent: 'center',
              backgroundColor: active ? ORANGE : CARD, borderWidth: active ? 0 : 1, borderColor: '#ffffff18' }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: active ? '#fff' : MUTED }}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MiniStat({ label, value, Icon, color }: { label: string; value: string; Icon: typeof Wallet; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 18, padding: 16, gap: 8 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} />
      </View>
      <Text style={{ fontFamily: Font.heading, fontSize: 19, color: '#fff' }}>{value}</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>{label}</Text>
    </View>
  );
}

function EarningRow({ item }: { item: EarningsRecent }) {
  const refunded = Number(item.refunded) > 0;
  const net = Number(item.net);
  const extra = item.item_count > 1 ? ` +${item.item_count - 1} more` : '';
  const title = (item.first_item ?? 'Preorder') + extra;
  const who = item.customer_first ? `${item.customer_first} · ` : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 16, padding: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: refunded ? '#7f1d1d' : ORANGE + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Receipt size={18} color={refunded ? '#fecaca' : ORANGE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.semibold, fontSize: 14.5, color: '#fff' }}>{title}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>
          {who}{shortDate(item.created_at)}{!refunded && Number(item.fees) > 0 ? ` · ${money(item.amount)} − ${money(item.fees)} fees` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: refunded ? MUTED : GREEN }}>{refunded ? money(0) : `+${money(net)}`}</Text>
        {refunded ? <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: '#fca5a5' }}>refunded</Text> : null}
      </View>
    </View>
  );
}

function RefundRow({ item }: { item: RefundRow }) {
  const shortId = `#${item.order_id.slice(0, 8)}`;
  const reason = item.reason ?? 'customer request';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 16, padding: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: RED + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Receipt size={18} color={RED} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>{shortId}</Text>
        <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>{shortDate(item.created_at)} · {reason}</Text>
      </View>
      <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: RED }}>−{money(item.amount)}</Text>
    </View>
  );
}

export default function EarningsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ stripe?: string }>();
  const isDesktop = useBreakpoint() === 'desktop';
  const { data, isLoading, isError, refetch } = useMyEarnings();
  const { data: refunds = [] } = usePrepperRefunds();
  const { syncStatus } = useStripeConnect();
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('month');

  // When Stripe redirects back after onboarding, sync the account status.
  useEffect(() => {
    if (params.stripe === 'return' || params.stripe === 'refresh') {
      void syncStatus.mutateAsync().catch(() => {});
    }
  }, [params.stripe]);

  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  async function exportTaxCSV() {
    feedback.tap();
    const year = new Date().getFullYear();
    const recent = data?.recent ?? [];
    const rows: string[][] = [
      ['Date', 'Order ID', 'Gross', 'Platform Fee (15%)', 'Net Payout'],
      ...recent.map(o => [
        shortDate(o.created_at),
        o.order_id.slice(0, 8),
        Number(o.amount).toFixed(2),
        (Number(o.amount) * 0.15).toFixed(2),
        Number(o.net).toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preppa-earnings-${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ title: `Preppa Earnings ${year}`, message: csv });
    }
    feedback.success();
  }

  const filteredRecent = data ? filterByPeriod(data.recent, period) : [];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }}
            accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6, flex: 1 }}>earnings</Text>
          {data?.is_prepper && (
            <TouchableOpacity onPress={exportTaxCSV} accessibilityRole="button" accessibilityLabel="Export earnings as CSV"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: ORANGE,
                borderRadius: Radius.pill, paddingHorizontal: 14, height: 36 }}>
              <Download size={14} color={ORANGE} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: ORANGE }}>Export CSV</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={{ padding: 20, gap: 14 }}>
            <Skeleton width="100%" height={140} radius={22} style={{ backgroundColor: '#ffffff18' }} />
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Skeleton height={96} radius={18} style={{ flex: 1, backgroundColor: '#ffffff18' }} />
              <Skeleton height={96} radius={18} style={{ flex: 1, backgroundColor: '#ffffff18' }} />
            </View>
            <Skeleton width="100%" height={56} radius={16} style={{ backgroundColor: '#ffffff18' }} />
            <Skeleton width="100%" height={128} radius={18} style={{ backgroundColor: '#ffffff18' }} />
            <Skeleton width={80} height={20} radius={6} style={{ backgroundColor: '#ffffff18' }} />
            {[0, 1, 2].map(i => (
              <Skeleton key={i} width="100%" height={66} radius={16} style={{ backgroundColor: '#ffffff18' }} />
            ))}
          </View>
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={28} color={MUTED} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>couldn't load earnings</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center' }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading earnings"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : !data?.is_prepper ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={28} color="#5b6170" />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>No earnings yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center' }}>Become a prepper and your sales will show up here.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/become-prepper'); }} accessibilityRole="button" accessibilityLabel="Become a prepper"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Become a prepper</Text>
            </PressableScale>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
            contentContainerStyle={{ paddingBottom: 48 }}>
            <View style={[{ padding: 20, gap: 14 }, isDesktop ? { maxWidth: 800, alignSelf: 'center', width: '100%' } : null]}>

              {/* Hero: net earnings */}
              <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
                <View style={{ backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: GREEN + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <DollarSign size={17} color={GREEN} />
                    </View>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: MUTED }}>Net earnings</Text>
                  </View>
                  <Text style={{ fontFamily: Font.display, fontSize: 40, color: '#fff', letterSpacing: -1 }}>{money(data.net_total)}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>
                    from {data.orders_paid} paid {data.orders_paid === 1 ? 'preorder' : 'preorders'}
                    {Number(data.refunded_total) > 0 ? ` · ${money(data.refunded_total)} refunded` : ''}
                  </Text>
                  {Number(data.gross_total) > 0 ? (
                    <View style={{ flexDirection: 'row', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>Gross {money(data.gross_total)}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>Card fees −{money(data.stripe_fees)}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>Preppa fee −{money(data.platform_fees)}</Text>
                    </View>
                  ) : null}
                </View>
              </MotiView>

              {/* Week / month */}
              <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <MiniStat label="This week" value={money(data.net_week)} Icon={TrendingUp} color={ORANGE} />
                  <MiniStat label="This month" value={money(data.net_month)} Icon={Wallet} color="#a78bfa" />
                </View>
              </MotiView>

              {/* Payout setup */}
              <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
                <PayoutSetupCard />
                <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-payouts' as never); }}
                  accessibilityRole="button" accessibilityLabel="Go to payouts"
                  style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                    backgroundColor: CARD, borderRadius: 14, height: 46 }}>
                  <ArrowDownToLine size={16} color={ORANGE} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>Request payout</Text>
                </PressableScale>
              </MotiView>

              {/* Prepper insights */}
              <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
                <View style={{ backgroundColor: CARD, borderRadius: 18, padding: 16, gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Lightbulb size={16} color={ORANGE} />
                    <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: '#fff' }}>prepper insights</Text>
                  </View>
                  {[
                    data.net_week < 50
                      ? { tip: 'List meals available Fri–Sun 11am–7pm — weekend lunch & dinner are peak demand windows.' }
                      : { tip: 'Great week! Try a weekend-only drop to capture higher-intent customers.' },
                    { tip: 'Listings with 3+ photos earn ~40% more than text-only listings — add shots of your plating.' },
                    { tip: 'Reply to preorder questions within 2 hours. Fast responses lift repeat preorder rates significantly.' },
                    data.orders_paid < 10
                      ? { tip: 'Your first 10 preorders build your review score. Offer a small first-preorder discount to accelerate them.' }
                      : { tip: 'At 10+ preorders your average rating becomes a search ranking signal — keep response time under 2 hrs.' },
                  ].map(({ tip }, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE, marginTop: 6 }} />
                      <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 12.5, color: '#cbd5e1', lineHeight: 18 }}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </MotiView>

              {/* Period selector + Recent */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Recent</Text>
                <PeriodPills value={period} onChange={setPeriod} />
              </View>

              {filteredRecent.length === 0 ? (
                <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
                  style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 10 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={22} color={MUTED} />
                  </View>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff', textAlign: 'center' }}>No paid orders yet</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 19 }}>Your first payout will show here once a customer checks out.</Text>
                  <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-hub'); }} accessibilityRole="button" accessibilityLabel="Go to kitchen hub"
                    style={{ marginTop: 4, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 11 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>kitchen hub →</Text>
                  </PressableScale>
                </MotiView>
              ) : (
                <View style={{ gap: 10 }}>
                  {filteredRecent.map((it, i) => (
                    <MotiView key={it.order_id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 240, delay: 180 + i * 50 }}>
                      <EarningRow item={it} />
                    </MotiView>
                  ))}
                </View>
              )}

              {/* Refund history */}
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Shield size={15} color={MUTED} />
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Refunds</Text>
                </View>

                {refunds.length === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 16, padding: 16, marginTop: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: GREEN + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={18} color={GREEN} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>No refunds — great work!</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>Refund requests will appear here.</Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 10, marginTop: 10 }}>
                    {refunds.map((r, i) => (
                      <MotiView key={r.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 40 }}>
                        <RefundRow item={r} />
                      </MotiView>
                    ))}
                  </View>
                )}
              </MotiView>

            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
