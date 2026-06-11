import { useRouter } from 'expo-router';
import { ChevronLeft, Clock, DollarSign, Plus, Users, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMealRequests, usePlaceBid, usePostMealRequest, type MealRequest } from '@/lib/queries/bid-requests';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type Request = MealRequest;

function RequestCard({ r, isPrepper, onBid }: { r: Request; isPrepper: boolean; onBid: (r: Request) => void }) {
  return (
    <View style={{ backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 10, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>{r.title}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 3, lineHeight: 19 }}>{r.description}</Text>
        </View>
        {r.bid_count > 0 ? (
          <View style={{ backgroundColor: Palette.brandTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>{r.bid_count} bid{r.bid_count === 1 ? '' : 's'}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Users size={13} color={Palette.textMuted} />
          <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>{r.servings} servings</Text>
        </View>
        {r.budget_per_serving != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <DollarSign size={13} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>${r.budget_per_serving}/serving budget</Text>
          </View>
        ) : null}
        {r.deadline ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={13} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>by {new Date(r.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>from {r.poster}{r.cuisine ? ` · ${r.cuisine}` : ''}</Text>
        {isPrepper ? (
          <PressableScale onPress={() => onBid(r)} accessibilityRole="button" accessibilityLabel={`Bid on ${r.title}`}
            style={{ height: 38, paddingHorizontal: 18, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>place bid</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

export default function BidRequestsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const isPrepper = prepper?.status === 'approved';

  const { data: requests = [], isLoading, refetch } = useMealRequests();
  const postRequest = usePostMealRequest();
  const placeBid = usePlaceBid();

  const [showPost, setShowPost] = useState(false);
  const [bidTarget, setBidTarget] = useState<Request | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  // Post request form state
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqServings, setReqServings] = useState('');
  const [reqBudget, setReqBudget] = useState('');

  // Bid form state
  const [bidPrice, setBidPrice] = useState('');
  const [bidNote, setBidNote] = useState('');

  async function submitRequest() {
    if (!reqTitle.trim() || !user) return;
    await postRequest.mutateAsync({
      customerId: user.id,
      title: reqTitle,
      description: reqDesc || undefined,
      servings: Math.max(1, parseInt(reqServings, 10) || 1),
      budgetPerServing: reqBudget ? parseFloat(reqBudget) : undefined,
    });
    feedback.success();
    setShowPost(false);
    setReqTitle(''); setReqDesc(''); setReqServings(''); setReqBudget('');
  }

  async function submitBid() {
    if (!bidPrice || !bidTarget || !prepper) return;
    await placeBid.mutateAsync({
      requestId: bidTarget.id,
      prepperId: prepper.id,
      pricePerServing: parseFloat(bidPrice),
      note: bidNote || undefined,
    });
    feedback.success();
    setBidTarget(null);
    setBidPrice(''); setBidNote('');
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 12 }}>
          <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={24} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>meal requests</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>
              {isPrepper ? 'bid on open requests from customers' : 'post a request — preppers will bid'}
            </Text>
          </View>
          {!isPrepper ? (
            <PressableScale onPress={() => { feedback.tap(); setShowPost(true); }} accessibilityRole="button" accessibilityLabel="Post a request"
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} color="#fff" />
            </PressableScale>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {isLoading ? (
            <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
          ) : requests.length === 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}
              style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 18, color: INK }}>no open requests</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>
                {isPrepper ? 'Check back later — customers post new requests daily.' : 'Post the first one! Preppers in your area will bid.'}
              </Text>
            </MotiView>
          ) : (
            requests.map((r, i) => (
              <MotiView key={r.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                <RequestCard r={r} isPrepper={isPrepper} onBid={(req) => { feedback.tap(); setBidTarget(req); }} />
              </MotiView>
            ))
          )}
        </ScrollView>

        {/* Post request modal */}
        <Modal visible={showPost} transparent animationType="slide" onRequestClose={() => setShowPost(false)}>
          <Pressable onPress={() => setShowPost(false)} style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>post a meal request</Text>
              <TextInput value={reqTitle} onChangeText={setReqTitle} placeholder="What do you need? (e.g. Jerk chicken meal prep)" placeholderTextColor={Palette.textMuted}
                style={{ height: 50, backgroundColor: Palette.canvas, borderRadius: 14, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK }} />
              <TextInput value={reqDesc} onChangeText={setReqDesc} placeholder="Details — servings, dietary needs, deadline…" placeholderTextColor={Palette.textMuted} multiline
                style={{ minHeight: 80, backgroundColor: Palette.canvas, borderRadius: 14, padding: 14, fontFamily: Font.body, fontSize: 14, color: INK, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput value={reqServings} onChangeText={setReqServings} placeholder="Servings" placeholderTextColor={Palette.textMuted} keyboardType="number-pad"
                  style={{ flex: 1, height: 50, backgroundColor: Palette.canvas, borderRadius: 14, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK }} />
                <TextInput value={reqBudget} onChangeText={setReqBudget} placeholder="$ budget / serving" placeholderTextColor={Palette.textMuted} keyboardType="decimal-pad"
                  style={{ flex: 1, height: 50, backgroundColor: Palette.canvas, borderRadius: 14, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK }} />
              </View>
              <PressableScale onPress={submitRequest} disabled={postRequest.isPending || !reqTitle.trim()} accessibilityRole="button" accessibilityLabel="Submit request"
                style={{ height: 54, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: postRequest.isPending || !reqTitle.trim() ? 0.6 : 1 }}>
                {postRequest.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>post request</Text>}
              </PressableScale>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Bid modal */}
        <Modal visible={!!bidTarget} transparent animationType="slide" onRequestClose={() => setBidTarget(null)}>
          <Pressable onPress={() => setBidTarget(null)} style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4, flex: 1 }} numberOfLines={1}>{bidTarget?.title}</Text>
                <PressableScale onPress={() => setBidTarget(null)} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} color={Palette.inkSoft} />
                </PressableScale>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{bidTarget?.description}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK, marginBottom: 6 }}>your price per serving ($)</Text>
                  <TextInput value={bidPrice} onChangeText={setBidPrice} placeholder={bidTarget?.budget_per_serving != null ? `budget: $${bidTarget.budget_per_serving}/serving` : 'your price per serving'} placeholderTextColor={Palette.textMuted} keyboardType="decimal-pad"
                    style={{ height: 50, backgroundColor: Palette.canvas, borderRadius: 14, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK }} />
                </View>
              </View>
              <TextInput value={bidNote} onChangeText={setBidNote} placeholder="Message to the customer (optional)" placeholderTextColor={Palette.textMuted} multiline
                style={{ minHeight: 70, backgroundColor: Palette.canvas, borderRadius: 14, padding: 14, fontFamily: Font.body, fontSize: 14, color: INK, textAlignVertical: 'top' }} />
              <PressableScale onPress={submitBid} disabled={placeBid.isPending || !bidPrice} accessibilityRole="button" accessibilityLabel="Submit bid"
                style={{ height: 54, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: placeBid.isPending || !bidPrice ? 0.6 : 1 }}>
                {placeBid.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>submit bid</Text>}
              </PressableScale>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
