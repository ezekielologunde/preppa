import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarClock, ChevronLeft, Clock, CreditCard, Package, Share2, Truck, XCircle } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { statusChip, STATUS_LABEL_CUSTOMER } from '@/lib/orders/pipeline';
import { useOrder, useOrderItems, type OrderItem, type OrderSummary } from '@/lib/queries/orders';

const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const orderRef = (id: string) => `#${id.slice(-8).toUpperCase()}`;
const orderDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

function buildReceiptText(order: any) {
  return [
    `Preppa Receipt`,
    `Order from: ${order.prepper ?? 'Kitchen'}`,
    `Date: ${new Date(order.created_at).toLocaleDateString()}`,
    `Items: ${(order.items ?? []).map((i: any) => `${i.title} ×${i.quantity}`).join(', ')}`,
    `Total: ${money(order.total ?? 0)}`,
    `Status: ${order.paymentStatus ?? ''}`,
  ].join('\n');
}

function ReceiptRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
      <Text style={{ fontFamily: bold ? Font.heading : Font.body, fontSize: bold ? 16 : 14, color: bold ? Palette.brand : Palette.textSecondary }}>
        {label}
      </Text>
      <Text style={{ fontFamily: bold ? Font.display : Font.semibold, fontSize: bold ? 18 : 14, color: bold ? Palette.brand : Palette.ink, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: Palette.border, marginVertical: 10 }} />;
}

function ItemPriceHint({ items, orderItems }: { items: OrderSummary['items']; orderItems: OrderItem[] }) {
  if (!orderItems.length) return null;
  return (
    <View style={{ gap: 2, marginTop: 8 }}>
      {orderItems.map((oi) => (
        <Text key={oi.id} style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
          {oi.title} — {oi.quantity}x @ {money(oi.unit_price)}
        </Text>
      ))}
    </View>
  );
}

export default function OrderReceiptScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, isError, refetch } = useOrder(id);
  const { data: orderItems = [] } = useOrderItems(id);

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/orders' as never);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Palette.brand} />
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <XCircle size={36} color={Palette.textSecondary} />
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>Could not load receipt</Text>
        <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry"
          style={{ height: 48, paddingHorizontal: 28, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Retry</Text>
        </PressableScale>
      </SafeAreaView>
    );
  }

  const chip = statusChip(order.status);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.6, flex: 1 }}>receipt</Text>
          <Pressable
            onPress={() => { void Share.share({ message: buildReceiptText(order) }); }}
            accessibilityRole="button"
            accessibilityLabel="Share receipt"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <Share2 size={18} color={Palette.ink} />
          </Pressable>
        </View>

        {/* Order meta card */}
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}
          style={{ backgroundColor: Palette.canvas, borderRadius: 20, padding: 16, gap: 8, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>Order {orderRef(order.id)}</Text>
            <View style={{ height: 26, borderRadius: 13, backgroundColor: chip.bg, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: chip.fg }}>{STATUS_LABEL_CUSTOMER[order.status]}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Clock size={14} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Placed {orderDate(order.created_at)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {order.fulfillment === 'delivery' ? <Truck size={14} color={Palette.textSecondary} /> : <Package size={14} color={Palette.textSecondary} />}
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
              {order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
            </Text>
          </View>
          {order.fulfillmentNote ? (
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, fontStyle: 'italic' }}>
              &ldquo;{order.fulfillmentNote}&rdquo;
            </Text>
          ) : null}
          {order.scheduled_at ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CalendarClock size={14} color={Palette.brand} />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
                Scheduled: {orderDate(order.scheduled_at)}
              </Text>
            </View>
          ) : null}
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brand }}>from {order.prepper}</Text>
        </MotiView>

        {/* Items card */}
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 40 }}
          style={{ backgroundColor: Palette.canvas, borderRadius: 20, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            your order
          </Text>
          <View style={{ gap: 10 }}>
            {order.items.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.ink }}>{item.quantity}</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 14, color: Palette.ink }} numberOfLines={2}>{item.title}</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink, fontVariant: ['tabular-nums'] }}>{money(item.total)}</Text>
              </View>
            ))}
          </View>
          {orderItems.length > 0 ? (
            <>
              <Divider />
              <ItemPriceHint items={order.items} orderItems={orderItems} />
            </>
          ) : null}
        </MotiView>

        {/* Fee breakdown card */}
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}
          style={{ backgroundColor: Palette.canvas, borderRadius: 20, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            total
          </Text>
          <ReceiptRow label="Subtotal" value={money(order.subtotal)} />
          {(order.deliveryFee ?? 0) > 0 ? <ReceiptRow label="Delivery" value={money(order.deliveryFee)} /> : null}
          {(order.tip ?? 0) > 0 ? <ReceiptRow label="Tip" value={money(order.tip)} /> : null}
          {(order.service_fee ?? 0) > 0 ? <ReceiptRow label="Service fee" value={money(order.service_fee!)} /> : null}
          <Divider />
          <ReceiptRow label="Total" value={money(order.total)} bold />
          {order.paymentStatus ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <CreditCard size={12} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
                {order.paymentStatus === 'succeeded' ? 'Paid' : order.paymentStatus}
              </Text>
            </View>
          ) : null}
        </MotiView>

        {/* Leave a review CTA */}
        {order.status === 'completed' && !order.reviewed ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
            <PressableScale
              onPress={() => {
                feedback.tap();
                router.push(`/review?orderId=${order.id}&prepperId=${order.prepperId}&mealId=${order.firstMealId ?? ''}&prepper=${encodeURIComponent(order.prepper)}` as never);
              }}
              accessibilityRole="button"
              accessibilityLabel="Leave a review"
              style={{ height: 48, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Leave a review</Text>
            </PressableScale>
          </MotiView>
        ) : null}

        {/* Report an issue */}
        <Pressable
          onPress={() => router.push(`/messages?orderId=${order?.id}` as never)}
          style={{ alignItems: 'center', paddingVertical: 8, marginTop: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Report an issue">
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>
            Report an issue
          </Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}
