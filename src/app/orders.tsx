import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check, ChevronLeft, Lock, Receipt, RotateCcw, Star, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HandoffCard } from '@/components/handoff-card';
import { StripeEmbeddedSheet } from '@/components/stripe-embedded';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useAddToCart, useEmbeddedCheckout, useRefundOrder, useStripeCheckout, type EmbeddedPay } from '@/lib/queries/cart';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { feedback } from '@/lib/feedback';
import { useCancelOrder, useMyOrders, useOrdersRealtime, type OrderSummary } from '@/lib/queries/orders';
import { useAuth } from '@/providers/auth-provider';
import type { OrderStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toFixed(2)}`;

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  completed: 'Delivered',
  cancelled: 'Cancelled',
};

function statusStyle(s: OrderStatus): { bg: string; fg: string } {
  if (s === 'completed') return { bg: Palette.success + '1A', fg: Palette.success };
  if (s === 'cancelled') return { bg: Palette.canvas, fg: Palette.textSecondary };
  return { bg: Palette.brandTint, fg: Palette.brandPressed };
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function OrderCard({ order, onCancel, onReview, onPay, onReorder, cancelling, needsPayment, paying, reordering }: { order: OrderSummary; onCancel: () => void; onReview: () => void; onPay: () => void; onReorder: () => void; cancelling: boolean; needsPayment: boolean; paying: boolean; reordering: boolean }) {
  const st = statusStyle(order.status);
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: Radius.md, padding: 14, gap: 12 }}>
      {/* Header: prepper + status pill */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }} numberOfLines={1}>{order.prepper}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1, textTransform: 'capitalize' }}>{dateLabel(order.created_at)} · {order.fulfillment === 'meetup' ? 'meet up' : order.fulfillment}</Text>
        </View>
        <View style={{ paddingHorizontal: 11, height: 26, borderRadius: Radius.pill, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: st.fg }}>{STATUS_LABEL[order.status]}</Text>
        </View>
      </View>

      {/* Line items */}
      <View style={{ gap: 8 }}>
        {order.items.map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {it.image ? <Image source={it.image} style={{ width: 40, height: 40, borderRadius: 10 }} contentFit="cover" /> : <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: Palette.canvas }} />}
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13.5, color: '#374151' }} numberOfLines={1}>{it.quantity}× {it.title}</Text>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK, fontVariant: ['tabular-nums'] }}>{money(it.total)}</Text>
          </View>
        ))}
      </View>

      {/* Pickup/meetup handoff code — shown to the customer until completed */}
      {order.handoff && (order.fulfillment === 'pickup' || order.fulfillment === 'meetup') && order.status !== 'completed' && order.status !== 'cancelled' ? (
        <HandoffCard
          pin={order.handoff.pin}
          token={order.handoff.token}
          verified={order.handoff.verified}
          label={order.fulfillment === 'pickup' ? 'Pickup code' : 'Meet-up code'}
        />
      ) : null}

      {/* Footer: total + cancel */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 11 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Total</Text>
        <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, fontVariant: ['tabular-nums'] }}>{money(order.total)}</Text>
      </View>
      {needsPayment ? (
        <View style={{ gap: 8 }}>
          <PressableScale
            onPress={onPay}
            disabled={paying}
            accessibilityRole="button"
            accessibilityLabel={`Complete payment, ${money(order.total)}`}
            style={{ height: 46, borderRadius: Radius.sm, backgroundColor: ORANGE, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', opacity: paying ? 0.7 : 1 }}>
            {paying ? <ActivityIndicator color="#fff" /> : (
              <>
                <Lock size={15} color="#fff" />
                <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: '#fff' }}>Complete payment · {money(order.total)}</Text>
              </>
            )}
          </PressableScale>
          <PressableScale
            onPress={onCancel}
            disabled={cancelling}
            accessibilityRole="button"
            accessibilityLabel="Cancel order"
            style={{ height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', opacity: cancelling ? 0.6 : 1 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textSecondary }}>Cancel order</Text>
          </PressableScale>
        </View>
      ) : order.status === 'pending' ? (
        <PressableScale
          onPress={onCancel}
          disabled={cancelling}
          accessibilityRole="button"
          accessibilityLabel="Cancel order"
          style={{ height: 42, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', opacity: cancelling ? 0.6 : 1 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textSecondary }}>Cancel order</Text>
        </PressableScale>
      ) : order.status === 'completed' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {!order.reviewed ? (
            <PressableScale
              onPress={onReview}
              accessibilityRole="button"
              accessibilityLabel="Leave a review"
              style={{ flex: 1, height: 44, borderRadius: Radius.sm, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Star size={15} color={Palette.brandPressed} fill={Palette.brandPressed} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brandPressed }}>Leave a review</Text>
            </PressableScale>
          ) : null}
          <PressableScale
            onPress={onReorder}
            disabled={reordering}
            accessibilityRole="button"
            accessibilityLabel="Reorder these meals"
            style={{ flex: 1, height: 44, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: reordering ? 0.7 : 1 }}>
            {reordering ? <ActivityIndicator color="#fff" /> : <RotateCcw size={15} color="#fff" />}
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Reorder</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: orders, isLoading } = useMyOrders(user?.id);
  useOrdersRealtime('customer_id', user?.id);
  const cancelOrder = useCancelOrder();
  const refundOrder = useRefundOrder();
  const checkoutStripe = useStripeCheckout();
  const embeddedCheckout = useEmbeddedCheckout();
  const [paySheet, setPaySheet] = useState<Extract<EmbeddedPay, { clientSecret: string }> | null>(null);
  const paymentsOn = useFeatureEnabled('payments');
  const { paid } = useLocalSearchParams<{ paid?: string }>();
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [showPaid, setShowPaid] = useState(!!paid);
  const [payingId, setPayingId] = useState<string | null>(null);
  // Reorder: refill the cart with this order's items and jump to checkout.
  const addToCart = useAddToCart();
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  async function reorder(o: OrderSummary) {
    if (!user) return;
    setActionErr(null);
    setReorderingId(o.id);
    try {
      for (let i = 0; i < o.items.length; i++) {
        const it = o.items[i];
        await addToCart.mutateAsync({
          userId: user.id,
          mealId: it.mealId,
          price: it.quantity ? it.total / it.quantity : it.total,
          quantity: it.quantity,
          replace: i === 0, // start a fresh cart so kitchens never mix
        });
      }
      feedback.success();
      router.push('/cart');
    } catch (e) {
      feedback.error();
      setActionErr(e instanceof Error ? e.message : 'Could not reorder. The meals may no longer be available.');
    } finally {
      setReorderingId(null);
    }
  }

  // Cancelling is destructive → confirm in an overlay first.
  const [confirmCancel, setConfirmCancel] = useState<OrderSummary | null>(null);

  function doCancel(o: OrderSummary) {
    setConfirmCancel(null);
    setActionErr(null);
    cancelOrder.mutate(o.id, {
      onSuccess: () => refundOrder.mutate(o.id),
      onError: (e) => { feedback.error(); setActionErr(e instanceof Error ? e.message : 'Could not cancel. Try again.'); },
    });
  }

  // Finish paying an order whose checkout was canceled/declined (the order is
  // saved but unpaid). Web pays in-app via the embedded sheet.
  async function payOrder(orderId: string) {
    setActionErr(null);
    setPayingId(orderId);
    try {
      if (Platform.OS === 'web') {
        const r = await embeddedCheckout.mutateAsync(orderId);
        setPayingId(null);
        if ('clientSecret' in r) setPaySheet(r);
        else window.location.assign(r.url);
        return;
      }
      const url = await checkoutStripe.mutateAsync(orderId);
      {
        await WebBrowser.openBrowserAsync(url);
        setPayingId(null);
      }
    } catch (e) {
      feedback.error();
      setPayingId(null);
      setActionErr(e instanceof Error ? e.message : 'Could not start payment. Try again.');
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F8' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>your orders</Text>
        </View>

        {showPaid ? (
          <PressableScale onPress={() => setShowPaid(false)} accessibilityRole="button" accessibilityLabel="Dismiss" style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: Palette.success + '14', borderWidth: 1, borderColor: Palette.success + '55', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Check size={16} color={Palette.success} strokeWidth={3} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#15803d', flex: 1 }}>Payment received — your order is in. The prepper will confirm shortly.</Text>
          </PressableScale>
        ) : null}
        {actionErr ? (
          <PressableScale onPress={() => setActionErr(null)} accessibilityRole="button" accessibilityLabel="Dismiss error" style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#b91c1c' }}>{actionErr} (tap to dismiss)</Text>
          </PressableScale>
        ) : null}

        {!user ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Receipt size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to see your orders.</Text>
            <PressableScale onPress={() => router.push('/auth?mode=signin')} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : isLoading ? (
          <ListSkeleton count={3} rowHeight={120} />
        ) : !orders?.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={28} color={Palette.textMuted} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>No orders yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>When you place an order it&apos;ll show up here.</Text>
            <PressableScale onPress={() => router.replace('/explore')} accessibilityRole="button" accessibilityLabel="Browse meals" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Browse meals</Text>
            </PressableScale>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                needsPayment={paymentsOn && o.status === 'pending' && o.paymentStatus !== 'succeeded' && o.paymentStatus !== 'refunded'}
                paying={payingId === o.id}
                onPay={() => payOrder(o.id)}
                cancelling={cancelOrder.isPending && cancelOrder.variables === o.id}
                onCancel={() => { feedback.warning(); setConfirmCancel(o); }}
                onReview={() => router.push(`/review?orderId=${o.id}&prepperId=${o.prepperId}&mealId=${o.firstMealId ?? ''}&prepper=${encodeURIComponent(o.prepper)}`)}
                onReorder={() => reorder(o)}
                reordering={reorderingId === o.id}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {paySheet ? (
        <StripeEmbeddedSheet clientSecret={paySheet.clientSecret} pk={paySheet.pk} onClose={() => setPaySheet(null)} />
      ) : null}

      {/* Cancel confirmation overlay */}
      <Modal visible={!!confirmCancel} transparent animationType="fade" onRequestClose={() => setConfirmCancel(null)}>
        <Pressable onPress={() => setConfirmCancel(null)} style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 24, padding: 22, gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
              <X size={26} color="#ef4444" strokeWidth={2.6} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>Cancel this order?</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 20 }}>
              {confirmCancel ? `Your order from ${confirmCancel.prepper} (${money(confirmCancel.total)}) will be cancelled.` : ''}
              {confirmCancel?.paymentStatus === 'succeeded' ? ' You’ll be refunded automatically.' : ''}
            </Text>
            <PressableScale onPress={() => confirmCancel && doCancel(confirmCancel)} accessibilityRole="button" accessibilityLabel="Yes, cancel the order" style={{ height: 50, borderRadius: 14, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Yes, cancel order</Text>
            </PressableScale>
            <PressableScale onPress={() => setConfirmCancel(null)} accessibilityRole="button" accessibilityLabel="Keep the order" style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>Keep my order</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
