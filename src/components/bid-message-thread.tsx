import { MessageCircle, Send } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useBidMessages, useSendBidMessage } from '@/lib/queries/bid-requests';

const BRAND = Palette.brand;
const INK = Palette.ink;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

type Props = {
  bidId: string;
  currentUserId: string;
};

export function BidMessageThread({ bidId, currentUserId }: Props) {
  const { data: messages = [], isLoading } = useBidMessages(bidId);
  const send = useSendBidMessage(bidId);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  async function handleSend() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft('');
    try {
      await send.mutateAsync({ senderId: currentUserId, body });
      feedback.success();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      feedback.error();
      setDraft(body);
    }
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: Palette.divider, marginTop: 6 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 8 }}>
        <MessageCircle size={14} color={BRAND} strokeWidth={2.2} />
        <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: BRAND, letterSpacing: 0.2, textTransform: 'uppercase' }}>
          in-bid messages{messages.length > 0 ? ` (${messages.length})` : ''}
        </Text>
      </View>

      {/* Message list */}
      <View style={{ borderRadius: Radius.sm, backgroundColor: Palette.canvas, overflow: 'hidden', minHeight: 40, maxHeight: 260 }}>
        {isLoading ? (
          <View style={{ height: 60, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={BRAND} />
          </View>
        ) : messages.length === 0 ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted }}>No messages yet. Say hello!</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ maxHeight: 260 }}
            contentContainerStyle={{ padding: 10, gap: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.map((m) => {
              const isOwn = m.sender_id === currentUserId;
              return (
                <View key={m.id} style={{ alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                  <View style={{
                    maxWidth: '78%',
                    backgroundColor: isOwn ? BRAND : Palette.surface,
                    borderRadius: 14,
                    borderBottomRightRadius: isOwn ? 4 : 14,
                    borderBottomLeftRadius: isOwn ? 14 : 4,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: isOwn ? '#fff' : INK, lineHeight: 19 }}>
                      {m.body}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 10, color: Palette.textMuted, marginTop: 3, marginHorizontal: 4 }}>
                    {formatTime(m.created_at)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Compose row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message..."
          placeholderTextColor={Palette.textMuted}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          accessibilityLabel="Message input"
          style={{
            flex: 1,
            height: 40,
            backgroundColor: Palette.canvas,
            borderRadius: Radius.pill,
            paddingHorizontal: 14,
            fontFamily: Font.body,
            fontSize: 14,
            color: INK,
            borderWidth: 1,
            borderColor: Palette.border,
          }}
        />
        <PressableScale
          onPress={handleSend}
          disabled={!draft.trim() || send.isPending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: draft.trim() ? BRAND : Palette.chip,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {send.isPending
            ? <ActivityIndicator size="small" color={draft.trim() ? '#fff' : Palette.textMuted} />
            : <Send size={16} color={draft.trim() ? '#fff' : Palette.textMuted} strokeWidth={2.2} />
          }
        </PressableScale>
      </View>
    </View>
  );
}
