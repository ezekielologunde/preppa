import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check, ChevronLeft, CreditCard, ShoppingBag, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ManageRequestModal, RequestCard, cleanBlock } from '@/components/bid-request-widgets';
import { BidMessageThread } from '@/components/bid-message-thread';
import { PostRequestForm } from '@/components/post-request-form';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAcceptMealBid, useBidStripeCheckout, useMealRequests, useMyRequestsWithBids, usePlaceBid, usePostMealRequest, getBidExpiry, type MealRequest, type MyMealRequest } from '@/lib/queries/bid-requests';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type AgreementTarget = { bid: MyMealRequest['bids'][0]; request: MyMealRequest };

export default function BidRequestsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const isPrepper = prepper?.status === 'approved';
  const paymentsOn = useFeatureEnabled('payments');
  const params = useLocalSearchParams<{ kit?: string }>();
  const kitName = params.kit ? decodeURIComponent(params.kit) : null;

  const [activeTab, setActiveTab] = useState<'browse' | 'mine'>('browse');
  const { data: requests = [], isLoading, isError, refetch } = useMealRequests();
  const { data: myRequests = [], isLoading: myLoading, isError: myError, refetch: refetchMine } = useMyRequestsWithBids(user?.id);
  const postRequest = usePostMealRequest();
  const placeBid = usePlaceBid();
  const acceptBid = useAcceptMealBid();
  const bidCheckout = useBidStripeCheckout();

  const [showPost, setShowPost] = useState(kitName != null);
  const [bidTarget, setBidTarget] = useState<MealRequest | null>(null);
  const [agreementTarget, setAgreementTarget] = useState<AgreementTarget | null>(null);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [manageTarget, setManageTarget] = useState<MyMealRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetch(), refetchMine()]); setRefreshing(false); }


  const [bidPrice, setBidPrice] = useState('');
  const [bidNote, setBidNote] = useState('');
  const [bidErr, setBidErr] = useState<string | null>(null);
  const [payingBidId, setPayingBidId] = useState<string | null>(null);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [expandedBidId, setExpandedBidId] = useState<string | null>(null);
  const calcServiceFee = (t: number) => Math.round(t * 0.1 * 100) / 100;
  async function handleBidPayment(bidId: string, bidTotal: number) {
    setPayingBidId(bidId); setPayErr(null);
    const totalWithFee = Math.round((bidTotal + calcServiceFee(bidTotal)) * 100);
    try {
      const url = await bidCheckout.mutateAsync({ bidId, amountCents: totalWithFee });
      if (Platform.OS === 'web') { window.location.assign(url); }
      else { await WebBrowser.openBrowserAsync(url); await refetchMine(); }
    } catch (e) {
      feedback.error();
      setPayErr(e instanceof Error ? e.message : 'Could not start payment. Please try again.');
    } finally { setPayingBidId(null); }
  }

  async function submitRequest(args: {
    title: string;
    description?: string;
    servings: number;
    budgetPerServing?: number;
    diets: string[];
  }) {
    if (!user) throw new Error('Not authenticated');
    await postRequest.mutateAsync({
      title: args.title,
      description: args.description,
      servings: args.servings,
      budgetPerServing: args.budgetPerServing,
    });
    await refetch();
  }

  function closePostModal() { setShowPost(false); }
  function closeBidModal() { setBidTarget(null); setBidErr(null); }

  async function submitBid() {
    const price = parseFloat(bidPrice.replace(/[^0-9.]/g, ''));
    if (!price || price <= 0 || !bidTarget || !prepper) return;
    setBidErr(null);
    try {
      await placeBid.mutateAsync({
        requestId: bidTarget.id, prepperId: prepper.id,
        pricePerServing: price,
        note: cleanBlock(bidNote).trim().slice(0, 300) || undefined,
      });
      feedback.success();
      setBidTarget(null); setBidPrice(''); setBidNote('');
    } catch {
      feedback.error();
      setBidErr('Could not submit bid. Please try again.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 12 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} accessibilityRole="button" accessibilityLabel="Back"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5, flex: 1 }}>{isPrepper ? 'meal requests' : 'requests'}</Text>
          {!isPrepper ? (
            <PressableScale onPress={() => { feedback.tap(); setShowPost(true); }} accessibilityRole="button" accessibilityLabel="Post a request"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', lineHeight: 24 }}>+</Text>
            </PressableScale>
          ) : null}
        </View>

        {/* Customer tab bar — Browse open requests OR My requests */}
        {!isPrepper && (
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}>
            {([['browse', 'Browse'], ['mine', 'My requests']] as const).map(([key, label]) => {
              const active = activeTab === key;
              return (
                <PressableScale
                  key={key}
                  onPress={() => { feedback.tap(); setActiveTab(key); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  style={{
                    height: 38,
                    paddingHorizontal: 18,
                    borderRadius: Radius.pill,
                    backgroundColor: active ? ORANGE : Palette.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: active ? '#fff' : Palette.textSecondary }}>
                    {label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        )}


        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {/* Prepper view: browse all open requests to bid on */}
          {(isPrepper || (!isPrepper && activeTab === 'browse')) ? (
            isLoading ? <ListSkeleton count={4} /> : isError ? (
              <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
                style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                  <ShoppingBag size={28} color={Palette.textSecondary} />
                </View>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load requests</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Check your connection and try again.</Text>
                <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading requests"
                  style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
                </PressableScale>
              </MotiView>
            ) : requests.length === 0 ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}
                style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 18, color: INK }}>no open requests</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>
                  {isPrepper ? 'Check back later — customers post new requests daily.' : 'Be the first — post a custom request for local chefs to bid on.'}
                </Text>
                {!isPrepper && (
                  <PressableScale onPress={() => { feedback.tap(); setShowPost(true); }} accessibilityRole="button" accessibilityLabel="Post a request"
                    style={{ marginTop: 8, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Post a request</Text>
                  </PressableScale>
                )}
              </MotiView>
            ) : requests.map((r, i) => (
              <MotiView key={r.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                <RequestCard r={r} isPrepper={isPrepper} onBid={(req) => { feedback.tap(); setBidTarget(req); }} />
              </MotiView>
            ))
          ) : null}

          {/* Customer "mine" tab: their own requests + bids received */}
          {(!isPrepper && activeTab === 'mine') ? (
            myLoading ? <ListSkeleton count={3} /> : myError ? (
              <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
                style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                  <ShoppingBag size={28} color={Palette.textSecondary} />
                </View>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load your requests</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Check your connection and try again.</Text>
                <PressableScale onPress={() => { feedback.tap(); void refetchMine(); }} accessibilityRole="button" accessibilityLabel="Retry loading your requests"
                  style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
                </PressableScale>
              </MotiView>
            ) : myRequests.length === 0 ? (
              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}
                style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 18, color: INK }}>no requests yet</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>
                  Post a request and preppers in your area will bid. Tap the + button above.
                </Text>
              </MotiView>
            ) : myRequests.map((r, i) => (
              <MotiView key={r.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 45 }}>
                <PressableScale onPress={() => { feedback.tap(); setManageTarget(r); }} accessibilityRole="button" accessibilityLabel={`Manage request: ${r.title}`}
                  style={{ backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 10, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, flex: 1 }}>{r.title}</Text>
                    <View style={{ backgroundColor: r.status === 'open' ? Palette.brandTint : Palette.success + '1A', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: r.status === 'open' ? ORANGE : Palette.success, textTransform: 'capitalize' }}>{r.status}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>
                    {r.servings} servings{r.budget_per_serving ? ` · $${r.budget_per_serving}/serving budget` : ''}
                  </Text>
                  <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
                    {r.bids.length ? `${r.bids.length} bid${r.bids.length === 1 ? '' : 's'} received` : 'Waiting for bids'}
                  </Text>
                  {r.bids.map((b) => {
                    const bidTotal = b.pricePerServing * r.servings;
                    const fee = calcServiceFee(bidTotal);
                    const grandTotal = bidTotal + fee;
                    const isPaying = payingBidId === b.id;
                    const expiry = getBidExpiry(b.created_at ?? r.created_at, null);
                    const isThreadOpen = expandedBidId === b.id;
                    return (
                      <View key={b.id} style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: Palette.divider, gap: 10, opacity: expiry.expired ? 0.6 : 1 }}>
                        {/* Expiry chip */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{
                            borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3,
                            backgroundColor: expiry.expired ? Palette.divider : expiry.urgent ? '#FEF3C7' : Palette.chip,
                          }}>
                            <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: expiry.expired ? Palette.textSecondary : expiry.urgent ? '#B45309' : Palette.textSecondary }}>
                              {expiry.expired ? 'expired' : `⏱ ${expiry.label}`}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{b.prepperName}</Text>
                            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>${bidTotal.toFixed(2)} total · ${b.pricePerServing}/serving</Text>
                            {b.note ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }} numberOfLines={2}>{b.note}</Text> : null}
                          </View>
                          {b.status !== 'accepted' ? (
                            r.status === 'open' && b.status === 'pending' ? (
                              <PressableScale onPress={() => { feedback.tap(); setAgreementTarget({ bid: b, request: r }); }} accessibilityRole="button" accessibilityLabel={`Review bid from ${b.prepperName}`}
                                style={{ paddingHorizontal: 14, height: 38, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontFamily: Font.heading, fontSize: 13, color: '#fff' }}>Review</Text>
                              </PressableScale>
                            ) : (
                              <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary, textTransform: 'capitalize' }}>{b.status}</Text>
                            )
                          ) : null}
                        </View>
                        {/* Message thread toggle */}
                        {!expiry.expired ? (
                          <PressableScale
                            onPress={() => { feedback.tap(); setExpandedBidId(isThreadOpen ? null : b.id); }}
                            accessibilityRole="button"
                            accessibilityLabel={isThreadOpen ? 'Close message thread' : 'Open message thread'}
                            style={{ alignSelf: 'flex-start', paddingHorizontal: 12, height: 32, borderRadius: Radius.pill, backgroundColor: Palette.canvas, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: INK }}>
                              {isThreadOpen ? 'Close thread' : 'Message'}
                            </Text>
                          </PressableScale>
                        ) : null}
                        {isThreadOpen && user ? (
                          <BidMessageThread bidId={b.id} currentUserId={user.id} />
                        ) : null}
                        {b.status === 'accepted' && paymentsOn ? (
                          <View style={{ backgroundColor: Palette.canvas, borderRadius: 14, padding: 14, gap: 8 }}>
                            <Text style={{ fontFamily: Font.heading, fontSize: 11, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>payment summary</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Bid price</Text>
                              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>${bidTotal.toFixed(2)}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Platform fee (10%)</Text>
                              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>${fee.toFixed(2)}</Text>
                            </View>
                            <View style={{ height: 1, backgroundColor: Palette.divider }} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Total</Text>
                              <Text style={{ fontFamily: Font.display, fontSize: 17, color: ORANGE, letterSpacing: -0.3 }}>${grandTotal.toFixed(2)}</Text>
                            </View>
                            {payErr && payingBidId === null ? (
                              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger }}>{payErr}</Text>
                            ) : null}
                            <PressableScale
                              onPress={() => { feedback.tap(); void handleBidPayment(b.id, bidTotal); }}
                              disabled={isPaying}
                              accessibilityRole="button"
                              accessibilityLabel="Pay to unlock proposal"
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 46, borderRadius: Radius.pill, backgroundColor: ORANGE, opacity: isPaying ? 0.65 : 1, marginTop: 2 }}>
                              {isPaying
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <>
                                    <CreditCard size={16} color="#fff" strokeWidth={2.2} />
                                    <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Pay to unlock proposal</Text>
                                  </>}
                            </PressableScale>
                          </View>
                        ) : b.status === 'accepted' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Check size={15} color={Palette.success} strokeWidth={3} />
                            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.success }}>Agreed</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </PressableScale>
              </MotiView>
            ))
          ) : null}
        </ScrollView>

        {/* Post request modal */}
        <Modal visible={showPost} transparent animationType="slide" onRequestClose={closePostModal}>
          <Pressable onPress={closePostModal} accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
              <PostRequestForm
                kitName={kitName}
                onClose={() => { closePostModal(); setActiveTab('mine'); }}
                onSubmit={submitRequest}
                isPending={postRequest.isPending}
              />
            </Pressable>
          </Pressable>
        </Modal>

        {/* Bid modal */}
        <Modal visible={!!bidTarget} transparent animationType="slide" onRequestClose={closeBidModal}>
          <Pressable onPress={closeBidModal} accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '80%' }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4, flex: 1 }} numberOfLines={1}>{bidTarget?.title}</Text>
                  <PressableScale onPress={() => { feedback.tap(); closeBidModal(); }} accessibilityRole="button" accessibilityLabel="Close"
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} color={Palette.inkSoft} />
                  </PressableScale>
                </View>
                {bidTarget?.description ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{bidTarget.description}</Text> : null}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>
                    Your price per serving{bidTarget?.budget_per_serving != null ? ` (customer budget: $${bidTarget.budget_per_serving})` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' }}>
                    <View style={{ paddingHorizontal: 12, height: 50, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: Palette.border }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>$</Text>
                    </View>
                    <TextInput value={bidPrice} onChangeText={(t) => setBidPrice(t.replace(/[^0-9.]/g, ''))}
                      placeholder="e.g. 15.00" placeholderTextColor={Palette.textSecondary} keyboardType="decimal-pad" maxLength={7}
                      style={{ flex: 1, height: 50, paddingHorizontal: 12, fontFamily: Font.body, fontSize: 15, color: INK }}
                      accessibilityLabel="Price per serving" />
                  </View>
                  {bidPrice && bidTarget ? (
                    <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: ORANGE }}>
                      Total for {bidTarget.servings} servings: ${(parseFloat(bidPrice) * bidTarget.servings).toFixed(2)}
                    </Text>
                  ) : null}
                </View>
                <TextInput value={bidNote} onChangeText={(t) => setBidNote(cleanBlock(t))} multiline maxLength={300}
                  placeholder="Message to the customer (optional)" placeholderTextColor={Palette.textSecondary}
                  accessibilityLabel="Bid note"
                  style={{ minHeight: 70, backgroundColor: Palette.canvas, borderRadius: 14, padding: 14, fontFamily: Font.body, fontSize: 14, color: INK, textAlignVertical: 'top', borderWidth: 1, borderColor: Palette.border }} />
                {bidErr ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.danger, textAlign: 'center' }}>{bidErr}</Text> : null}
                <PressableScale onPress={submitBid} disabled={placeBid.isPending || !bidPrice} accessibilityRole="button" accessibilityLabel="Submit bid"
                  style={{ height: 54, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: placeBid.isPending || !bidPrice ? 0.6 : 1 }}>
                  {placeBid.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>submit bid</Text>}
                </PressableScale>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <ManageRequestModal
          request={manageTarget}
          onClose={() => setManageTarget(null)}
          onReviewBid={(bid, request) => { setManageTarget(null); setAgreementTarget({ bid, request }); }}
        />

        {/* Agreement modal */}
        <Modal visible={!!agreementTarget} transparent animationType="slide" onRequestClose={() => { setAgreementTarget(null); setAgreementError(null); }}>
          <Pressable onPress={() => { setAgreementTarget(null); setAgreementError(null); }} accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5 }}>review & agree</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>Bid from {agreementTarget?.bid.prepperName}</Text>
                  </View>
                  <PressableScale onPress={() => { feedback.tap(); setAgreementTarget(null); setAgreementError(null); }} accessibilityRole="button" accessibilityLabel="Close"
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} color={Palette.inkSoft} />
                  </PressableScale>
                </View>
                <View style={{ backgroundColor: Palette.canvas, borderRadius: 16, padding: 16, gap: 10 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>order summary</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>Price per serving</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>${agreementTarget?.bid.pricePerServing.toFixed(2)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>Servings</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>×{agreementTarget?.request.servings}</Text>
                  </View>
                  {(() => {
                    const bt = (agreementTarget?.bid.pricePerServing ?? 0) * (agreementTarget?.request.servings ?? 1);
                    const fee = paymentsOn ? calcServiceFee(bt) : 0;
                    return paymentsOn ? (
                      <>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>Bid price</Text>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>${bt.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>Platform fee (10%)</Text>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>${fee.toFixed(2)}</Text>
                        </View>
                        <View style={{ height: 1, backgroundColor: Palette.divider }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>Total</Text>
                          <Text style={{ fontFamily: Font.display, fontSize: 20, color: ORANGE, letterSpacing: -0.4 }}>${(bt + fee).toFixed(2)}</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={{ height: 1, backgroundColor: Palette.divider }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>Total</Text>
                          <Text style={{ fontFamily: Font.display, fontSize: 20, color: ORANGE, letterSpacing: -0.4 }}>${bt.toFixed(2)}</Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
                {agreementTarget?.bid.note ? (
                  <View style={{ backgroundColor: Palette.canvas, borderRadius: 14, padding: 14 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Note from prepper</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20 }}>{agreementTarget.bid.note}</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: paymentsOn ? Palette.brandTint : Palette.canvas, borderRadius: 14, padding: 14 }}>
                  <ShoppingBag size={16} color={paymentsOn ? ORANGE : Palette.textSecondary} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: paymentsOn ? ORANGE : Palette.textSecondary, lineHeight: 19 }}>
                    {paymentsOn ? 'Payment is secured via Stripe and only collected when you tap Agree & Pay. You can cancel before the prepper starts cooking.' : 'Pay when confirmed — no charge until your prepper confirms the order.'}
                  </Text>
                </View>
                {agreementError ? (
                  <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#991B1B' }}>{agreementError}</Text>
                  </View>
                ) : null}
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, textAlign: 'center', lineHeight: 17 }}>
                  By tapping below you agree to Preppa's Terms of Service. Both parties are bound to fulfil this agreement.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <PressableScale onPress={() => { feedback.tap(); setAgreementTarget(null); setAgreementError(null); }} accessibilityRole="button" accessibilityLabel="Cancel"
                    style={{ flex: 1, height: 52, borderRadius: Radius.pill, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Palette.divider }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Cancel</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={async () => {
                      if (!agreementTarget) return;
                      setAgreementError(null);
                      try {
                        await acceptBid.mutateAsync({ bidId: agreementTarget.bid.id, requestId: agreementTarget.request.id });
                        feedback.success();
                        const target = agreementTarget;
                        setAgreementTarget(null);
                        if (paymentsOn) {
                          const bidTotal = target.bid.pricePerServing * target.request.servings;
                          await handleBidPayment(target.bid.id, bidTotal);
                        }
                      } catch (e) {
                        feedback.error();
                        const msg = e instanceof Error ? e.message : '';
                        if (msg.includes('bid_already_processed')) setAgreementError('This bid was already accepted by someone else.');
                        else if (msg.includes('request_not_open')) setAgreementError('This request has already been fulfilled.');
                        else if (msg.includes('forbidden')) setAgreementError('Only the request owner can accept bids.');
                        else setAgreementError('Could not accept bid. Please try again.');
                      }
                    }}
                    disabled={acceptBid.isPending || bidCheckout.isPending} accessibilityRole="button" accessibilityLabel={paymentsOn ? 'Agree and pay' : 'Agree and book'}
                    style={{ flex: 2, height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: (acceptBid.isPending || bidCheckout.isPending) ? 0.7 : 1 }}>
                    {(acceptBid.isPending || bidCheckout.isPending) ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>{paymentsOn ? 'Agree & Pay' : 'Agree & Book'}</Text>}
                  </PressableScale>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
