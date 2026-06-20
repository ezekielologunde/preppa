import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  MessageCircle,
  RotateCcw,
  Star,
  X,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HandoffCard } from '@/components/handoff-card';
import { money } from '@/components/order-card';
import { DeliveryEtaBanner, OrderTimeline } from '@/components/order-timeline';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { FULFILLMENT_LABEL, statusChip, STATUS_LABEL_CUSTOMER } from '@/lib/orders/pipeline';
import { useStartConversation } from '@/lib/queries/messages';
import {
  useCancelOrder,
  useOrder,
  useReportDispute,
} from '@/lib/queries/orders';
import { useAddToCart } from '@/lib/queries/cart';
import { useAuth } from '@/providers/auth-provider';

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{ fontFamily: Font.display, fontSize: 13, color: Palette.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
      {title}
    </Text>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const { data: order, isLoading, isError } = useOrder(id);

  const cancelOrder = useCancelOrder();
  const reportDispute = useReportDispute();
  const startConversation = useStartConversation();
  const addToCart = useAddToCart();

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportErr, setReportErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/orders');
  }

  async function handleChat() {
    if (!order?.prepperUserId) { router.push(`/prepper?id=${order?.prepperId}`); return; }
    feedback.tap();
    try {
      const convId = await startConversation.mutateAsync(order.prepperUserId);
      router.push(`/chat?id=${convId}&name=${encodeURIComponent(order.prepper)}`);
    } catch {
      feedback.error();
      setActionErr('Could not open chat. Try again.');
    }
  }

  function handleCancel() {
    if (!order) return;
    setConfirmCancel(false);
    setActionErr(null);
    cancelOrder.mutate(
      { orderId: order.id, prepperUserId: order.prepperUserId, customerName: order.customer },
      {
        onSuccess: () => { feedback.success(); router.back(); },
        onError: (e) => { feedback.error(); setActionErr(e instanceof Error ? e.message : 'Could not cancel. Try again.'); },
      },
    );
  }

  function submitReport() {
    const reason = reportReason.trim();
    if (reason.length < 5) { setReportErr('Please describe the issue (at least 5 characters).'); return; }
    if (reason.length > 1000) { setReportErr('Keep it under 1000 characters.'); return; }
    if (!order || !user) return;
    feedback.tap();
    setReportErr(null);
    reportDispute.mutate(
      { orderId: order.id, reason },
      {
        onSuccess: () => { feedback.success(); setReportModal(false); setReportReason(''); },
        onError: (e) => { feedback.error(); setReportErr(e instanceof Error ? e.message : 'Could not submit. Try again.'); },
      },
    );
  }

  async function handleReorder() {
    if (!order || !user) return;
    feedback.tap();
    setActionErr(null);
    setReordering(true);
    try {
      for (let i = 0; i < order.items.length; i++) {
        const it = order.items[i];
        await addToCart.mutateAsync({ userId: user.id, mealId: it.mealId, price: it.quantity ? it.total / it.quantity : it.total, quantity: it.quantity, replace: i === 0 });
      }
      feedback.success();
      router.push('/cart');
    } catch (e) {
      feedback.error();
      setActionErr(e instanceof Error ? e.message : 'Could not reorder. Meals may be unavailable.');
    } finally {
      setReordering(false);
    }
  }

  // ── loading / error ───────────────────────────────────────────────────────
  if (isLoading || !order) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={Palette.ink} />
            </PressableScale>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.6 }}>preorder</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {isError
              ? <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>Could not load this preorder.</Text>
              : <ActivityIndicator color={Palette.brand} />}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const st = statusChip(order.status);
  const orderNum = order.id.slice(-8).toUpperCase();
  const isPickup = order.fulfillment === 'pickup' || order.fulfillment === 'meetup' || order.fulfillment === 'home_cook';
  const showHandoff = !!(order.handoff && isPickup && order.status !== 'completed' && order.status !== 'cancelled');
  const isActive = ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);

  // Cancellation is allowed within 30 minutes of placing the order, but only
  // while the prepper hasn't started preparing yet (pending or confirmed).
  const canCancel = (order.status === 'pending' || order.status === 'confirmed') &&
    Date.now() - new Date(order.created_at).getTime() < 30 * 60 * 1000;
  const cancelWindowClosed = (order.status === 'pending' || order.status === 'confirmed') && !canCancel;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.6 }}>preorder</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, fontVariant: ['tabular-nums'] }}>#{orderNum}</Text>
          </View>
          <View style={{ paddingHorizontal: 12, height: 28, borderRadius: Radius.pill, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: st.fg }}>{STATUS_LABEL_CUSTOMER[order.status]}</Text>
          </View>
        </View>

        {actionErr ? (
          <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}>
            <PressableScale onPress={() => { feedback.tap(); setActionErr(null); }} accessibilityRole="button" accessibilityLabel="Dismiss error"
              style={{ marginHorizontal: 16, marginBottom: 6, backgroundColor: Palette.danger + '14', borderWidth: 1, borderColor: Palette.danger + '40', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger }}>{actionErr} (tap to dismiss)</Text>
            </PressableScale>
          </MotiView>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}>

          {/* ── prepper card ── */}
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, gap: 10 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push(`/prepper?id=${order.prepperId}`); }}
              accessibilityRole="button" accessibilityLabel={`View ${order.prepper}'s kitchen`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>🍳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }} numberOfLines={1}>{order.prepper}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>
                  {new Date(order.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' · '}
                  {FULFILLMENT_LABEL[order.fulfillment]}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, height: 24, borderRadius: Radius.pill, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.inkSoft }}>{FULFILLMENT_LABEL[order.fulfillment]}</Text>
              </View>
            </PressableScale>
            {order.scheduled_at ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Palette.brandTint, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 8 }}>
                <CalendarClock size={13} color={Palette.brand} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.brandPressed }}>
                  {'Scheduled for '}
                  {new Date(order.scheduled_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── timeline ── */}
          {order.status !== 'cancelled' ? (
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16 }}>
              <SectionHeader title="Status" />
              <View style={{ backgroundColor: Palette.canvas, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10 }}>
                <OrderTimeline status={order.status} />
              </View>
            </View>
          ) : null}

          {/* ── delivery ETA ── */}
          {order.status === 'out_for_delivery' && order.fulfillment === 'delivery' ? <DeliveryEtaBanner /> : null}

          {/* ── handoff QR ── */}
          {showHandoff ? (
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16 }}>
              <SectionHeader title="Pickup code" />
              <HandoffCard
                pin={order.handoff!.pin}
                token={order.handoff!.token}
                verified={order.handoff!.verified}
                label={order.fulfillment === 'pickup' ? 'Pickup code' : order.fulfillment === 'home_cook' ? 'Home cook code' : 'Meet-up code'}
              />
            </View>
          ) : null}

          {/* ── items ── */}
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, gap: 10 }}>
            <SectionHeader title="Items" />
            {order.items.map((it) => (
              <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {it.image
                  ? <Image source={it.image} style={{ width: 48, height: 48, borderRadius: 12 }} contentFit="cover" accessibilityLabel={it.title} />
                  : <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: Palette.canvas }} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }} numberOfLines={1}>{it.title}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>Qty {it.quantity}</Text>
                </View>
                <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.ink, fontVariant: ['tabular-nums'] }}>{money(it.total)}</Text>
              </View>
            ))}
          </View>

          {/* ── receipt ── */}
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, gap: 8 }}>
            <SectionHeader title="Receipt" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }}>Subtotal</Text>
              <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.inkSoft, fontVariant: ['tabular-nums'] }}>{money(order.subtotal)}</Text>
            </View>
            {order.service_fee != null && order.service_fee > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }}>Platform fee</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.inkSoft, fontVariant: ['tabular-nums'] }}>{money(order.service_fee)}</Text>
              </View>
            ) : null}
            {order.fulfillment === 'delivery' && order.deliveryFee > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }}>Delivery fee</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.inkSoft, fontVariant: ['tabular-nums'] }}>{money(order.deliveryFee)}</Text>
              </View>
            ) : null}
            <View style={{ height: 1, backgroundColor: Palette.chip, marginVertical: 4 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }}>Total</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, fontVariant: ['tabular-nums'] }}>{money(order.total)}</Text>
            </View>
            {order.paymentStatus ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>Payment</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: order.paymentStatus === 'succeeded' ? Palette.success : Palette.textSecondary, textTransform: 'capitalize' }}>
                  {order.paymentStatus === 'succeeded' ? 'Paid' : order.paymentStatus}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── action buttons ── */}
          <View style={{ gap: 10 }}>
            {isActive ? (
              <PressableScale onPress={handleChat} accessibilityRole="button" accessibilityLabel="Message kitchen"
                style={{ height: 48, borderRadius: Radius.sm, backgroundColor: Palette.brandTint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <MessageCircle size={16} color={Palette.brand} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 14.5, color: Palette.brand }}>Message kitchen</Text>
              </PressableScale>
            ) : null}
            {canCancel ? (
              <PressableScale onPress={() => { feedback.warning(); setConfirmCancel(true); }} disabled={cancelOrder.isPending}
                accessibilityRole="button" accessibilityLabel="Cancel preorder"
                style={{ height: 46, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', opacity: cancelOrder.isPending ? 0.6 : 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textSecondary }}>Cancel preorder</Text>
              </PressableScale>
            ) : cancelWindowClosed ? (
              <View style={{ height: 46, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textSecondary }}>Cancellation window closed</Text>
              </View>
            ) : null}
            {order.status === 'completed' ? (
              <View style={{ gap: 10 }}>
                {!order.reviewed ? (
                  <PressableScale
                    onPress={() => { feedback.tap(); router.push(`/review?orderId=${order.id}&prepperId=${order.prepperId}&mealId=${order.firstMealId ?? ''}&prepper=${encodeURIComponent(order.prepper)}`); }}
                    accessibilityRole="button" accessibilityLabel="Leave a review"
                    style={{ height: 48, borderRadius: Radius.sm, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }}>
                    <Star size={15} color={Palette.brandPressed} fill={Palette.brandPressed} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14.5, color: Palette.brandPressed }}>Leave a review</Text>
                  </PressableScale>
                ) : null}
                <Button title="Preorder again" Icon={RotateCcw} variant="primary" size="md" loading={reordering} onPress={handleReorder} accessibilityLabel="Preorder these meals again" />
              </View>
            ) : null}
            {(order.status === 'completed' || order.status === 'cancelled') ? (
              order.disputed ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
                  <AlertTriangle size={13} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>Issue reported — we&apos;re looking into it.</Text>
                </View>
              ) : (
                <PressableScale onPress={() => { feedback.tap(); setReportReason(''); setReportErr(null); setReportModal(true); }}
                  accessibilityRole="button" accessibilityLabel="Report an issue"
                  style={{ height: 42, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <AlertTriangle size={13} color={Palette.textSecondary} />
                  <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.textSecondary }}>Report an issue</Text>
                </PressableScale>
              )
            ) : null}
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* ── cancel modal ── */}
      <Modal visible={confirmCancel} transparent animationType="fade" onRequestClose={() => setConfirmCancel(false)}>
        <Pressable onPress={() => setConfirmCancel(false)} accessibilityRole="button" accessibilityLabel="Keep my preorder"
          style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} accessible={false}
            style={{ width: '100%', maxWidth: 360, backgroundColor: Palette.surface, borderRadius: 24, padding: 22, gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Palette.danger + '1A', alignItems: 'center', justifyContent: 'center' }}>
              <X size={26} color={Palette.danger} strokeWidth={2.6} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 21, color: Palette.ink, letterSpacing: -0.4 }}>Cancel this preorder?</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 20 }}>
              {`Your preorder from ${order.prepper} (${money(order.total)}) will be cancelled.`}
              {order.paymentStatus === 'succeeded' ? " You'll be refunded automatically." : ''}
            </Text>
            <PressableScale onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Yes, cancel the preorder"
              style={{ height: 50, borderRadius: 14, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Yes, cancel preorder</Text>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); setConfirmCancel(false); }} accessibilityRole="button" accessibilityLabel="Keep my preorder"
              style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>Keep my preorder</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── report modal ── */}
      <Modal visible={reportModal} transparent animationType="fade" onRequestClose={() => setReportModal(false)}>
        <Pressable onPress={() => setReportModal(false)} accessibilityRole="button" accessibilityLabel="Close report form"
          style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} accessible={false}
            style={{ width: '100%', maxWidth: 360, backgroundColor: Palette.surface, borderRadius: 24, padding: 22, gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={26} color={Palette.textSecondary} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 21, color: Palette.ink, letterSpacing: -0.4 }}>Report an issue</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20 }}>
              {`Tell us what went wrong with your preorder from ${order.prepper}. Our team will review it.`}
            </Text>
            <TextInput value={reportReason} onChangeText={setReportReason} placeholder="Describe the issue…" placeholderTextColor={Palette.textSecondary}
              multiline maxLength={1000} accessibilityLabel="Describe the issue"
              style={{ minHeight: 100, backgroundColor: Palette.canvas, borderRadius: 12, borderWidth: 1, borderColor: Palette.border, padding: 12, fontFamily: Font.body, fontSize: 14, color: Palette.ink, textAlignVertical: 'top' }} />
            {reportErr ? <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger }}>{reportErr}</Text> : null}
            <PressableScale onPress={submitReport} disabled={reportDispute.isPending} accessibilityRole="button" accessibilityLabel="Submit report"
              style={{ height: 50, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', opacity: reportDispute.isPending ? 0.7 : 1 }}>
              {reportDispute.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Submit report</Text>}
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); setReportModal(false); }} accessibilityRole="button" accessibilityLabel="Cancel"
              style={{ height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>Cancel</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
