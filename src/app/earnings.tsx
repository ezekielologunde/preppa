import { useRouter } from 'expo-router';
import { ChevronLeft, DollarSign, Lightbulb, Receipt, TrendingUp, Wallet } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';
import { Palette, Radius } from '@/constants/theme';
import { useMyEarnings, type EarningsRecent } from '@/lib/queries/earnings';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const CARD = Palette.prepperCard;
const BG = Palette.prepperBg;
const MUTED = Palette.textMuted;

const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

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

export default function EarningsScreen() {
  const router = useRouter();
  const isDesktop = useBreakpoint() === 'desktop';
  const { data, isLoading, isError, refetch } = useMyEarnings();
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6 }}>earnings</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={28} color={MUTED} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>couldn't load earnings</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center' }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading earnings"
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
            <PressableScale onPress={() => { feedback.tap(); router.push('/become-prepper'); }} accessibilityRole="button" accessibilityLabel="Become a prepper" style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Become a prepper</Text>
            </PressableScale>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />} contentContainerStyle={{ paddingBottom: 48 }}>
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

            {/* Frictionless payouts: Preppa pays the cook — no Stripe account needed */}
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
            <View style={{ backgroundColor: '#1f2937', borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Wallet size={18} color={ORANGE} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 12.5, color: '#cbd5e1', lineHeight: 18 }}>
                Preppa pays you directly — no Stripe account or setup needed. Card processing and the Preppa platform fee are calculated automatically on each preorder and already deducted from the amounts shown here.
              </Text>
            </View>
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

            {/* Recent paid orders */}
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff', marginTop: 4 }}>Recent</Text>
            {data.recent.length === 0 ? (
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: MUTED }}>No paid orders yet. They&apos;ll appear here as customers check out.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {data.recent.map((it, i) => (
                  <MotiView key={it.order_id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 240, delay: 180 + i * 50 }}>
                    <EarningRow item={it} />
                  </MotiView>
                ))}
              </View>
            )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
