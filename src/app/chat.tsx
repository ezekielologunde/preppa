import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, MessageCircle, Phone, Receipt, Send } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useChatContext, useMessages, useSendMessage } from '@/lib/queries/messages';
import { useAuth } from '@/providers/auth-provider';

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

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { data: messages, isLoading } = useMessages(id, user?.id);
  const { data: ctx } = useChatContext(id, user?.id);
  const send = useSendMessage();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

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
    const body = text.trim();
    if (!body || !id || !user) return;
    feedback.tap();
    setText('');
    send.mutate({ conversationId: id, senderId: user.id, body });
  }

  function goBack() {
    feedback.tap();
    try { router.back(); } catch { router.replace('/messages'); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
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
                {ctx.order.firstItem ?? 'Order'}{ctx.order.items > 1 ? ` +${ctx.order.items - 1} more` : ''}
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
            <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, justifyContent: (messages?.length ?? 0) ? 'flex-end' : 'center' }}>
              {!messages?.length ? (
                <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={28} color={Palette.textMuted} />
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
                        <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.textMuted, textAlign: 'center', marginVertical: 4 }}>
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

          {/* Composer */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Palette.chip }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              placeholderTextColor={Palette.textMuted}
              multiline
              style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, backgroundColor: Palette.canvas, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: Font.body, fontSize: 15, color: INK }}
            />
            <PressableScale onPress={submit} disabled={!text.trim() || send.isPending} accessibilityRole="button" accessibilityLabel="Send message"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? ORANGE : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={19} color="#fff" />
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
