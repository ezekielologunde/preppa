import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useMessages, useSendMessage } from '@/lib/queries/messages';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { data: messages, isLoading } = useMessages(id, user?.id);
  const send = useSendMessage();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

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
    setText('');
    send.mutate({ conversationId: id, senderId: user.id, body });
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/messages');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK }} numberOfLines={1}>{name ?? 'Chat'}</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
          {isLoading ? (
            <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, justifyContent: (messages?.length ?? 0) ? 'flex-end' : 'center' }}>
              {!messages?.length ? (
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center' }}>
                  No messages yet. Send the first one below.
                </Text>
              ) : (
                messages.map((m) => (
                  <View key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '78%', backgroundColor: m.mine ? ORANGE : Palette.canvas, borderRadius: 18, borderBottomRightRadius: m.mine ? 4 : 18, borderBottomLeftRadius: m.mine ? 18 : 4, paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: m.mine ? '#fff' : INK, lineHeight: 20 }}>{m.body}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* Composer */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              placeholderTextColor="#9ca3af"
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
