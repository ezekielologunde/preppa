import { useRouter } from 'expo-router';
import { Check, ChevronLeft, ShoppingBag, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BudgetPerServingPicker, ManageRequestModal, RequestCard, Stepper, cleanBlock, cleanLine } from '@/components/bid-request-widgets';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAcceptMealBid, useMealRequests, useMyRequestsWithBids, usePlaceBid, usePostMealRequest, type MealRequest, type MyMealRequest } from '@/lib/queries/bid-requests';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type AgreementTarget = { bid: MyMealRequest['bids'][0]; request: MyMealRequest };
type PostedRequest = { title: string; servings: number; budget: number | null };

export default function BidRequestsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const isPrepper = prepper?.status === 'approved';
  const paymentsOn = useFeatureEnabled('payments');

  const [activeTab, setActiveTab] = useState<'browse' | 'mine'>('browse');
  const { data: requests = [], isLoading, isError, refetch } = useMealRequests();
  const { data: myRequests = [], isLoading: myLoading, isError: myError, refetch: refetchMine } = useMyRequestsWithBids(user?.id);
  const postRequest = usePostMealRequest();
  const placeBid = usePlaceBid();
  const acceptBid = useAcceptMealBid();

  const [showPost, setShowPost] = useState(false);
  const [bidTarget, setBidTarget] = useState<MealRequest | null>(null);
  const [agreementTarget, setAgreementTarget] = useState<AgreementTarget | null>(null);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [manageTarget, setManageTarget] = useState<MyMealRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetch(), refetchMine()]); setRefreshing(false); }

  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqServings, setReqServings] = useState(4);
  const [reqBudget, setReqBudget] = useState<number | null>(null);
  const [postErr, setPostErr] = useState<string | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);
  const [postSuccess, setPostSuccess] = useState<PostedRequest | null>(null);

  const [bidPrice, setBidPrice] = useState('');
  const [bidNote, setBidNote] = useState('');
  const [bidErr, setBidErr] = useState<string | null>(null);

  async function submitRequest() {
    setPostErr(null);
    const t = cleanLine(reqTitle).trim();
    if (!t || !user) return;
    if (t.length < 3) { setTitleTouched(true); return setPostErr('Give your request a title (at least 3 characters).'); }
    try {
      await postRequest.mutateAsync({
        customerId: user.id, title: t.slice(0, 100),
        description: cleanBlock(reqDesc).trim().slice(0, 500) || undefined,
        servings: reqServings, budgetPerServing: reqBudget ?? undefined,
      });
      feedback.success();
      setPostSuccess({ title: t.slice(0, 100), servings: reqServings, budget: reqBudget });
      setReqTitle(''); setReqDesc(''); setReqServings(4); setReqBudget(null);
    } catch (e) {
      feedback.error();
      setPostErr(e instanceof Error ? e.message : 'Could not post request.');
    }
  }

  function closePostModal() { setShowPost(false); setPostSuccess(null); setTitleTouched(false); setPostErr(null); }
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
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5, flex: 1 }}>meal requests</Text>
          {!isPrepper ? (
            <PressableScale onPress={() => { feedback.tap(); setShowPost(true); }} accessibilityRole="button" accessibilityLabel="Post a request"
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              {/* Plus icon inline — keeps import list small */}
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', lineHeight: 24 }}>+</Text>
            </PressableScale>
          ) : null}
        </View>

        {!isPrepper ? (
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: Palette.surface, borderRadius: Radius.pill, padding: 3 }}>
            {(['browse', 'mine'] as const).map((t) => (
              <PressableScale key={t} onPress={() => { feedback.tap(); setActiveTab(t); }} accessibilityRole="tab" accessibilityState={{ selected: activeTab === t }}
                style={{ flex: 1, height: 36, borderRadius: Radius.pill, backgroundColor: activeTab === t ? ORANGE : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: activeTab === t ? '#fff' : Palette.textMuted }}>
                  {t === 'browse' ? 'browse all' : 'my requests'}
                </Text>
              </PressableScale>
            ))}
          </View>
        ) : null}

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {(isPrepper || activeTab === 'browse') ? (
            isLoading ? <ListSkeleton count={4} /> : isError ? (
              <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
                style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingBag size={28} color={Palette.textMuted} />
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
                  {isPrepper ? 'Check back later — customers post new requests daily.' : 'Post the first one! Preppers in your area will bid.'}
                </Text>
              </MotiView>
            ) : requests.map((r, i) => (
              <MotiView key={r.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                <RequestCard r={r} isPrepper={isPrepper} onBid={(req) => { feedback.tap(); setBidTarget(req); }} />
              </MotiView>
            ))
          ) : null}

          {!isPrepper && activeTab === 'mine' ? (
            myLoading ? <ListSkeleton count={3} /> : myError ? (
              <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
                style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingBag size={28} color={Palette.textMuted} />
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
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted }}>
                    {r.servings} servings{r.budget_per_serving ? ` · $${r.budget_per_serving}/serving budget` : ''}
                  </Text>
                  <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
                    {r.bids.length ? `${r.bids.length} bid${r.bids.length === 1 ? '' : 's'} received` : 'Waiting for bids'}
                  </Text>
                  {r.bids.map((b) => (
                    <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Palette.divider }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{b.prepperName}</Text>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>${(b.pricePerServing * r.servings).toFixed(2)} total · ${b.pricePerServing}/serving</Text>
                        {b.note ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }} numberOfLines={2}>{b.note}</Text> : null}
                      </View>
                      {b.status === 'accepted' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Check size={15} color={Palette.success} strokeWidth={3} />
                          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.success }}>Agreed</Text>
                        </View>
                      ) : r.status === 'open' && b.status === 'pending' ? (
                        <PressableScale onPress={() => { feedback.tap(); setAgreementTarget({ bid: b, request: r }); }} accessibilityRole="button" accessibilityLabel={`Review bid from ${b.prepperName}`}
                          style={{ paddingHorizontal: 14, height: 38, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.heading, fontSize: 13, color: '#fff' }}>Review</Text>
                        </PressableScale>
                      ) : (
                        <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textMuted, textTransform: 'capitalize' }}>{b.status}</Text>
                      )}
                    </View>
                  ))}
                </PressableScale>
              </MotiView>
            ))
          ) : null}
        </ScrollView>

        {/* Post request modal */}
        <Modal visible={showPost} transparent animationType="slide" onRequestClose={closePostModal}>
          <Pressable onPress={closePostModal} accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' }}>
              {postSuccess ? (
                <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}
                  style={{ padding: 28, gap: 20, alignItems: 'center' }}>
                  <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: Palette.success + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={34} color={Palette.success} strokeWidth={2.5} />
                    </View>
                  </MotiView>
                  <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6, textAlign: 'center' }}>Request posted!</Text>
                  <View style={{ width: '100%', backgroundColor: Palette.canvas, borderRadius: 18, padding: 16, gap: 10 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 11, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>your request</Text>
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>{postSuccess.title}</Text>
                    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>{postSuccess.servings} servings</Text>
                      {postSuccess.budget != null ? <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>${postSuccess.budget}/serving budget</Text> : null}
                    </View>
                    <View style={{ backgroundColor: Palette.brandTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>Open · accepting bids</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                    Preppers in your area will see your request and send bids. You'll be notified when one arrives.
                  </Text>
                  <PressableScale onPress={() => { feedback.tap(); closePostModal(); setActiveTab('mine'); }} accessibilityRole="button" accessibilityLabel="View my requests"
                    style={{ width: '100%', height: 54, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>view my requests →</Text>
                  </PressableScale>
                </MotiView>
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>post a meal request</Text>
                    <PressableScale onPress={closePostModal} accessibilityRole="button" accessibilityLabel="Close"
                      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                      <X size={17} color={Palette.inkSoft} />
                    </PressableScale>
                  </View>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>Title <Text style={{ color: Palette.danger }}>*</Text></Text>
                    <TextInput value={reqTitle} onChangeText={(t) => setReqTitle(cleanLine(t))} onBlur={() => setTitleTouched(true)}
                      maxLength={100} placeholder="e.g. Jerk chicken meal prep for 4" placeholderTextColor={Palette.textMuted}
                      accessibilityLabel="Request title"
                      style={{ height: 50, backgroundColor: Palette.canvas, borderRadius: 14, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK, borderWidth: 1.5, borderColor: titleTouched && reqTitle.trim().length < 3 ? Palette.danger : Palette.border }} />
                    {titleTouched && reqTitle.trim().length < 3
                      ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger }}>At least 3 characters required</Text>
                      : <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted, textAlign: 'right' }}>{reqTitle.length}/100</Text>}
                  </View>
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>Details <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>(optional)</Text></Text>
                    <TextInput value={reqDesc} onChangeText={(t) => setReqDesc(cleanBlock(t))} multiline maxLength={500}
                      placeholder="Dietary needs, preferred cuisine, deadline…" placeholderTextColor={Palette.textMuted}
                      accessibilityLabel="Request details"
                      style={{ minHeight: 80, backgroundColor: Palette.canvas, borderRadius: 14, padding: 14, fontFamily: Font.body, fontSize: 14, color: INK, textAlignVertical: 'top', borderWidth: 1, borderColor: Palette.border }} />
                    <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted, textAlign: 'right' }}>{reqDesc.length}/500</Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>Number of servings</Text>
                    <Stepper value={reqServings} onChange={setReqServings} min={1} max={100} />
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>Budget per serving <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>(optional)</Text></Text>
                    <BudgetPerServingPicker value={reqBudget} onChange={setReqBudget} />
                  </View>
                  {postErr ? (
                    <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#991B1B' }}>{postErr}</Text>
                    </View>
                  ) : null}
                  <PressableScale onPress={submitRequest} disabled={postRequest.isPending || reqTitle.trim().length < 3} accessibilityRole="button" accessibilityLabel="Submit request"
                    style={{ height: 54, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: postRequest.isPending || reqTitle.trim().length < 3 ? 0.5 : 1 }}>
                    {postRequest.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>post request</Text>}
                  </PressableScale>
                </ScrollView>
              )}
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
                      placeholder="e.g. 15.00" placeholderTextColor={Palette.textMuted} keyboardType="decimal-pad" maxLength={7}
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
                  placeholder="Message to the customer (optional)" placeholderTextColor={Palette.textMuted}
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
                  <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>order summary</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>Price per serving</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>${agreementTarget?.bid.pricePerServing.toFixed(2)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>Servings</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>×{agreementTarget?.request.servings}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: Palette.divider }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>Total</Text>
                    <Text style={{ fontFamily: Font.display, fontSize: 20, color: ORANGE, letterSpacing: -0.4 }}>
                      ${((agreementTarget?.bid.pricePerServing ?? 0) * (agreementTarget?.request.servings ?? 1)).toFixed(2)}
                    </Text>
                  </View>
                </View>
                {agreementTarget?.bid.note ? (
                  <View style={{ backgroundColor: Palette.canvas, borderRadius: 14, padding: 14 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Note from prepper</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20 }}>{agreementTarget.bid.note}</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: paymentsOn ? Palette.brandTint : Palette.canvas, borderRadius: 14, padding: 14 }}>
                  <ShoppingBag size={16} color={paymentsOn ? ORANGE : Palette.textMuted} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: paymentsOn ? ORANGE : Palette.textSecondary, lineHeight: 19 }}>
                    {paymentsOn ? 'Payment is secured via Stripe and only collected when you tap Agree & Pay. You can cancel before the prepper starts cooking.' : 'Pay when confirmed — no charge until your prepper confirms the order.'}
                  </Text>
                </View>
                {agreementError ? (
                  <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#991B1B' }}>{agreementError}</Text>
                  </View>
                ) : null}
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, textAlign: 'center', lineHeight: 17 }}>
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
                        setAgreementTarget(null);
                      } catch (e) {
                        feedback.error();
                        const msg = e instanceof Error ? e.message : '';
                        if (msg.includes('bid_already_processed')) setAgreementError('This bid was already accepted by someone else.');
                        else if (msg.includes('request_not_open')) setAgreementError('This request has already been fulfilled.');
                        else if (msg.includes('forbidden')) setAgreementError('Only the request owner can accept bids.');
                        else setAgreementError('Could not accept bid. Please try again.');
                      }
                    }}
                    disabled={acceptBid.isPending} accessibilityRole="button" accessibilityLabel={paymentsOn ? 'Agree and pay' : 'Agree and book'}
                    style={{ flex: 2, height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: acceptBid.isPending ? 0.7 : 1 }}>
                    {acceptBid.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>{paymentsOn ? 'Agree & Pay' : 'Agree & Book'}</Text>}
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
