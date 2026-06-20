import { useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronUp, Crown, Repeat, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { usePrepperMembership } from '@/lib/queries/memberships';
import { usePrepperOrders, type OrderSummary } from '@/lib/queries/orders';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const CARD   = '#FFFFFF';
const BG     = '#F8F6F3';
const INK    = '#1A1714';
const SUB    = '#78716C';
const BORDER = '#EDE9E4';
const money  = (n: number) => `$${n.toFixed(2)}`;

type CustomerOrder = { id: string; title: string; itemCount: number; total: number; status: string; created_at: string };
type CustomerRow = {
  id: string;
  name: string;
  orders: number;
  paidTotal: number;
  lastOrder: string;
  recent: CustomerOrder[];
};

function aggregate(orders: OrderSummary[]): CustomerRow[] {
  const map = new Map<string, CustomerRow>();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const row = map.get(o.customerId) ?? { id: o.customerId, name: o.customer, orders: 0, paidTotal: 0, lastOrder: o.created_at, recent: [] };
    row.orders += 1;
    if (o.paymentStatus === 'succeeded') row.paidTotal += o.total;
    if (o.created_at > row.lastOrder) row.lastOrder = o.created_at;
    row.recent.push({
      id: o.id,
      title: o.items[0]?.title ?? 'Preorder',
      itemCount: o.items.length,
      total: o.total,
      status: o.status,
      created_at: o.created_at,
    });
    map.set(o.customerId, row);
  }
  const rows = [...map.values()];
  for (const r of rows) r.recent.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return rows.sort((a, b) => b.paidTotal - a.paidTotal || b.orders - a.orders);
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function CustomersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const prepperId = prepper?.id;
  const { data: prepperMembership } = usePrepperMembership(prepperId);
  const isPro = prepperMembership?.isPro === true;
  const { data: orders, isLoading, isError, refetch } = usePrepperOrders(prepperId);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const [sortBy, setSortBy] = useState<'spend' | 'recent'>('spend');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const allRows = aggregate(orders ?? []);
  const rows = sortBy === 'recent'
    ? [...allRows].sort((a, b) => b.lastOrder.localeCompare(a.lastOrder))
    : allRows;
  const repeat = rows.filter((r) => r.orders >= 2).length;
  const totalEarned = rows.reduce((s, r) => s + r.paidTotal, 0);
  const avgSpend = rows.length > 0 ? totalEarned / rows.length : 0;

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }

  if (!isPro && prepperId) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
          </View>
          <MotiView from={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 16 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: Palette.amber + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={40} color={Palette.amber} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6, textAlign: 'center' }}>Customer insights is a Pro feature</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: SUB, textAlign: 'center', lineHeight: 22 }}>
              See who's ordering from your kitchen, their spend history, and repeat buyer patterns with a Go Pro subscription.
            </Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-premium'); }} accessibilityRole="button" accessibilityLabel="Upgrade to Pro"
              style={{ marginTop: 8, height: 52, paddingHorizontal: 32, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Upgrade to Pro</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6, flex: 1 }}>customers</Text>
          {rows.length > 1 ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['spend', 'recent'] as const).map((s) => (
                <PressableScale key={s} onPress={() => { feedback.tap(); setSortBy(s); }} accessibilityRole="button" accessibilityLabel={s === 'spend' ? 'Sort by top spend' : 'Sort by recent'} accessibilityState={{ selected: sortBy === s }}
                  style={{ backgroundColor: sortBy === s ? ORANGE : '#F0EDEA', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: sortBy === s ? '#fff' : SUB }}>{s === 'spend' ? 'top spend' : 'recent'}</Text>
                </PressableScale>
              ))}
            </View>
          ) : null}
        </View>

        {!prepperId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Users size={28} color={SUB} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: SUB, textAlign: 'center' }}>Approved preppers see their customer roster here.</Text>
          </View>
        ) : isLoading ? (
          <ListSkeleton count={5} />
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <Users size={28} color={SUB} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Couldn't load customers</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: SUB, textAlign: 'center', maxWidth: 280 }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading customers"
              style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : !rows.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <Users size={28} color={SUB} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>No customers yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: SUB, textAlign: 'center', maxWidth: 280 }}>Every customer who preorders from your kitchen shows up here, with their preorder history.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
              <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 14, gap: 2 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, fontVariant: ['tabular-nums'] }}>{rows.length}</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: SUB }}>customers</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 14, gap: 2 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.success, fontVariant: ['tabular-nums'] }}>{repeat}</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: SUB }}>repeat buyers</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 14, gap: 2 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: ORANGE, fontVariant: ['tabular-nums'] }}>${avgSpend.toFixed(0)}</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: SUB }}>avg spend</Text>
              </View>
            </View>
            </MotiView>

            {rows.map((c, i) => {
              const expanded = expandedId === c.id;
              return (
              <MotiView key={c.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 250, delay: 60 + i * 50 }}>
              <View style={{ backgroundColor: CARD, borderRadius: 18, overflow: 'hidden' }}>
                <PressableScale onPress={() => { feedback.tap(); setExpandedId(expanded ? null : c.id); }} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${c.name}, ${c.orders} preorder${c.orders === 1 ? '' : 's'}, ${money(c.paidTotal)}`}
                  style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={c.name} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }} numberOfLines={1}>{c.name}</Text>
                      {c.orders >= 2 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Palette.success + '22', borderRadius: Radius.pill, paddingHorizontal: 8, height: 20 }}>
                          <Repeat size={10} color={Palette.success} />
                          <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: Palette.success }}>repeat</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: SUB }}>
                      {c.orders} preorder{c.orders === 1 ? '' : 's'} · last {fmtDate(c.lastOrder)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ fontFamily: Font.display, fontSize: 16, color: INK, fontVariant: ['tabular-nums'] }}>{money(c.paidTotal)}</Text>
                    {expanded ? <ChevronUp size={15} color={SUB} /> : <ChevronDown size={15} color={SUB} />}
                  </View>
                </PressableScale>
                {expanded ? (
                  <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}
                    style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 10, gap: 10, borderTopWidth: 1, borderTopColor: BORDER }}>
                    {c.recent.slice(0, 6).map((o) => {
                      const done = o.status === 'completed';
                      return (
                        <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: done ? Palette.success : ORANGE }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }} numberOfLines={1}>
                              {o.title}{o.itemCount > 1 ? ` +${o.itemCount - 1}` : ''}
                            </Text>
                            <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: SUB }}>{fmtDate(o.created_at)} · {o.status}</Text>
                          </View>
                          <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: done ? Palette.success : SUB, fontVariant: ['tabular-nums'] }}>{money(o.total)}</Text>
                        </View>
                      );
                    })}
                    {c.recent.length > 6 ? (
                      <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: SUB, textAlign: 'center' }}>+{c.recent.length - 6} earlier preorder{c.recent.length - 6 === 1 ? '' : 's'}</Text>
                    ) : null}
                  </MotiView>
                ) : null}
              </View>
              </MotiView>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
