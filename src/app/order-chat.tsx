import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useOrderMessages, useSendOrderMessage } from '@/lib/queries/order-chat';
import { useOrderStatus } from '@/lib/queries/orders';
import { useAuth } from '@/providers/auth-provider';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDivider(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Returns true when two ISO strings are more than 1 hour apart. */
function shouldShowDivider(prev: string | undefined, next: string): boolean {
  if (!prev) return true;
  return new Date(next).getTime() - new Date(prev).getTime() > 60 * 60 * 1000;
}

// ── sub-components ────────────────────────────────────────────────────────────

function TimeDivider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10, paddingHorizontal: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: Palette.border }} />
      <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: Palette.border }} />
    </View>
  );
}

type Msg = { id: string; senderId: string | null; body: string; createdAt: string };

function MessageBubble({ msg, isOwn }: { msg: Msg; isOwn: boolean }) {
  return (
    <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
      <View style={{
        maxWidth: '78%',
        backgroundColor: isOwn ? Palette.brand : Palette.surface,
        borderRadius: 18,
        borderBottomRightRadius: isOwn ? 4 : 18,
        borderBottomLeftRadius: isOwn ? 18 : 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}>
        <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: isOwn ? '#fff' : Palette.ink, lineHeight: 20 }}>
          {msg.body}
        </Text>
      </View>
      <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textMuted, marginTop: 3, marginHorizontal: 4 }}>
        {formatTime(msg.createdAt)}
      </Text>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function OrderChatScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const { data: order } = useOrderStatus(orderId);

  const { data: messages = [], isLoading } = useOrderMessages(orderId);
  const send = useSendOrderMessage(orderId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  // Scroll to end whenever message count changes
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/orders' as never);
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body || send.isPending || !user?.id) return;
    setDraft('');
    try {
      await send.mutateAsync({ body });
      feedback.success();
    } catch {
      feedback.error();
      setDraft(body);
      Alert.alert('Could not send', 'Check your connection and try again.');
    }
  }

  const kitchenName = order?.prepper ?? 'Kitchen';

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Palette.border, backgroundColor: Palette.canvas }}>
          <PressableScale
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.ink, letterSpacing: -0.4 }}>
              Order chat
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 1 }}>
              {kitchenName}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          {/* Message list */}
          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={Palette.brand} />
            </View>
          ) : messages.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink, textAlign: 'center' }}>
                No messages yet
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 19 }}>
                Ask the kitchen a question!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 16, gap: 4, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item, index }) => {
                const prev = messages[index - 1];
                const showDivider = shouldShowDivider(prev?.createdAt, item.createdAt);
                return (
                  <View>
                    {showDivider && <TimeDivider label={formatDivider(item.createdAt)} />}
                    <MessageBubble msg={item} isOwn={item.senderId === user?.id} />
                  </View>
                );
              }}
            />
          )}

          {/* Compose row */}
          <View style={{
            flexDirection: 'row', alignItems: 'flex-end', gap: 8,
            paddingHorizontal: 16, paddingVertical: 12,
            borderTopWidth: 1, borderTopColor: Palette.border,
            backgroundColor: Palette.canvas,
          }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message..."
              placeholderTextColor={Palette.textMuted}
              maxLength={1000}
              multiline
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
              accessibilityLabel="Message input"
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 120,
                backgroundColor: Palette.surface,
                borderRadius: Radius.sm,
                paddingHorizontal: 14,
                paddingTop: 10,
                paddingBottom: 10,
                fontFamily: Font.body,
                fontSize: 14,
                color: Palette.ink,
                borderWidth: 1,
                borderColor: Palette.border,
              }}
            />
            <PressableScale
              onPress={handleSend}
              disabled={!draft.trim() || send.isPending || !user?.id}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: draft.trim() ? Palette.brand : Palette.chip,
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {send.isPending
                ? <ActivityIndicator size="small" color={draft.trim() ? '#fff' : Palette.textMuted} />
                : <Send size={17} color={draft.trim() ? '#fff' : Palette.textMuted} strokeWidth={2.2} />
              }
            </PressableScale>
          </View>
        </KeyboardAvoidingView>

      </SafeAreaView>
    </View>
  );
}
