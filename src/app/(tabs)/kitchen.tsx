import { useRouter } from 'expo-router';
import {
  AlertCircle, ArrowRight, ChefHat, MessageSquare, Package,
  ShoppingBag, TrendingUp, Wallet,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyEarnings } from '@/lib/queries/earnings';
import { useOrdersRealtime, usePrepperOrders } from '@/lib/queries/orders';
import { useStripeConnect } from '@/lib/queries/stripe-connect';
import { useWorkspace } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';

const money = (n: number) => `$${n.toFixed(2)}`;
const INK = Palette.ink;
const MUTED = Palette.textSecondary;
const ORANGE = Palette.brand;

export default function KitchenScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { prepperId } = useWorkspace();

  useOrdersRealtime('prepper_id', prepperId ?? undefined);

  const { data: pendingOrders, isLoading: loadingPending, refetch: refetchPending } = usePrepperOrders(prepperId ?? undefined, 'pending');
  const { data: confirmedOrders, refetch: refetchConfirmed } = usePrepperOrders(prepperId ?? undefined, 'confirmed');
  const { data: earnings, refetch: refetchEarnings } = useMyEarnings();
  const { data: stripeConnect } = useStripeConnect();

  const pendingCount = pendingOrders?.length ?? 0;
  const activeCount = confirmedOrders?.length ?? 0;

  const totalItemsToday = [
    ...(pendingOrders ?? []),
    ...(confirmedOrders ?? []),
  ].reduce((sum, o) => sum + (o.item_count ?? 1), 0);

  const payoutReady = (earnings?.net_total ?? 0) - 0;
  const stripeActive = stripeConnect?.stripe_account_status === 'active';

  async function handleRefresh() {
    await Promise.all([refetchPending(), refetchConfirmed(), refetchEarnings()]);
  }

  const go = (route: string) => { feedback.tap(); router.push(route as never); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={ORANGE} />}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 8 }}>
            <ChefHat size={20} color={ORANGE} strokeWidth={2} />
            <Text style={{ fontFamily: Font.heading, fontSize: 20, color: INK, letterSpacing: -0.4, flex: 1 }}>My Kitchen</Text>
            <PressableScale onPress={() => go('/kitchen-settings')} accessibilityRole="button" accessibilityLabel="Kitchen settings"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <Package size={16} color={MUTED} />
            </PressableScale>
          </View>
        </MotiView>

        {loadingPending ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <ListSkeleton count={3} />
          </View>
        ) : (
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', damping: 22, stiffness: 200, delay: 60 }}>

            {/* Needs attention */}
            {pendingCount > 0 && (
              <PressableScale onPress={() => go('/prepper-orders')} accessibilityRole="button"
                style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: ORANGE + '12', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: ORANGE + '28', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={18} color={ORANGE} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>
                    {pendingCount} order{pendingCount !== 1 ? 's' : ''} need confirmation
                  </Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 2 }}>Tap to review and accept</Text>
                </View>
                <ArrowRight size={16} color={ORANGE} />
              </PressableScale>
            )}

            {/* Today's queue */}
            <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: Palette.surface, borderRadius: 16, padding: 16, ...Shadow.card, gap: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: MUTED, letterSpacing: 0.4, textTransform: 'uppercase' }}>Today</Text>

              <Row
                icon={<ShoppingBag size={16} color={ORANGE} />}
                label={`${pendingCount + activeCount} active order${pendingCount + activeCount !== 1 ? 's' : ''}`}
                sub={totalItemsToday > 0 ? `${totalItemsToday} items to prep` : 'Nothing in queue'}
                onPress={() => go('/prepper-orders')}
              />

              <Divider />

              <Row
                icon={<TrendingUp size={16} color={Palette.success} />}
                label={`${money(earnings?.net_week ?? 0)} this week`}
                sub={`${money(earnings?.net_total ?? 0)} lifetime`}
                onPress={() => go('/earnings')}
              />

              {stripeActive ? (
                <>
                  <Divider />
                  <Row
                    icon={<Wallet size={16} color={Palette.success} />}
                    label="Payouts active"
                    sub="Stripe connected"
                    onPress={() => go('/prepper-payouts')}
                  />
                </>
              ) : (
                <>
                  <Divider />
                  <Row
                    icon={<Wallet size={16} color={MUTED} />}
                    label="Set up payouts"
                    sub="Connect your bank account"
                    onPress={() => go('/prepper-payouts')}
                    muted
                  />
                </>
              )}
            </View>

            {/* Quick access */}
            <View style={{ marginHorizontal: 16, marginTop: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: MUTED, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>Quick Access</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <QuickTile label="Menu" icon={<ChefHat size={20} color={ORANGE} />} onPress={() => go('/meal-editor')} />
                <QuickTile label="Analytics" icon={<TrendingUp size={20} color={ORANGE} />} onPress={() => go('/prepper-analytics')} />
                <QuickTile label="Messages" icon={<MessageSquare size={20} color={ORANGE} />} onPress={() => go('/messages')} />
                <QuickTile label="Schedule" icon={<Package size={20} color={ORANGE} />} onPress={() => go('/prepper-schedule')} />
              </View>
            </View>

          </MotiView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon, label, sub, onPress, muted,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: muted ? MUTED : INK }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <ArrowRight size={14} color={MUTED} />
    </PressableScale>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: Palette.border }} />;
}

function QuickTile({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6, ...Shadow.card }}>
      {icon}
      <Text style={{ fontFamily: Font.medium, fontSize: 11, color: MUTED }}>{label}</Text>
    </PressableScale>
  );
}
