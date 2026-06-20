import { useRouter } from 'expo-router';
import { CheckCircle, AlertTriangle, ChefHat } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Alert, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAdvanceOrder, useCancelOrder, useTodayOrders } from '@/lib/queries/orders';

const ORANGE  = Palette.brand;
const INK     = Palette.ink;
const CARD    = Palette.surface;
const MUTED   = Palette.textSecondary;
const S1      = { shadowColor: Palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 };
const GREEN   = Palette.leafGreen;
const AMBER   = Palette.amber;
const RED     = Palette.danger;
const DIVIDER = Palette.border;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
}

function StatCell({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 22, color, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 11, color: MUTED, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

interface Props {
  prepperId: string;
  prepperUserId?: string;
}

export function PrepperTodayPanel({ prepperId, prepperUserId }: Props) {
  const router = useRouter();
  const { data, isLoading } = useTodayOrders(prepperId);
  const advanceOrder = useAdvanceOrder();
  const cancelOrder = useCancelOrder();

  function confirm(orderId: string) {
    feedback.tap();
    advanceOrder.mutate(
      { orderId, next: 'confirmed' },
      { onSuccess: () => feedback.success(), onError: () => feedback.error() },
    );
  }

  function decline(orderId: string, customerName: string) {
    feedback.tap();
    Alert.alert(
      'Decline order?',
      'The customer will be notified and refunded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            cancelOrder.mutate(
              { orderId, prepperUserId: prepperUserId ?? '', customerName },
              { onSuccess: () => feedback.success(), onError: () => feedback.error() },
            );
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={{ gap: 8 }}>
        <Skeleton height={80} radius={14} />
        <Skeleton height={100} radius={14} />
      </View>
    );
  }

  if (!data) return null;

  const { totalOrders, pendingOrders, preparingOrders, completedOrders, todayRevenue, urgentOrders } = data;
  const pendingList = urgentOrders.filter(o => o.status === 'pending');
  const preparingList = urgentOrders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status));

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginBottom: 12 }}>today</Text>

      {/* Stats row */}
      <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, padding: 16, marginBottom: 12, ...S1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <StatCell value={`$${todayRevenue.toFixed(0)}`} label="earned" color={ORANGE} />
          <View style={{ width: 1, height: 36, backgroundColor: DIVIDER }} />
          <StatCell value={totalOrders.toString()} label="orders" color={INK} />
          <View style={{ width: 1, height: 36, backgroundColor: DIVIDER }} />
          <StatCell value={completedOrders.toString()} label="completed" color={GREEN} />
        </View>
      </View>

      {/* Pending confirmation section */}
      {pendingList.length > 0 && (
        <View style={{ marginBottom: 12, gap: 8 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: AMBER + '18', borderRadius: Radius.md,
            paddingHorizontal: 12, paddingVertical: 10,
            borderWidth: 1, borderColor: AMBER + '40',
          }}>
            <AlertTriangle size={15} color={AMBER} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: AMBER }}>
              {pendingList.length} order{pendingList.length === 1 ? '' : 's'} need{pendingList.length === 1 ? 's' : ''} confirmation
            </Text>
          </View>

          {pendingList.map(order => (
            <View key={order.id} style={{
              backgroundColor: CARD, borderRadius: Radius.lg,
              padding: 14, gap: 10,
              borderWidth: 1, borderColor: AMBER + '30', ...S1,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Avatar name={order.customerName} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{order.customerName}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED, marginTop: 2 }} numberOfLines={2}>
                    {order.mealTitles.length > 0 ? order.mealTitles.join(', ') : 'No items'}
                  </Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 4 }}>
                    ${(order.total ?? 0).toFixed(2)}  •  placed {timeAgo(order.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <PressableScale
                  onPress={() => confirm(order.id)}
                  disabled={advanceOrder.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm order"
                  style={{
                    flex: 1, paddingVertical: 9, borderRadius: Radius.pill,
                    backgroundColor: GREEN + '22', borderWidth: 1, borderColor: GREEN + '55',
                    alignItems: 'center',
                    opacity: advanceOrder.isPending ? 0.55 : 1,
                  }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: GREEN }}>
                    {advanceOrder.isPending ? 'Confirming…' : 'Confirm'}
                  </Text>
                </PressableScale>

                <PressableScale
                  onPress={() => { feedback.tap(); router.push(`/order-status?id=${order.id}` as any); }}
                  accessibilityRole="button"
                  accessibilityLabel="View order"
                  style={{
                    paddingVertical: 9, paddingHorizontal: 16, borderRadius: Radius.pill,
                    backgroundColor: CARD, borderWidth: 1, borderColor: DIVIDER,
                    alignItems: 'center',
                  }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: MUTED }}>View</Text>
                </PressableScale>

                <PressableScale
                  onPress={() => decline(order.id, order.customerName)}
                  disabled={cancelOrder.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Decline order"
                  style={{
                    paddingVertical: 9, paddingHorizontal: 16, borderRadius: Radius.pill,
                    borderWidth: 1, borderColor: RED + '55',
                    alignItems: 'center',
                    opacity: cancelOrder.isPending ? 0.55 : 1,
                  }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: RED }}>
                    {cancelOrder.isPending ? 'Declining…' : 'Decline'}
                  </Text>
                </PressableScale>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Preparing section */}
      {preparingList.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <View style={{ height: 1, backgroundColor: DIVIDER, marginBottom: 12 }} />
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/prepper-orders'); }}
            accessibilityRole="button"
            accessibilityLabel={`${preparingList.length} order being prepared`}
            style={{
              backgroundColor: CARD, borderRadius: Radius.lg,
              padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...S1,
            }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={17} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>
                {preparingList.length} order{preparingList.length === 1 ? '' : 's'} in progress
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 1 }}>Tap to view details</Text>
            </View>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>View all</Text>
          </PressableScale>
        </View>
      )}

      {/* All caught up state */}
      {pendingOrders === 0 && preparingOrders === 0 && (
        <View style={{ marginBottom: 12 }}>
          <View style={{ height: 1, backgroundColor: DIVIDER, marginBottom: 12 }} />
          <View style={{
            backgroundColor: GREEN + '12', borderRadius: Radius.md,
            paddingHorizontal: 14, paddingVertical: 12,
            flexDirection: 'row', alignItems: 'center', gap: 10,
            borderWidth: 1, borderColor: GREEN + '30',
          }}>
            <CheckCircle size={16} color={GREEN} />
            <View>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: GREEN }}>All caught up</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 1 }}>No pending orders</Text>
            </View>
          </View>
        </View>
      )}
    </MotiView>
  );
}
