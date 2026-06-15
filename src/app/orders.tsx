import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertTriangle, Check, ChevronLeft, Receipt, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrderCard, money } from '@/components/order-card';
import { StripeEmbeddedSheet } from '@/components/stripe-embedded';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useAddToCart, useEmbeddedCheckout, useRefundOrder, useStripeCheckout, type EmbeddedPay } from '@/lib/queries/cart';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { feedback } from '@/lib/feedback';
import { useStartConversation } from '@/lib/queries/messages';
import { useCancelOrder, useMyOrders, useOrdersRealtime, useReportDispute, type OrderSummary } from '@/lib/queries/orders';
import { BP } from '@/lib/layout';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const twoCol = Platform.OS === 'web' && width >= BP.desktop;
  const { data: orders, isLoading, refetch } = useMyOrders(user?.id);
  useOrdersRealtime('customer_id', user?.id);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }
  const cancelOrder = useCancelOrder();
  const refundOrder = useRefundOrder();
  const reportDispute = useReportDispute();
  const startConversation = useStartConversation();
  const [reportModal, setReportModal] = useState<OrderSummary | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportErr, setReportErr] = useState<string | null>(null);

  function submitReport() {
    const reason = reportReason.trim();
    if (reason.length < 5) { setReportErr('Please describe the issue (at least 5 characters).'); return; }
    if (reason.length > 1000) { setReportErr('Keep it under 1000 characters.'); return; }
    feedback.tap();
    setReportErr(null);
    reportDispute.mutate(
      { orderId: reportModal!.id, reason, reporterId: user!.id },
      {
        onSuccess: () => { feedback.success(); setReportModal(null); setReportReason(''); },
        onError: (e) => { feedback.error(); setReportErr(e instanceof Error ? e.message : 'Could not submit. Try again.'); },
      },
    );
  }

  const checkoutStripe = useStripeCheckout();
  const embeddedCheckout = useEmbeddedCheckout();
  const [paySheet, setPaySheet] = useState<Extract<EmbeddedPay, { clientSecret: string }> | null>(null);
  const paymentsOn = useFeatureEnabled('payments');
  const { paid } = useLocalSearchParams<{ paid?: string }>();
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [showPaid, setShowPaid] = useState(!!paid);
  const [payingId, setPayingId] = useState<string | null>(null);
  const addToCart = useAddToCart();
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  async function reorder(o: OrderSummary) {
    if (!user) return;
    feedback.tap();
    setActionErr(null);
    setReorderingId(o.id);
    try {
      for (let i = 0; i < o.items.length; i++) {
        const it = o.items[i];
        await addToCart.mutateAsync({
          userId: user.id, mealId: it.mealId,
          price: it.quantity ? it.total / it.quantity : it.total,
          quantity: it.quantity,
          replace: i === 0,
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

  const [confirmCancel, setConfirmCancel] = useState<OrderSummary | null>(null);

  function doCancel(o: OrderSummary) {
    setConfirmCancel(null);
    setActionErr(null);
    cancelOrder.mutate(o.id, {
      onSuccess: () => refundOrder.mutate(o.id, {
        onError: () => { feedback.error(); setActionErr('Preorder cancelled but refund failed — contact support if needed.'); },
      }),
      onError: (e) => { feedback.error(); setActionErr(e instanceof Error ? e.message : 'Could not cancel. Try again.'); },
    });
  }

  async function payOrder(orderId: string) {
    feedback.tap();
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
      await WebBrowser.openBrowserAsync(url);
      setPayingId(null);
    } catch (e) {
      feedback.error();
      setPayingId(null);
      setActionErr(e instanceof Error ? e.message : 'Could not start payment. Try again.');
    }
  }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>your preorders</Text>
        </View>

        {showPaid ? (
          <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}>
            <PressableScale onPress={() => { feedback.tap(); setShowPaid(false); }} accessibilityRole="button" accessibilityLabel="Dismiss"
              style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: Palette.success + '14', borderWidth: 1, borderColor: Palette.success + '55', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Check size={16} color={Palette.success} strokeWidth={3} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.ink, flex: 1 }}>Payment received — your preorder is in. The prepper will confirm shortly.</Text>
            </PressableScale>
          </MotiView>
        ) : null}

        {actionErr ? (
          <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}>
            <PressableScale onPress={() => { feedback.tap(); setActionErr(null); }} accessibilityRole="button" accessibilityLabel="Dismiss error"
              style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: Palette.danger + '14', borderWidth: 1, borderColor: Palette.danger + '40', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger }}>{actionErr} (tap to dismiss)</Text>
            </PressableScale>
          </MotiView>
        ) : null}

        {!user ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Receipt size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to see your preorders.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/auth?mode=signin'); }} accessibilityRole="button" accessibilityLabel="Sign in"
              style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : isLoading ? (
          <ListSkeleton count={3} rowHeight={120} />
        ) : !orders?.length ? (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={28} color={Palette.textMuted} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>No preorders yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>When you preorder a meal it&apos;ll show up here.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.replace('/explore'); }} accessibilityRole="button" accessibilityLabel="Browse meals"
              style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Browse meals</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
            contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
            {(() => {
              const done = orders.filter((o) => o.status === 'completed');
              if (!done.length) return null;
              const spent = done.reduce((s, o) => s + o.total, 0);
              const freqs: Record<string, number> = {};
              done.forEach((o) => { freqs[o.prepper] = (freqs[o.prepper] ?? 0) + 1; });
              const fav = Object.entries(freqs).sort((a, b) => b[1] - a[1])[0]?.[0];
              const stats = [
                { label: 'completed', value: done.length.toString() },
                { label: 'total spent', value: `$${spent.toFixed(0)}` },
                ...(fav ? [{ label: 'top kitchen', value: fav.split(' ')[0] }] : []),
              ];
              return (
                <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}
                  style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                  {stats.map(({ label, value }) => (
                    <View key={label} style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, fontVariant: ['tabular-nums'] }}>{value}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted, textAlign: 'center' }}>{label}</Text>
                    </View>
                  ))}
                </MotiView>
              );
            })()}
            <View style={twoCol ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } : { gap: 12 }}>
              {orders.map((o, i) => (
                <MotiView key={o.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 220, delay: i * 50 }}
                  style={twoCol ? { width: '48.5%' } : undefined}>
                  <OrderCard
                    order={o}
                    needsPayment={paymentsOn && o.status === 'pending' && o.paymentStatus !== 'succeeded' && o.paymentStatus !== 'refunded'}
                    paying={payingId === o.id}
                    onPay={() => payOrder(o.id)}
                    cancelling={cancelOrder.isPending && cancelOrder.variables === o.id}
                    onCancel={() => { feedback.warning(); setConfirmCancel(o); }}
                    onReview={() => { feedback.tap(); router.push(`/review?orderId=${o.id}&prepperId=${o.prepperId}&mealId=${o.firstMealId ?? ''}&prepper=${encodeURIComponent(o.prepper)}`); }}
                    onReorder={() => reorder(o)}
                    onReport={() => { feedback.tap(); setReportReason(''); setReportErr(null); setReportModal(o); }}
                    onMessage={() => { feedback.tap(); router.push(`/prepper?id=${o.prepperId}`); }}
                    onChat={async () => {
                      if (!o.prepperUserId) { router.push(`/prepper?id=${o.prepperId}`); return; }
                      feedback.tap();
                      try {
                        const convId = await startConversation.mutateAsync(o.prepperUserId);
                        router.push(`/chat?id=${convId}&name=${encodeURIComponent(o.prepper)}`);
                      } catch { feedback.error(); setActionErr('Could not open chat. Try again.'); }
                    }}
                    reordering={reorderingId === o.id}
                  />
                </MotiView>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {paySheet ? (
        <StripeEmbeddedSheet clientSecret={paySheet.clientSecret} pk={paySheet.pk} onClose={() => setPaySheet(null)} />
      ) : null}

      <Modal visible={!!reportModal} transparent animationType="fade" onRequestClose={() => setReportModal(null)}>
        <Pressable onPress={() => setReportModal(null)} accessibilityRole="button" accessibilityLabel="Close report form" style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ width: '100%', maxWidth: 360, backgroundColor: Palette.surface, borderRadius: 24, padding: 22, gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={26} color={Palette.textSecondary} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>Report an issue</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20 }}>
              Tell us what went wrong with your preorder from {reportModal?.prepper ?? ''}. Our team will review it.
            </Text>
            <TextInput value={reportReason} onChangeText={setReportReason} placeholder="Describe the issue…" placeholderTextColor={Palette.textMuted}
              multiline maxLength={1000}
              style={{ minHeight: 100, backgroundColor: Palette.canvas, borderRadius: 12, borderWidth: 1, borderColor: Palette.border, padding: 12, fontFamily: Font.body, fontSize: 14, color: INK, textAlignVertical: 'top' }} />
            {reportErr ? <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger }}>{reportErr}</Text> : null}
            <PressableScale onPress={submitReport} disabled={reportDispute.isPending} accessibilityRole="button" accessibilityLabel="Submit report"
              style={{ height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: reportDispute.isPending ? 0.7 : 1 }}>
              {reportDispute.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Submit report</Text>}
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); setReportModal(null); }} accessibilityRole="button" accessibilityLabel="Cancel"
              style={{ height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>Cancel</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!confirmCancel} transparent animationType="fade" onRequestClose={() => setConfirmCancel(null)}>
        <Pressable onPress={() => setConfirmCancel(null)} accessibilityRole="button" accessibilityLabel="Keep my preorder" style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ width: '100%', maxWidth: 360, backgroundColor: Palette.surface, borderRadius: 24, padding: 22, gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Palette.danger + '1A', alignItems: 'center', justifyContent: 'center' }}>
              <X size={26} color={Palette.danger} strokeWidth={2.6} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>Cancel this preorder?</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 20 }}>
              {confirmCancel ? `Your preorder from ${confirmCancel.prepper} (${money(confirmCancel.total)}) will be cancelled.` : ''}
              {confirmCancel?.paymentStatus === 'succeeded' ? " You'll be refunded automatically." : ''}
            </Text>
            <PressableScale onPress={() => { feedback.tap(); if (confirmCancel) doCancel(confirmCancel); }} accessibilityRole="button" accessibilityLabel="Yes, cancel the preorder"
              style={{ height: 50, borderRadius: 14, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Yes, cancel preorder</Text>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); setConfirmCancel(null); }} accessibilityRole="button" accessibilityLabel="Keep my preorder"
              style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>Keep my preorder</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
