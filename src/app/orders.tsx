import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertCircle, ArrowRight, Check, ChevronLeft, Receipt, ShoppingBag } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useMemo, useState } from 'react';
import { Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrderCard, OrderListCard } from '@/components/order-card';
import { OrderFilters, type StatusFilter } from '@/components/order-filters';
import { ConfirmCancelModal, ReportModal } from '@/components/order-modals';
import { OrderReceiptPanel } from '@/components/order-detail';
import { StripeEmbeddedSheet } from '@/components/stripe-embedded';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useAddToCart, useEmbeddedCheckout, useRefundOrder, useStripeCheckout, type EmbeddedPay } from '@/lib/queries/cart';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { feedback } from '@/lib/feedback';
import { useStartConversation } from '@/lib/queries/messages';
import { ACTIVE_STATUSES } from '@/lib/orders/pipeline';
import { useCancelOrder, useMyOrders, useReportDispute, type OrderSummary } from '@/lib/queries/orders';
import { BP } from '@/lib/layout';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const twoCol = Platform.OS === 'web' && width >= BP.desktop;
  const { data: orders, isLoading, isError, refetch } = useMyOrders(user?.id);
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
      { orderId: reportModal!.id, reason },
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
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'upcoming' | 'past'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const activeOrders = (orders ?? []).filter(
    (o) => (ACTIVE_STATUSES as readonly string[]).includes(o.status) && !o.scheduled_at,
  );
  const upcomingOrders = (orders ?? []).filter(
    (o) => !!o.scheduled_at && o.status !== 'completed' && o.status !== 'cancelled',
  ).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  const pastOrders = (orders ?? []).filter(
    (o) => o.status === 'completed' || o.status === 'cancelled',
  );
  const tabOrders = tab === 'active' ? activeOrders : tab === 'upcoming' ? upcomingOrders : pastOrders;

  const filtered = useMemo(() => {
    let result = tabOrders;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((o) =>
        o.prepper?.toLowerCase().includes(q) ||
        o.items?.some((item) => item.title?.toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        result = result.filter((o) => !['completed', 'cancelled'].includes(o.status));
      } else if (statusFilter === 'completed') {
        result = result.filter((o) => o.status === 'completed');
      } else if (statusFilter === 'cancelled') {
        result = result.filter((o) => o.status === 'cancelled');
      }
    }
    return result;
  }, [tabOrders, searchQuery, statusFilter]);

  const filterCounts = useMemo((): Record<StatusFilter, number> => ({
    all: tabOrders.length,
    active: tabOrders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length,
    completed: tabOrders.filter((o) => o.status === 'completed').length,
    cancelled: tabOrders.filter((o) => o.status === 'cancelled').length,
  }), [tabOrders]);

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
  const [refundFailModal, setRefundFailModal] = useState(false);

  function doCancel(o: OrderSummary) {
    setConfirmCancel(null);
    setActionErr(null);
    cancelOrder.mutate(
      { orderId: o.id, prepperUserId: o.prepperUserId, customerName: o.customer },
      {
        onSuccess: () => refundOrder.mutate(o.id, {
          onSuccess: () => feedback.success(),
          onError: () => { feedback.error(); setRefundFailModal(true); },
        }),
        onError: (e) => { feedback.error(); setActionErr(e instanceof Error ? e.message : 'Could not cancel. Try again.'); },
      },
    );
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

        {/* Tab bar */}
        {user && !isLoading && !isError ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}>
            {(['active', 'upcoming', 'past'] as const).map((t) => {
              const count = t === 'active' ? activeOrders.length : t === 'upcoming' ? upcomingOrders.length : pastOrders.length;
              const active = tab === t;
              return (
                <PressableScale
                  key={t}
                  onPress={() => { feedback.tap(); setTab(t); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t} orders`}
                  style={{ height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: active ? ORANGE : Palette.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: active ? '#fff' : Palette.textSecondary, textTransform: 'capitalize' }}>{t}</Text>
                  {count > 0 ? (
                    <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: active ? 'rgba(255,255,255,0.3)' : Palette.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: active ? '#fff' : Palette.textSecondary }}>{count}</Text>
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Search + filter chips — shown once data is loaded */}
        {user && !isLoading && !isError ? (
          <OrderFilters
            searchQuery={searchQuery}
            onSearchChange={(q) => { setSearchQuery(q); }}
            statusFilter={statusFilter}
            onStatusChange={(s) => { setStatusFilter(s); }}
            counts={filterCounts}
          />
        ) : null}

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
            <Receipt size={28} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to see your preorders.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/auth?mode=signin'); }} accessibilityRole="button" accessibilityLabel="Sign in"
              style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : isLoading ? (
          <ListSkeleton count={3} rowHeight={112} />
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={28} color={Palette.textSecondary} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Couldn't load preorders</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading preorders"
              style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 48 }}>

            {/* Past tab stats bar */}
            {tab === 'past' && pastOrders.filter((o) => o.status === 'completed').length > 0 ? (() => {
              const done = pastOrders.filter((o) => o.status === 'completed');
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
                  style={{ flexDirection: 'row', gap: 8, marginBottom: 12, paddingHorizontal: 16 }}>
                  {stats.map(({ label, value }) => (
                    <View key={label} style={{ flex: 1, backgroundColor: Palette.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 }}>
                      <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, fontVariant: ['tabular-nums'] }}>{value}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, textAlign: 'center' }}>{label}</Text>
                    </View>
                  ))}
                </MotiView>
              );
            })() : null}

            {/* Unpaid orders warning banner */}
            {tab === 'active' && paymentsOn && activeOrders.some((o) => o.status === 'pending' && o.paymentStatus !== 'succeeded' && o.paymentStatus !== 'refunded') && (
              <View style={{
                backgroundColor: Palette.amberTint,
                borderColor: Palette.amber,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                marginHorizontal: 16,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}>
                <AlertCircle size={16} color="#D97706" />
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.amberDeep, flex: 1 }}>
                  You have unpaid orders — complete payment to confirm
                </Text>
              </View>
            )}

            {/* Empty state */}
            {filtered.length === 0 ? (
              <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}
                style={{ alignItems: 'center', justifyContent: 'center', padding: 48, gap: 10 }}>
                <ShoppingBag size={56} color={Palette.border} />
                {searchQuery.trim() ? (
                  <>
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, textAlign: 'center' }}>
                      No orders matching &ldquo;{searchQuery.trim()}&rdquo;
                    </Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 240 }}>
                      Try searching for a kitchen or meal name
                    </Text>
                    <PressableScale onPress={() => { feedback.tap(); setSearchQuery(''); }} accessibilityRole="button" accessibilityLabel="Clear search"
                      style={{ marginTop: 4, paddingHorizontal: 22, height: 44, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Clear search</Text>
                    </PressableScale>
                  </>
                ) : statusFilter !== 'all' ? (
                  <>
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, textAlign: 'center' }}>
                      No {statusFilter} orders in {tab === 'active' ? 'active' : tab === 'upcoming' ? 'upcoming' : 'past'}
                    </Text>
                    <PressableScale onPress={() => { feedback.tap(); setStatusFilter('all'); }} accessibilityRole="button" accessibilityLabel="View all orders"
                      style={{ marginTop: 4, paddingHorizontal: 22, height: 44, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>View all orders</Text>
                    </PressableScale>
                  </>
                ) : (
                  <>
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, textAlign: 'center' }}>
                      {tab === 'active' ? 'No active orders' : tab === 'upcoming' ? 'Nothing scheduled' : 'No past orders'}
                    </Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 240 }}>
                      {tab === 'active'
                        ? 'Your in-progress preorders will appear here.'
                        : tab === 'upcoming'
                        ? 'Schedule a preorder to see it here.'
                        : 'Completed and cancelled orders will show here.'}
                    </Text>
                    {tab !== 'past' ? (
                      <PressableScale onPress={() => { feedback.tap(); router.replace('/explore'); }} accessibilityRole="button" accessibilityLabel="Browse meals"
                        style={{ marginTop: 4, paddingHorizontal: 22, height: 44, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Browse meals</Text>
                      </PressableScale>
                    ) : null}
                  </>
                )}
              </MotiView>
            ) : (
              <View style={twoCol ? { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 } : { gap: 12 }}>
                {filtered.map((o, i) => (
                  <MotiView key={o.id}
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 220, delay: i * 45 }}
                    style={twoCol ? { width: '48.5%' } : undefined}>
                    <OrderListCard
                      order={o}
                      tab={tab}
                      twoCol={twoCol}
                      reordering={reorderingId === o.id}
                      onPress={() => {
                        feedback.tap();
                        if (tab === 'past') {
                          setExpandedOrderId((prev) => (prev === o.id ? null : o.id));
                        } else {
                          router.push(`/order-status?id=${o.id}` as never);
                        }
                      }}
                      onReorder={() => reorder(o)}
                      onTrack={() => { feedback.tap(); router.push(`/orders/${o.id}` as never); }}
                    />
                    {/* Inline receipt panel — past orders only, toggled by tapping the card header */}
                    {tab === 'past' && expandedOrderId === o.id ? (
                      <View style={{ marginHorizontal: twoCol ? 0 : 16 }}>
                        <OrderReceiptPanel order={o} />
                        <PressableScale
                          onPress={() => { feedback.tap(); router.push(`/order-receipt?id=${o.id}` as never); }}
                          accessibilityRole="button"
                          accessibilityLabel="View full receipt"
                          style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, marginTop: 2 }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: ORANGE }}>View full receipt</Text>
                          <ArrowRight size={13} color={ORANGE} />
                        </PressableScale>
                      </View>
                    ) : null}
                    {/* Full OrderCard for actions (pay, cancel, reorder, etc.) */}
                    <View style={{ marginTop: 8, marginHorizontal: twoCol ? 0 : 16 }}>
                      <OrderCard
                        order={o}
                        needsPayment={paymentsOn && o.status === 'pending' && o.paymentStatus !== 'succeeded' && o.paymentStatus !== 'refunded'}
                        paying={payingId === o.id}
                        onPay={() => payOrder(o.id)}
                        cancelling={cancelOrder.isPending && cancelOrder.variables?.orderId === o.id}
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
                        onPress={() => { feedback.tap(); router.push(`/order-status?id=${o.id}` as never); }}
                        reordering={reorderingId === o.id}
                      />
                    </View>
                  </MotiView>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {paySheet ? (
        <StripeEmbeddedSheet clientSecret={paySheet.clientSecret} pk={paySheet.pk} onClose={() => setPaySheet(null)} />
      ) : null}

      <ReportModal
        reportModal={reportModal}
        reportReason={reportReason}
        setReportReason={setReportReason}
        reportErr={reportErr}
        isPending={reportDispute.isPending}
        onSubmit={submitReport}
        onClose={() => setReportModal(null)}
      />

      <ConfirmCancelModal
        confirmCancel={confirmCancel}
        onConfirm={doCancel}
        onDismiss={() => setConfirmCancel(null)}
      />

      <Modal visible={refundFailModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, gap: 16 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 17, color: Palette.ink, textAlign: 'center' }}>
              Refund could not be processed
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              Your preorder was cancelled but the refund failed. Please contact support and we will resolve this for you.
            </Text>
            <Pressable
              onPress={() => { void Linking.openURL('mailto:support@preppa.live'); }}
              accessibilityRole="button"
              accessibilityLabel="Contact support"
              style={{ height: 48, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Contact Support</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
