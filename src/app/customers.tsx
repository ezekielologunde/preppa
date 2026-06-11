import { useRouter } from 'expo-router';
import { ChevronLeft, Repeat, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { usePrepperOrders } from '@/lib/queries/orders';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const CARD = Palette.prepperCard;
const BG = Palette.prepperBg;
const money = (n: number) => `$${n.toFixed(2)}`;

type CustomerRow = {
  id: string;
  name: string;
  orders: number;
  paidTotal: number;
  lastOrder: string;
};

/** Group the prepper's own orders (RLS-scoped) into a customer roster. */
function aggregate(orders: { customerId: string; customer: string; total: number; status: string; paymentStatus: string | null; created_at: string }[]): CustomerRow[] {
  const map = new Map<string, CustomerRow>();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const row = map.get(o.customerId) ?? { id: o.customerId, name: o.customer, orders: 0, paidTotal: 0, lastOrder: o.created_at };
    row.orders += 1;
    if (o.paymentStatus === 'succeeded') row.paidTotal += o.total;
    if (o.created_at > row.lastOrder) row.lastOrder = o.created_at;
    map.set(o.customerId, row);
  }
  return [...map.values()].sort((a, b) => b.paidTotal - a.paidTotal || b.orders - a.orders);
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function CustomersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const prepperId = prepper?.id;
  const { data: orders, isLoading, refetch } = usePrepperOrders(prepperId);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const rows = aggregate(orders ?? []);
  const repeat = rows.filter((r) => r.orders >= 2).length;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6 }}>customers</Text>
        </View>

        {!prepperId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Users size={28} color="#5b6170" />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>Approved preppers see their customer roster here.</Text>
          </View>
        ) : isLoading ? (
          <ListSkeleton count={5} />
        ) : !rows.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <Users size={28} color="#5b6170" />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>No customers yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center', maxWidth: 280 }}>Every customer who orders from your kitchen shows up here, with their order history.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
              <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 14, gap: 2 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', fontVariant: ['tabular-nums'] }}>{rows.length}</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textMuted }}>customers</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 14, gap: 2 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.success, fontVariant: ['tabular-nums'] }}>{repeat}</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textMuted }}>repeat buyers</Text>
              </View>
            </View>
            </MotiView>

            {rows.map((c, i) => (
              <MotiView key={c.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 250, delay: 60 + i * 50 }}>
              <View style={{ backgroundColor: CARD, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={c.name} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: '#fff' }} numberOfLines={1}>{c.name}</Text>
                    {c.orders >= 2 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Palette.success + '22', borderRadius: 999, paddingHorizontal: 8, height: 20 }}>
                        <Repeat size={10} color={Palette.success} />
                        <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: Palette.success }}>repeat</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted }}>
                    {c.orders} order{c.orders === 1 ? '' : 's'} · last {fmtDate(c.lastOrder)}
                  </Text>
                </View>
                <Text style={{ fontFamily: Font.display, fontSize: 16, color: '#fff', fontVariant: ['tabular-nums'] }}>{money(c.paidTotal)}</Text>
              </View>
              </MotiView>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
