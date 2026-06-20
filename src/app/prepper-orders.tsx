import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarCheck, ChevronLeft, MapPin, ShoppingBag, Ticket, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';
import { useRefundOrder } from '@/lib/queries/cart';
import { useCaptureHomeCookPayment, usePrepperHomeCookRequests, useProposeHomeCookTerms, type HomeCookRequest } from '@/lib/queries/home-cook';
import { useAdvanceOrder, useCancelOrder, useOrdersRealtime, usePrepperOrders, useVerifyHandoff, type OrderSummary } from '@/lib/queries/orders';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { usePrepperBookedExperiences, type BookedExperienceJob } from '@/lib/queries/experiences';
import { useBreakpoint } from '@/lib/layout';
import { useAuth } from '@/providers/auth-provider';
import { HC, ORANGE, CARD, BG, OrderCard, StatusFilterStrip, FilterEmptyState, applyStatusFilter, type StatusFilter } from '@/components/prepper-order-card';
import { OrderDetailPanel } from '@/components/tablet/order-detail-panel';
import { HomeCookTab } from '@/components/prepper-orders/home-cook-tab';
import { DeclineModal, VerifyHandoffModal, ProposeTermsModal } from '@/components/prepper-orders/order-action-buttons';

export default function PrepperOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const breakpoint = useBreakpoint();
  const isDesktop = breakpoint === 'desktop';
  const isTablet = breakpoint === 'tablet';
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const prepperId = prepper?.id;
  const { data: orders, isLoading, isError: ordersError, refetch } = usePrepperOrders(prepperId);
  const { data: homeCookJobs, refetch: refetchHC } = usePrepperHomeCookRequests(prepperId);
  const { data: expJobs, refetch: refetchExp } = usePrepperBookedExperiences(prepperId);
  useOrdersRealtime('prepper_id', prepperId);

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetch(), refetchHC(), refetchExp()]); setRefreshing(false); }

  const advance = useAdvanceOrder();
  const cancel = useCancelOrder();
  const refund = useRefundOrder();
  const verify = useVerifyHandoff();
  const proposeTerms = useProposeHomeCookTerms();
  const captureHC = useCaptureHomeCookPayment();
  const busyId = advance.isPending ? advance.variables?.orderId : cancel.isPending ? cancel.variables?.orderId : undefined;

  const [actionErr, setActionErr] = useState<string | null>(null);
  const onErr = (e: unknown) => { feedback.error(); setActionErr(e instanceof Error ? e.message : 'Could not update the preorder. Try again.'); };

  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'preorders' | 'homecook' | 'experiences'>(
    tabParam === 'homecook' || tabParam === 'experiences' ? tabParam : 'preorders',
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [orderFilter, setOrderFilter] = useState<'active' | 'history'>('active');

  const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];
  const allOrders = orders ?? [];
  const pendingCount = allOrders.filter((o) => o.status === 'pending').length;
  const activeOrders = allOrders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const historyOrders = allOrders.filter((o) => ['completed', 'cancelled'].includes(o.status));
  // For the mobile preorders tab, status filter applies on top of active/history
  const baseOrders = orderFilter === 'active' ? activeOrders : historyOrders;
  const filteredOrders = applyStatusFilter(baseOrders, statusFilter);

  // Decline modal
  const [declineOrder, setDeclineOrder] = useState<OrderSummary | null>(null);
  function doDecline(o: OrderSummary) {
    setDeclineOrder(null);
    setActionErr(null);
    cancel.mutate(
      { orderId: o.id, prepperUserId: o.prepperUserId, customerName: o.customer },
      { onSuccess: () => refund.mutate(o.id, { onSuccess: () => feedback.success(), onError: () => { feedback.error(); setActionErr('Could not issue refund. Contact support if the customer was not refunded.'); } }), onError: onErr },
    );
  }

  // Verify handoff modal
  const [verifyOrder, setVerifyOrder] = useState<OrderSummary | null>(null);
  const [pin, setPin] = useState('');
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  function openVerify(o: OrderSummary) { setVerifyOrder(o); setPin(''); setVerifyMsg(null); }
  function submitPin() {
    if (!verifyOrder || pin.replace(/\D/g, '').length !== 3) { setVerifyMsg('Enter the 3-digit code.'); return; }
    setVerifyMsg(null);
    verify.mutate({ orderId: verifyOrder.id, pin }, {
      onSuccess: (r) => {
        if (r.ok && r.completed) {
          feedback.success();
          setVerifyOrder(null);
          if (verifyOrder?.fulfillment === 'home_cook') captureHC.mutate(verifyOrder.id, { onError: () => { feedback.error(); setActionErr('Payment capture failed — contact support if needed.'); } });
        } else if (r.locked) {
          feedback.error(); setVerifyMsg(r.reason ?? 'Locked — ask for the QR code.');
        } else {
          feedback.error(); setVerifyMsg(`${r.reason ?? 'Wrong code'}${typeof r.attempts_left === 'number' ? ` · ${r.attempts_left} tries left` : ''}`); setPin('');
        }
      },
      onError: (e) => { feedback.error(); setVerifyMsg(e instanceof Error ? e.message : 'Could not verify.'); },
    });
  }

  // Propose terms modal
  const [proposeTarget, setProposeTarget] = useState<HomeCookRequest | null>(null);
  const [cookingFee, setCookingFee] = useState('');
  const [travelFee, setTravelFee] = useState('');
  const [termsErr, setTermsErr] = useState<string | null>(null);
  function submitTerms() {
    if (!proposeTarget) return;
    const cf = parseFloat(cookingFee.replace(/[^0-9.]/g, ''));
    const tf = parseFloat(travelFee.replace(/[^0-9.]/g, '') || '0');
    if (!cf || cf <= 0) return setTermsErr('Enter a cooking fee.');
    setTermsErr(null);
    proposeTerms.mutate(
      { requestId: proposeTarget.id, cookingFee: cf, travelFee: tf || 0 },
      {
        onSuccess: () => { feedback.success(); setProposeTarget(null); setCookingFee(''); setTravelFee(''); },
        onError: (e) => { feedback.error(); setTermsErr(e instanceof Error ? e.message : 'Could not send proposal.'); },
      },
    );
  }

  // Tablet master-detail
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
            <ChevronLeft size={22} color="#1A1714" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#1A1714', letterSpacing: -0.6, flex: 1 }}>
            {tab === 'homecook' ? 'home cook jobs' : tab === 'experiences' ? 'experience jobs' : 'kitchen orders'}
          </Text>
          {tab === 'preorders' && activeOrders.length > 0 ? (
            <View style={{ paddingHorizontal: 10, height: 28, borderRadius: Radius.pill, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>{activeOrders.length} active</Text>
            </View>
          ) : null}
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: CARD, borderRadius: 14, padding: 4, gap: 4, shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
          {([['preorders', 'Preorders', pendingCount], ['homecook', 'Home Cook', homeCookJobs?.length ?? 0], ['experiences', 'Experiences', expJobs?.length ?? 0]] as const).map(([key, label, badge]) => {
            const active = tab === key;
            const accentColor = key === 'homecook' ? HC : ORANGE;
            return (
              <PressableScale key={key} onPress={() => { feedback.tap(); setTab(key); }} accessibilityRole="tab" accessibilityLabel={label}
                style={{ flex: 1, height: 36, borderRadius: 10, backgroundColor: active ? accentColor : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: active ? '#fff' : '#78716C' }}>{label}</Text>
                {badge != null && badge > 0 ? (
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: active ? 'rgba(255,255,255,0.3)' : accentColor, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: '#fff' }}>{badge}</Text>
                  </View>
                ) : null}
              </PressableScale>
            );
          })}
        </View>

        {actionErr ? (
          <PressableScale onPress={() => { feedback.tap(); setActionErr(null); }} accessibilityRole="button" accessibilityLabel="Dismiss error"
            style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: Palette.danger + '15', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Palette.danger + '40' }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger }}>{actionErr} (tap to dismiss)</Text>
          </PressableScale>
        ) : null}

        {/* Home Cook tab */}
        {tab === 'homecook' ? (
          <HomeCookTab
            prepperId={prepperId}
            homeCookJobs={homeCookJobs}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onProposeTerms={(job) => { setTermsErr(null); setProposeTarget(job); }}
          />
        ) : null}

        {/* Experiences tab */}
        {tab === 'experiences' ? (
          !prepperId ? (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
              <Ticket size={28} color="#78716C" />
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#78716C', textAlign: 'center' }}>Approved preppers see booked experience jobs here.</Text>
            </MotiView>
          ) : !expJobs?.length ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                <Ticket size={28} color="#78716C" />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#1A1714' }}>No experience jobs yet</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#78716C', textAlign: 'center', lineHeight: 20 }}>
                When customers accept your bid on an experience request, the job appears here.
              </Text>
            </MotiView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}>
              {(expJobs ?? []).map((job: BookedExperienceJob, i: number) => (
                <MotiView key={job.bidId} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: i * 45 }}>
                  <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 16, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                          <View style={{ backgroundColor: ORANGE + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: ORANGE, textTransform: 'capitalize' }}>{job.kind.replace('_', ' ')}</Text>
                          </View>
                          <View style={{ backgroundColor: '#16a34a22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#16a34a' }}>Booked</Text>
                          </View>
                        </View>
                        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#1A1714' }}>{job.title}</Text>
                      </View>
                      <Text style={{ fontFamily: Font.display, fontSize: 20, color: ORANGE, letterSpacing: -0.4 }}>${job.amount.toLocaleString('en-US')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {job.guests != null ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0EDEA', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Users size={12} color={'#78716C'} />
                          <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary }}>{job.guests} guests</Text>
                        </View>
                      ) : null}
                      {job.location ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0EDEA', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <MapPin size={12} color={'#78716C'} />
                          <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary }} numberOfLines={1}>{job.location}</Text>
                        </View>
                      ) : null}
                      {job.event_date ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0EDEA', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <CalendarCheck size={12} color={'#78716C'} />
                          <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary }}>
                            {(() => { const d = new Date(job.event_date); return isNaN(d.getTime()) ? job.event_date : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); })()}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {job.details ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#78716C', lineHeight: 18 }} numberOfLines={3}>{job.details}</Text> : null}
                    {job.message ? (
                      <View style={{ backgroundColor: '#F0EDEA', borderRadius: 10, padding: 10 }}>
                        <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, fontStyle: 'italic', lineHeight: 18 }}>&ldquo;{job.message}&rdquo;</Text>
                      </View>
                    ) : null}
                  </View>
                </MotiView>
              ))}
            </ScrollView>
          )
        ) : null}

        {/* Preorders tab */}
        {tab === 'preorders' ? (
          !prepperId ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
              <ShoppingBag size={28} color="#78716C" />
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#78716C', textAlign: 'center' }}>This is your kitchen&apos;s preorder queue. Approved preppers see incoming preorders here.</Text>
            </MotiView>
          ) : isLoading ? (
            <ListSkeleton count={4} rowHeight={110} />
          ) : ordersError ? (
            <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                <ShoppingBag size={28} color="#78716C" />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#1A1714' }}>Couldn't load preorders</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#78716C', textAlign: 'center' }}>Check your connection and try again.</Text>
              <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading preorders"
                style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>retry</Text>
              </PressableScale>
            </MotiView>
          ) : !allOrders.length ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
              <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: ORANGE + '14', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag size={40} color={ORANGE} />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 18, color: '#1A1714', textAlign: 'center' }}>No preorders yet</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#78716C', textAlign: 'center', lineHeight: 21 }}>Share your kitchen to start getting orders</Text>
              <PressableScale onPress={() => { feedback.tap(); router.push('/post-video'); }} accessibilityRole="button" accessibilityLabel="Share your kitchen"
                style={{ marginTop: 4, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>share your kitchen</Text>
              </PressableScale>
            </MotiView>
          ) : isTablet ? (
            /* ── Tablet master-detail ── */
            <View style={{ flex: 1, flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingBottom: 16 }}>
              <ScrollView style={{ flex: 4 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}>
                <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 10 }}>
                  {(['active', 'history'] as const).map((f) => (
                    <PressableScale key={f} onPress={() => { feedback.tap(); setOrderFilter(f); setSelectedOrder(null); }} accessibilityRole="button" accessibilityLabel={f === 'active' ? 'Active orders' : 'Order history'} accessibilityState={{ selected: orderFilter === f }}
                      style={{ backgroundColor: orderFilter === f ? ORANGE : CARD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, minHeight: 44 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: orderFilter === f ? '#fff' : '#78716C' }}>
                        {f === 'active' ? `Active${pendingCount > 0 ? ` (${pendingCount})` : ''}` : 'History'}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
                {filteredOrders.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
                    <ShoppingBag size={24} color="#78716C" />
                    <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#78716C', textAlign: 'center' }}>
                      {orderFilter === 'active' ? 'No active preorders' : 'No history yet'}
                    </Text>
                  </View>
                ) : null}
                <View style={{ gap: 10, paddingBottom: 20 }}>
                  {filteredOrders.map((o, i) => (
                    <MotiView key={o.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                      <PressableScale onPress={() => { feedback.tap(); setSelectedOrder(o); }} accessibilityRole="button" accessibilityLabel={`View order from ${o.customer}`}
                        style={{ backgroundColor: selectedOrder?.id === o.id ? ORANGE + '22' : CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: selectedOrder?.id === o.id ? ORANGE + '66' : 'transparent', minHeight: 44 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#1A1714', flex: 1 }} numberOfLines={1}>{o.customer}</Text>
                          <Text style={{ fontFamily: Font.display, fontSize: 14, color: ORANGE }}>${o.total.toFixed(2)}</Text>
                        </View>
                        <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#78716C', marginTop: 3 }} numberOfLines={1}>
                          {o.items[0]?.title ?? 'preorder'}{o.items.length > 1 ? ` +${o.items.length - 1}` : ''}
                        </Text>
                      </PressableScale>
                    </MotiView>
                  ))}
                </View>
              </ScrollView>
              <View style={{ width: 1, backgroundColor: '#EDE9E4', marginVertical: 8 }} />
              <View style={{ flex: 6 }}>
                {selectedOrder ? (
                  <OrderDetailPanel
                    order={selectedOrder}
                    advancePending={busyId === selectedOrder.id}
                    onAdvance={(next) => {
                      setActionErr(null);
                      advance.mutate({ orderId: selectedOrder.id, next }, {
                        onSuccess: () => { feedback.success(); setSelectedOrder((prev) => prev?.id === selectedOrder.id ? { ...prev, status: next } : prev); },
                        onError: onErr,
                      });
                    }}
                    onCancel={() => { feedback.warning(); setDeclineOrder(selectedOrder); }}
                    onVerify={() => openVerify(selectedOrder)}
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.45 }}>
                    <ShoppingBag size={32} color="#78716C" />
                    <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#78716C', textAlign: 'center' }}>Select a preorder to view details</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* ── Mobile list ── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
              contentContainerStyle={{ paddingBottom: 40 }}>

              {/* Active / History toggle */}
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                {(['active', 'history'] as const).map((f) => (
                  <PressableScale key={f} onPress={() => { feedback.tap(); setOrderFilter(f); setStatusFilter('all'); }} accessibilityRole="button" accessibilityLabel={f === 'active' ? 'Active orders' : 'Order history'} accessibilityState={{ selected: orderFilter === f }}
                    style={{ backgroundColor: orderFilter === f ? ORANGE : CARD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, minHeight: 44 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: orderFilter === f ? '#fff' : '#78716C' }}>
                      {f === 'active' ? `Active${pendingCount > 0 ? ` (${pendingCount})` : ''}` : 'History'}
                    </Text>
                  </PressableScale>
                ))}
              </View>

              {/* Status filter strip — only on active view, only when there are orders */}
              {orderFilter === 'active' && activeOrders.length > 0 ? (
                <StatusFilterStrip orders={activeOrders} active={statusFilter} onChange={setStatusFilter} />
              ) : null}

              {/* Order list or empty state */}
              {filteredOrders.length === 0 ? (
                <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
                  <FilterEmptyState filter={statusFilter !== 'all' ? statusFilter : orderFilter === 'active' ? 'all' : 'done'} />
                  {statusFilter === 'all' && orderFilter === 'active' ? (
                    <View style={{ alignItems: 'center', marginTop: -10 }}>
                      <PressableScale onPress={() => { feedback.tap(); router.push('/dashboard'); }} accessibilityRole="button" accessibilityLabel="Go to kitchen hub"
                        style={{ marginTop: 4, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 11 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>kitchen hub →</Text>
                      </PressableScale>
                    </View>
                  ) : null}
                </MotiView>
              ) : null}

              <View style={[isDesktop ? { flexDirection: 'row', flexWrap: 'wrap', gap: 14 } : { gap: 12 }, { paddingHorizontal: 16, paddingBottom: 0 }]}>
                {filteredOrders.map((o, i) => (
                  <MotiView
                    key={o.id}
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 260, delay: i * 45 }}
                    style={isDesktop ? { flex: 1, minWidth: 320, maxWidth: '48%' } : undefined}>
                    <OrderCard
                      order={o}
                      busy={busyId === o.id}
                      onAdvance={(next) => { setActionErr(null); advance.mutate({ orderId: o.id, next }, { onSuccess: () => feedback.success(), onError: onErr }); }}
                      onCancel={() => { feedback.warning(); setDeclineOrder(o); }}
                      onVerify={() => openVerify(o)}
                    />
                  </MotiView>
                ))}
              </View>
            </ScrollView>
          )
        ) : null}
      </SafeAreaView>

      {/* Modals */}
      <DeclineModal order={declineOrder} onDecline={doDecline} onClose={() => setDeclineOrder(null)} />
      <VerifyHandoffModal
        order={verifyOrder}
        pin={pin}
        setPin={setPin}
        verifyMsg={verifyMsg}
        setVerifyMsg={setVerifyMsg}
        isPending={verify.isPending}
        onSubmit={submitPin}
        onClose={() => setVerifyOrder(null)}
      />
      <ProposeTermsModal
        target={proposeTarget}
        cookingFee={cookingFee}
        setCookingFee={setCookingFee}
        travelFee={travelFee}
        setTravelFee={setTravelFee}
        termsErr={termsErr}
        isPending={proposeTerms.isPending}
        onSubmit={submitTerms}
        onClose={() => setProposeTarget(null)}
      />
    </View>
  );
}
