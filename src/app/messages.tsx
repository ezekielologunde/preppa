import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronLeft, MessageCircle } from 'lucide-react-native';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useConversations, type Conversation } from '@/lib/queries/messages';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function Row({ c, onPress }: { c: Conversation; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Chat with ${c.otherName}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
      {c.otherAvatar ? (
        <Image source={c.otherAvatar} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit="cover" />
      ) : (
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 17, color: ORANGE }}>{initials(c.otherName)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, flex: 1 }} numberOfLines={1}>{c.otherName}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{timeAgo(c.lastAt)}</Text>
        </View>
        <Text style={{ fontFamily: c.unread ? Font.semibold : Font.body, fontSize: 13.5, color: c.unread ? INK : Palette.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {c.lastMessage ?? 'Say hello'}
        </Text>
      </View>
      {c.unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ORANGE }} /> : null}
    </PressableScale>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: conversations, isLoading } = useConversations(user?.id);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>messages</Text>
        </View>

        {!user ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <MessageCircle size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to message preppers and track your conversations.</Text>
            <PressableScale onPress={() => router.push('/auth?mode=signin')} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
        ) : !conversations?.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={28} color={Palette.textMuted} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>No messages yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 19 }}>
              Message a prepper from a meal or experience to start a conversation.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 8 : 4, paddingBottom: 40 }}>
            {conversations.map((c) => (
              <Row key={c.id} c={c} onPress={() => router.push(`/chat?id=${c.id}&name=${encodeURIComponent(c.otherName)}`)} />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
