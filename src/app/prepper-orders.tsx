import { useRouter } from 'expo-router';
import { CalendarCheck, ChefHat, ChevronLeft, MapPin, QrCode, ShoppingBag, Ticket, Users, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
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
import { HC, HC_TINT, ORANGE, CARD, BG, money, OrderCard } from '@/components/prepper-order-card';

export default function PrepperOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isDesktop = useBreakpoint() === 'desktop';
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const prepperId = prepper?.id;
  const { data: orders, isLoading, refetch } = usePrepperOrders(prepperId);
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
  const busyId = advance.isPending ? advance.variables?.orderId : cancel.isPending ? cancel.variables : undefined;
  const [actionErr, setActionErr] = useState<string | null>(null);
  const onErr = (e: unknown) => setActionErr(e instanceof Error ? e.message : 'Could not update the preorder. Try again.');
  const [declineOrder, setDeclineOrder] = useState<OrderSummary | null>(null);
  const [tab, setTab] = useState<'preorders' | 'homecook' | 'experiences'>('preorders');
  const [orderFilter, setOrderFilter] = useState<'active' | 'history'>('active');
  const pendingCount = (orders ?? []).filter((o) => o.status === 'pending').length;
  const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];
  const filteredOrders = (orders ?? []).filter((o) =>
    orderFilter === 'active' ? ACTIVE_STATUSES.includes(o.status) : ['completed', 'cancelled'].includes(o.status),
  );
  const [proposeTarget, setProposeTarget] = useState<HomeCookRequest | null>(null);
  const [cookingFee, setCookingFee] = useState('');
  const [travelFee, setTravelFee] = useState('');
  const [termsErr, setTermsErr] = useState<string | null>(null);

  function doDecline(o: OrderSummary) {
    setDeclineOrder(null);
    setActionErr(null);
    cancel.mutate(o.id, { onSuccess: () => refund.mutate(o.id), onError: onErr });
  }

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
        onError: (e) => setTermsErr(e instanceof Error ? e.message : 'Could not send proposal.'),
      },
    );
  }

  // Handoff verification modal (pickup/meetup/home_cook): cook keys the customer's PIN.
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
          if (verifyOrder?.fulfillment === 'home_cook') captureHC.mutate(verifyOrder.id);
        }
        else if (r.locked) { feedback.error(); setVerifyMsg(r.reason ?? 'Locked — ask for the QR code.'); }
        else { feedback.error(); setVerifyMsg(`${r.reason ?? 'Wrong code'}${typeof r.attempts_left === 'number' ? ` · ${r.attempts_left} tries left` : ''}`); setPin(''); }
      },
      onError: (e) => { feedback.error(); setVerifyMsg(e instanceof Error ? e.message : 'Could not verify.'); },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6 }}>
            {tab === 'homecook' ? 'home cook jobs' : tab === 'experiences' ? 'experience jobs' : 'incoming preorders'}
          </Text>
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: CARD, borderRadius: 14, padding: 4, gap: 4 }}>
          {([['preorders', 'Preorders', pendingCount], ['homecook', 'Home Cook', homeCookJobs?.length ?? 0], ['experiences', 'Experiences', expJobs?.length ?? 0]] as const).map(([key, label, badge]) => {
            const active = tab === key;
            const accentColor = key === 'homecook' ? HC : ORANGE;
            return (
              <PressableScale key={key} onPress={() => { feedback.tap(); setTab(key); }} accessibilityRole="tab" accessibilityLabel={label}
                style={{ flex: 1, height: 36, borderRadius: 10, backgroundColor: active ? accentColor : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: active ? '#fff' : '#5b6170' }}>{label}</Text>
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
          <PressableScale onPress={() => { feedback.tap(); setActionErr(null); }} accessibilityRole="button" accessibilityLabel="Dismiss error" style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: '#7f1d1d', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#fecaca' }}>{actionErr} (tap to dismiss)</Text>
          </PressableScale>
        ) : null}

        {/* Home Cook tab */}
        {tab === 'homecook' ? (
          !prepperId ? (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
              <ChefHat size={28} color="#5b6170" />
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>Approved preppers see home cook booking requests here.</Text>
            </MotiView>
          ) : !homeCookJobs?.length ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
                <ChefHat size={28} color="#5b6170" />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>No home cook requests</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>When Prep+ customers book you to cook at their home, requests appear here for you to review and propose terms.</Text>
            </MotiView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={HC} colors={[HC]} />} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}>
              {homeCookJobs.map((job, i) => {
                const isNegotiating = job.status === 'negotiating';
                return (
                  <MotiView key={job.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: i * 45 }}>
                  <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 16, gap: 12, borderLeftWidth: 3, borderLeftColor: isNegotiating ? HC : '#7C3AED66' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }} numberOfLines={1}>{job.customerName ?? 'Customer'}</Text>
                        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 1 }}>
                          ${job.ingredientBudget} ingredient budget · {job.guestCount} guest{job.guestCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: 11, height: 26, borderRadius: Radius.pill, backgroundColor: isNegotiating ? HC + '30' : '#252a34', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: isNegotiating ? HC_TINT : Palette.textMuted, textTransform: 'capitalize' }}>{job.status}</Text>
                      </View>
                    </View>

                    <View style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <CalendarCheck size={13} color={HC} />
                        <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>{job.requestedDate} · {job.requestedTime.replace('_', ' ')}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <MapPin size={13} color={HC} />
                        <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }} numberOfLines={1}>{job.address}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <Users size={13} color={HC} />
                        <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>
                          {job.guestCount} guests{job.cuisine ? ` · ${job.cuisine}` : ''}
                        </Text>
                      </View>
                    </View>

                    {isNegotiating && job.cookingFee != null ? (
                      <View style={{ backgroundColor: '#1d2129', borderRadius: 11, padding: 10, gap: 3 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: HC }}>Terms proposed — awaiting customer</Text>
                        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>
                          Cooking: ${job.cookingFee} · Travel: ${job.travelFee ?? 0} · Customer total: ${job.ingredientBudget + job.cookingFee + (job.travelFee ?? 0)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {job.conversationId ? (
                        <PressableScale onPress={() => { feedback.tap(); router.push({ pathname: '/chat', params: { id: job.conversationId!, name: job.customerName ?? 'Customer' } }); }}
                          accessibilityRole="button" accessibilityLabel="Open chat"
                          style={{ height: 44, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1, borderColor: '#3f4451', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.textMuted }}>Chat</Text>
                        </PressableScale>
                      ) : null}
                      {job.status === 'pending' ? (
                        <PressableScale onPress={() => { feedback.tap(); setTermsErr(null); setProposeTarget(job); }}
                          accessibilityRole="button" accessibilityLabel="Propose terms"
                          style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: HC, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: '#fff' }}>Propose terms</Text>
                        </PressableScale>
                      ) : (
                        <View style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: '#1d2129', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.textMuted }}>Awaiting customer confirmation</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  </MotiView>
                );
              })}
            </ScrollView>
          )
        ) : null}

        {/* Experiences tab */}
        {tab === 'experiences' ? (
          !prepperId ? null : !expJobs?.length ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
                <Ticket size={28} color="#5b6170" />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>No experience jobs yet</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center', lineHeight: 20 }}>
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
                            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#4ade80' }}>Booked</Text>
                          </View>
                        </View>
                        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>{job.title}</Text>
                      </View>
                      <Text style={{ fontFamily: Font.display, fontSize: 20, color: ORANGE, letterSpacing: -0.4 }}>${job.amount.toLocaleString('en-US')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {job.guests != null ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1d2129', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Users size={12} color={Palette.textMuted} />
                          <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary }}>{job.guests} guests</Text>
                        </View>
                      ) : null}
                      {job.location ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1d2129', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <MapPin size={12} color={Palette.textMuted} />
                          <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary }} numberOfLines={1}>{job.location}</Text>
                        </View>
                      ) : null}
                      {job.event_date ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1d2129', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <CalendarCheck size={12} color={Palette.textMuted} />
                          <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary }}>{job.event_date}</Text>
                        </View>
                      ) : null}
                    </View>
                    {job.details ? (
                      <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, lineHeight: 18 }} numberOfLines={3}>{job.details}</Text>
                    ) : null}
                    {job.message ? (
                      <View style={{ backgroundColor: '#1d2129', borderRadius: 10, padding: 10 }}>
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
              <ShoppingBag size={28} color="#5b6170" />
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>This is your kitchen&apos;s preorder queue. Approved preppers see incoming preorders here.</Text>
            </MotiView>
          ) : isLoading ? (
            <ListSkeleton count={4} rowHeight={110} />
          ) : !orders?.length ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag size={28} color="#5b6170" />
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>No preorders yet</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>New preorders from customers will appear here in real time.</Text>
            </MotiView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 }}>
                {(['active', 'history'] as const).map((f) => (
                  <PressableScale key={f} onPress={() => { feedback.tap(); setOrderFilter(f); }} accessibilityRole="button" accessibilityState={{ selected: orderFilter === f }}
                    style={{ backgroundColor: orderFilter === f ? ORANGE : CARD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: orderFilter === f ? '#fff' : '#5b6170' }}>{f === 'active' ? `Active${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}` : 'History'}</Text>
                  </PressableScale>
                ))}
              </View>
              {filteredOrders.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                  <ShoppingBag size={24} color="#5b6170" />
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted }}>{orderFilter === 'active' ? 'No active preorders right now.' : 'No completed preorders yet.'}</Text>
                </View>
              ) : null}
              <View style={[isDesktop ? { flexDirection: 'row', flexWrap: 'wrap', gap: 14 } : { gap: 12 }, { paddingHorizontal: 20, paddingBottom: 0 }]}>
                {filteredOrders.map((o, i) => (
                  <MotiView key={o.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: i * 45 }}
                    style={isDesktop ? { flex: 1, minWidth: 320, maxWidth: '48%' } : undefined}>
                    <OrderCard
                      order={o}
                      busy={busyId === o.id}
                      onAdvance={(next) => { setActionErr(null); advance.mutate({ orderId: o.id, next }, { onError: onErr }); }}
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

      {/* Decline confirmation */}
      <Modal visible={!!declineOrder} transparent animationType="fade" onRequestClose={() => setDeclineOrder(null)}>
        <Pressable onPress={() => setDeclineOrder(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 14 }}>
            <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: '#7f1d1d', alignItems: 'center', justifyContent: 'center' }}>
              <X size={24} color="#fca5a5" strokeWidth={2.6} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>Decline this preorder?</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textMuted, lineHeight: 19 }}>
              {declineOrder ? `${declineOrder.customer}'s preorder (${money(declineOrder.total)}) will be cancelled and the customer refunded automatically.` : ''}
            </Text>
            <PressableScale onPress={() => { feedback.tap(); if (declineOrder) doDecline(declineOrder); }} accessibilityRole="button" accessibilityLabel="Yes, decline the preorder" style={{ height: 50, borderRadius: 14, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Yes, decline</Text>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); setDeclineOrder(null); }} accessibilityRole="button" accessibilityLabel="Keep the preorder" style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textMuted }}>Keep the preorder</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Verify handoff — cook keys the customer's pickup/meetup PIN */}
      <Modal visible={!!verifyOrder} transparent animationType="fade" onRequestClose={() => setVerifyOrder(null)}>
        <Pressable onPress={() => setVerifyOrder(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: ORANGE + '26', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={22} color={ORANGE} />
              </View>
              <PressableScale onPress={() => { feedback.tap(); setVerifyOrder(null); }} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#252a34', alignItems: 'center', justifyContent: 'center' }}>
                <X size={17} color={Palette.textMuted} />
              </PressableScale>
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>Verify the handoff</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textMuted, lineHeight: 19 }}>
              Ask {verifyOrder?.customer ?? 'the customer'} for their 3-digit code, or scan their QR with your camera.
            </Text>
            <TextInput
              value={pin}
              onChangeText={(t) => { setPin(t.replace(/\D/g, '').slice(0, 3)); setVerifyMsg(null); }}
              placeholder="•••"
              placeholderTextColor={Palette.textMuted}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
              style={{ height: 64, borderRadius: 16, backgroundColor: '#1d2129', textAlign: 'center', fontSize: 30, letterSpacing: 16, fontFamily: Font.display, color: '#fff' }}
            />
            {verifyMsg ? <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#fca5a5', textAlign: 'center' }}>{verifyMsg}</Text> : null}
            <PressableScale onPress={() => { feedback.tap(); submitPin(); }} disabled={verify.isPending} accessibilityRole="button" accessibilityLabel="Confirm handoff" style={{ height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: verify.isPending ? 0.7 : 1 }}>
              {verify.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Confirm & complete</Text>}
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Propose Terms modal — home cook jobs */}
      <Modal visible={!!proposeTarget} transparent animationType="fade" onRequestClose={() => setProposeTarget(null)}>
        <Pressable onPress={() => setProposeTarget(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: HC + '26', alignItems: 'center', justifyContent: 'center' }}>
                <ChefHat size={20} color={HC_TINT} />
              </View>
              <PressableScale onPress={() => { feedback.tap(); setProposeTarget(null); }} accessibilityRole="button" accessibilityLabel="Close"
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#252a34', alignItems: 'center', justifyContent: 'center' }}>
                <X size={17} color={Palette.textMuted} />
              </PressableScale>
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>Propose your terms</Text>
            {proposeTarget ? (
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, lineHeight: 18 }}>
                {proposeTarget.guestCount} guests · {proposeTarget.requestedDate} · ingredient budget ${proposeTarget.ingredientBudget}
              </Text>
            ) : null}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Your cooking fee ($)</Text>
              <TextInput
                value={cookingFee}
                onChangeText={setCookingFee}
                placeholder="e.g. 120"
                placeholderTextColor={Palette.textMuted}
                keyboardType="numeric"
                style={{ height: 50, borderRadius: 13, backgroundColor: '#1d2129', paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: '#fff' }}
                accessibilityLabel="Cooking fee"
              />
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Travel / ingredients transport ($) <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>optional</Text></Text>
              <TextInput
                value={travelFee}
                onChangeText={setTravelFee}
                placeholder="e.g. 15"
                placeholderTextColor={Palette.textMuted}
                keyboardType="numeric"
                style={{ height: 50, borderRadius: 13, backgroundColor: '#1d2129', paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: '#fff' }}
                accessibilityLabel="Travel or transport fee"
              />
            </View>
            {proposeTarget && cookingFee ? (
              <View style={{ backgroundColor: HC + '22', borderRadius: 11, padding: 10, gap: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: HC_TINT }}>Customer pays total</Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>
                    ${proposeTarget.ingredientBudget + (parseFloat(cookingFee) || 0) + (parseFloat(travelFee) || 0)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: HC_TINT }}>You receive (cooking fee)</Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: HC_TINT }}>${parseFloat(cookingFee) || 0}</Text>
                </View>
              </View>
            ) : null}
            {termsErr ? <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#fca5a5' }}>{termsErr}</Text> : null}
            <PressableScale onPress={submitTerms} disabled={proposeTerms.isPending} accessibilityRole="button" accessibilityLabel="Send proposal to customer"
              style={{ height: 52, borderRadius: Radius.pill, backgroundColor: HC, alignItems: 'center', justifyContent: 'center', opacity: proposeTerms.isPending ? 0.7 : 1 }}>
              {proposeTerms.isPending ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Send proposal to customer</Text>
              )}
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
