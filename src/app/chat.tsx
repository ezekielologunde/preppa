import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarCheck, ChefHat, ChevronLeft, ChevronRight, MessageCircle, Phone, Receipt, Send, Users, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { Palette, Radius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useConfirmHomeCookBooking, useProposeHomeCookTerms } from '@/lib/queries/home-cook';
import { useChatContext, useMessages, useSendMessage } from '@/lib/queries/messages';
import { useAuth } from '@/providers/auth-provider';

const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

const HC = Palette.homeCook;
const HC_TINT = Palette.homeCookTint;

const ORANGE = Palette.brand;
const INK = Palette.ink;

/** Centered "2:34 PM" / "Mon 2:34 PM" caption shown when >20 min passed. */
function timeLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? time : `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
}

const TIME_GAP_MS = 20 * 60 * 1000;

const QUICK_REPLIES: Record<string, string[]> = {
  pending:          ['When will it be ready?', 'Can you confirm?', 'Thank you!'],
  confirmed:        ['How long to prepare?', 'Can I change anything?', 'Thanks!'],
  preparing:        ['How much longer?', "Can't wait!", 'Thank you!'],
  ready:            ["I'm on my way!", 'Can I pick it up now?', 'Amazing!'],
  out_for_delivery: ["I'm home!", 'How far away?', 'Thank you!'],
  completed:        ['It was delicious!', 'Thank you so much!', "Loved it!"],
};

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= BP.desktop;
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { data: messages, isLoading, isError: messagesError, refetch: refetchMessages } = useMessages(id, user?.id);
  const { data: ctx } = useChatContext(id, user?.id);
  const send = useSendMessage();
  const proposeTerms = useProposeHomeCookTerms();
  const confirmBooking = useConfirmHomeCookBooking();
  const [text, setText] = useState('');
  const [sendErr, setSendErr] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [cookingFeeInput, setCookingFeeInput] = useState('');
  const [travelFeeInput, setTravelFeeInput] = useState('');
  const [termsErr, setTermsErr] = useState<string | null>(null);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);

  function call() {
    if (!ctx?.otherPhone) {
      feedback.warning();
      return;
    }
    feedback.tap();
    Linking.openURL(`tel:${ctx.otherPhone}`).catch(() => feedback.error());
  }

  // Mark read on open / when new messages arrive.
  useEffect(() => {
    if (id) supabase.rpc('mark_conversation_read', { p_conversation: id }).then(() => {});
  }, [id, messages?.length]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages?.length]);

  function submit() {
    const body = cleanBlock(text).trim();
    if (!body || !id || !user) return;
    feedback.tap();
    setSendErr(null);
    setText('');
    send.mutate({ conversationId: id, senderId: user.id, body }, {
      onError: () => { feedback.error(); setText(body); setSendErr('Message not sent. Try again.'); },
    });
  }

  function submitTerms() {
    if (!ctx?.homeCookRequest) return;
    const cooking = parseFloat(cookingFeeInput.replace(/[^0-9.]/g, ''));
    const travel = parseFloat(travelFeeInput.replace(/[^0-9.]/g, '') || '0');
    if (!cooking || cooking <= 0) return setTermsErr('Enter a valid cooking fee.');
    setTermsErr(null);
    proposeTerms.mutate(
      { requestId: ctx.homeCookRequest.id, cookingFee: cooking, travelFee: travel || 0 },
      {
        onSuccess: () => { feedback.success(); setShowTermsModal(false); setCookingFeeInput(''); setTravelFeeInput(''); },
        onError: (e) => { feedback.error(); setTermsErr(e instanceof Error ? e.message : 'Could not send proposal.'); },
      },
    );
  }

  function handleConfirmBooking() {
    if (!ctx?.homeCookRequest) return;
    feedback.tap();
    setConfirmErr(null);
    confirmBooking.mutate(ctx.homeCookRequest.id, {
      onSuccess: () => { feedback.success(); },
      onError: () => { feedback.error(); setConfirmErr('Could not confirm booking. Please try again.'); },
    });
  }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/messages'); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={isDesktop ? { flex: 1, maxWidth: 720, alignSelf: 'center', width: '100%' } : { flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Palette.chip }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ flex: 1, fontFamily: Font.heading, fontSize: 17, color: INK }} numberOfLines={1}>{name ?? 'Chat'}</Text>
          {ctx?.otherPhone ? (
            <PressableScale onPress={call} accessibilityRole="button" accessibilityLabel={`Call ${name ?? 'them'}`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={18} color={ORANGE} />
            </PressableScale>
          ) : null}
        </View>

        {/* Home cook negotiation card — shown while terms are being negotiated */}
        {ctx?.homeCookRequest ? (() => {
          const hc = ctx.homeCookRequest!;
          const total = hc.ingredientBudget + (hc.cookingFee ?? 0) + (hc.travelFee ?? 0);
          const termsReady = hc.status === 'negotiating' && hc.cookingFee != null;
          return (
            <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}
              style={{ marginHorizontal: 16, marginTop: 10, backgroundColor: HC_TINT, borderRadius: Radius.md, borderWidth: 1.5, borderColor: HC + '30', overflow: 'hidden' }}>
              {/* Title row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
                <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: HC + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <ChefHat size={15} color={HC} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13, color: HC }}>Home cook booking</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: '#4C1D95' }}>
                    {hc.status === 'pending' ? 'Awaiting terms from prepper' : termsReady ? 'Terms proposed — review and confirm' : 'Negotiating…'}
                  </Text>
                </View>
                <View style={{ backgroundColor: hc.status === 'negotiating' ? HC : '#7C3AED66', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: '#fff', textTransform: 'capitalize' }}>{hc.status}</Text>
                </View>
              </View>
              {/* Details */}
              <View style={{ marginHorizontal: 12, marginBottom: 10, backgroundColor: HC + '12', borderRadius: 10, padding: 10, gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <CalendarCheck size={13} color={HC} />
                  <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: INK }}>{hc.requestedDate} · {hc.requestedTime.replace('_', ' ')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Users size={13} color={HC} />
                  <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: INK }}>{hc.guestCount} guest{hc.guestCount !== 1 ? 's' : ''}{hc.cuisine ? ` · ${hc.cuisine}` : ''}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: HC + '20', marginVertical: 3 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#4C1D95' }}>Ingredients budget</Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: INK }}>${hc.ingredientBudget}</Text>
                </View>
                {hc.cookingFee != null ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#4C1D95' }}>Cooking fee</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: INK }}>${hc.cookingFee}</Text>
                  </View>
                ) : null}
                {hc.travelFee != null && hc.travelFee > 0 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#4C1D95' }}>Travel</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: INK }}>${hc.travelFee}</Text>
                  </View>
                ) : null}
                {termsReady ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: HC + '20', paddingTop: 5, marginTop: 2 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 12.5, color: HC }}>Total</Text>
                    <Text style={{ fontFamily: Font.heading, fontSize: 12.5, color: HC }}>${total}</Text>
                  </View>
                ) : null}
              </View>
              {/* CTA */}
              {hc.iAmPrepper && hc.status === 'pending' ? (
                <PressableScale onPress={() => { feedback.tap(); setShowTermsModal(true); }} accessibilityRole="button" accessibilityLabel="Propose terms"
                  style={{ marginHorizontal: 12, marginBottom: 12, height: 40, borderRadius: 11, backgroundColor: HC, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>Propose terms</Text>
                </PressableScale>
              ) : !hc.iAmPrepper && termsReady ? (
                <View style={{ marginHorizontal: 12, marginBottom: 12, gap: 6 }}>
                  {confirmErr ? <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.danger, textAlign: 'center' }}>{confirmErr}</Text> : null}
                  <PressableScale onPress={handleConfirmBooking} disabled={confirmBooking.isPending} accessibilityRole="button" accessibilityLabel="Accept terms and confirm booking"
                    style={{ height: 40, borderRadius: 11, backgroundColor: HC, alignItems: 'center', justifyContent: 'center', opacity: confirmBooking.isPending ? 0.7 : 1 }}>
                    {confirmBooking.isPending ? <ActivityIndicator color="#fff" size="small" /> : (
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>Accept & confirm booking</Text>
                    )}
                  </PressableScale>
                </View>
              ) : null}
            </MotiView>
          );
        })() : null}

        {/* Shared-order context — the conversation's order details, always in view */}
        {ctx?.order ? (
          <PressableScale
            onPress={() => { feedback.tap(); router.push(ctx.order!.iAmPrepper ? '/prepper-orders' : '/orders'); }}
            accessibilityRole="button"
            accessibilityLabel={`Order ${ctx.order.status}, $${ctx.order.total.toFixed(2)}`}
            style={{ marginHorizontal: 16, marginTop: 10, backgroundColor: Palette.brandTint, borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={17} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 13.5, color: INK }}>
                {ctx.order.firstItem ?? 'Preorder'}{ctx.order.items > 1 ? ` +${ctx.order.items - 1} more` : ''}
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.brandPressed, textTransform: 'capitalize' }}>
                {ctx.order.status.replace(/_/g, ' ')} · ${ctx.order.total.toFixed(2)}
              </Text>
            </View>
            <ChevronRight size={16} color={Palette.brandPressed} />
          </PressableScale>
        ) : null}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
          {isLoading ? (
            <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'flex-end' }}>
              {[['55%', false], ['40%', true], ['65%', false], ['45%', true], ['70%', false]].map(([w, right], i) => (
                <View key={i} style={{ alignSelf: right ? 'flex-end' : 'flex-start' }}>
                  <Skeleton width={w as `${number}%`} height={44} radius={14} />
                </View>
              ))}
            </View>
          ) : messagesError ? (
            <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
              <MessageCircle size={32} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load messages</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>Check your connection and try again.</Text>
              <PressableScale onPress={() => { feedback.tap(); void refetchMessages(); }} accessibilityRole="button" accessibilityLabel="Retry loading messages"
                style={{ marginTop: 4, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 12 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
              </PressableScale>
            </MotiView>
          ) : (
            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, justifyContent: (messages?.length ?? 0) ? 'flex-end' : 'center' }}>
              {!messages?.length ? (
                <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={28} color={Palette.textSecondary} />
                  </View>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Say hello</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 19 }}>
                    No messages yet — send the first one below.
                  </Text>
                </MotiView>
              ) : (
                messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > TIME_GAP_MS;
                  return (
                    <View key={m.id} style={{ gap: 8 }}>
                      {showTime ? (
                        <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.textSecondary, textAlign: 'center', marginVertical: 4 }}>
                          {timeLabel(m.created_at)}
                        </Text>
                      ) : null}
                      <MotiView
                        from={{ opacity: 0, translateY: 6 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 160 }}
                        style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '78%', backgroundColor: m.mine ? ORANGE : Palette.canvas, borderRadius: 18, borderBottomRightRadius: m.mine ? 4 : 18, borderBottomLeftRadius: m.mine ? 18 : 4, paddingHorizontal: 14, paddingVertical: 9 }}>
                        <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: m.mine ? '#fff' : INK, lineHeight: 20 }}>{m.body}</Text>
                      </MotiView>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Quick replies */}
          {!text.trim() && ctx?.order?.status && QUICK_REPLIES[ctx.order.status] ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8 }}>
                {QUICK_REPLIES[ctx.order.status].map((reply) => (
                  <PressableScale key={reply} onPress={() => { feedback.tap(); setText(reply); }} accessibilityRole="button" accessibilityLabel={reply}
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Palette.canvas, borderWidth: 1, borderColor: Palette.chip }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>{reply}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </MotiView>
          ) : null}

          {/* Composer */}
          {sendErr ? (
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.danger, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4 }}>{sendErr}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Palette.chip }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              placeholderTextColor={Palette.textSecondary}
              multiline
              maxLength={2000}
              accessibilityLabel="Type a message"
              style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, backgroundColor: Palette.canvas, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: Font.body, fontSize: 15, color: INK }}
            />
            <PressableScale onPress={submit} disabled={!text.trim() || send.isPending} accessibilityRole="button" accessibilityLabel="Send message"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? ORANGE : Palette.border, alignItems: 'center', justifyContent: 'center' }}>
              {send.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={19} color="#fff" />}
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      {/* Propose terms modal — prepper sets cooking fee + travel fee */}
      <Modal visible={showTermsModal} transparent animationType="fade" onRequestClose={() => setShowTermsModal(false)}>
        <Pressable onPress={() => setShowTermsModal(false)} accessibilityRole="button" accessibilityLabel="Close terms" style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ width: '100%', maxWidth: 360, backgroundColor: Palette.surface, borderRadius: 22, padding: 22, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: HC_TINT, alignItems: 'center', justifyContent: 'center' }}>
                <ChefHat size={20} color={HC} />
              </View>
              <PressableScale onPress={() => { feedback.tap(); setShowTermsModal(false); }} accessibilityRole="button" accessibilityLabel="Close"
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                <X size={17} color={Palette.textSecondary} />
              </PressableScale>
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }}>Propose terms</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 19 }}>
              Set your cooking fee and travel costs. The customer will see the full breakdown before confirming.
            </Text>
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>Cooking fee ($)</Text>
              <TextInput
                value={cookingFeeInput}
                onChangeText={setCookingFeeInput}
                placeholder="e.g. 120"
                placeholderTextColor={Palette.textSecondary}
                keyboardType="numeric"
                maxLength={7}
                style={{ height: 50, borderRadius: 13, backgroundColor: Palette.canvas, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK, borderWidth: 1, borderColor: Palette.border }}
                accessibilityLabel="Cooking fee"
              />
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>Travel / transport ($) <Text style={{ fontFamily: Font.body, color: Palette.textSecondary }}>optional</Text></Text>
              <TextInput
                value={travelFeeInput}
                onChangeText={setTravelFeeInput}
                placeholder="e.g. 15"
                placeholderTextColor={Palette.textSecondary}
                keyboardType="numeric"
                maxLength={7}
                style={{ height: 50, borderRadius: 13, backgroundColor: Palette.canvas, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK, borderWidth: 1, borderColor: Palette.border }}
                accessibilityLabel="Travel fee"
              />
            </View>
            {ctx?.homeCookRequest && cookingFeeInput ? (
              <View style={{ backgroundColor: HC_TINT, borderRadius: 11, padding: 12, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: '#4C1D95' }}>Ingredients (customer's)</Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: INK }}>${ctx.homeCookRequest.ingredientBudget}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: '#4C1D95' }}>Cooking fee</Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: INK }}>${parseFloat(cookingFeeInput) || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13, color: HC }}>Customer pays total</Text>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13, color: HC }}>
                    ${ctx.homeCookRequest.ingredientBudget + (parseFloat(cookingFeeInput) || 0) + (parseFloat(travelFeeInput) || 0)}
                  </Text>
                </View>
              </View>
            ) : null}
            {termsErr ? <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger }}>{termsErr}</Text> : null}
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
