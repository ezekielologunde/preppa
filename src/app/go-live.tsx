import { useRouter } from 'expo-router';
import { ChevronLeft, Copy, Radio, Users, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Alert, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { usePrepperMembership } from '@/lib/queries/memberships';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const BG = Palette.prepperBg;
const CARD = Palette.prepperCard;
const ORANGE = Palette.brand;
const MUTED = Palette.textMuted;
const RED = '#EF4444';

const PRO_FEATURES = [
  { Icon: Zap, label: 'Cook live, sell in real time' },
  { Icon: Users, label: 'Real-time viewer count + chat' },
  { Icon: Radio, label: 'HD stream with recording' },
];

export default function GoLiveScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const { data: membership } = usePrepperMembership(prepper?.id);
  const [title, setTitle] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);

  const isPro = membership?.isPro === true;
  const kitchenName = prepper?.display_name ?? user?.email?.split('@')[0] ?? 'kitchen';
  const shareLink = `preppa.live/live/@${kitchenName}`;

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) router.back(); else router.replace('/dashboard');
  }

  // Gate 1 — not an approved prepper
  if (!prepper || prepper.status !== 'approved') {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
            <Radio size={28} color={MUTED} />
          </View>
          <Text style={{ fontFamily: Font.heading, fontSize: 17, color: '#fff', textAlign: 'center' }}>
            Apply to cook on Preppa to unlock Go Live.
          </Text>
          <PressableScale onPress={() => { feedback.tap(); router.replace('/become-prepper'); }} accessibilityRole="button" accessibilityLabel="Apply to become a prepper"
            style={{ height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Apply now</Text>
          </PressableScale>
        </SafeAreaView>
      </View>
    );
  }

  // Gate 2 — approved but not Pro
  if (!isPro) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 12 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color="#fff" />
            </PressableScale>
            <Text style={{ fontFamily: Font.display, fontSize: 26, color: '#fff', letterSpacing: -0.6 }}>go live</Text>
          </View>
          <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 180 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: ORANGE + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={32} color={ORANGE} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff', textAlign: 'center' }}>Go Live is a Pro feature</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 }}>
              Upgrade to cook live, build your audience, and sell in real time.
            </Text>
            {PRO_FEATURES.map(({ Icon, label }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={ORANGE} />
                </View>
                <Text style={{ fontFamily: Font.medium, fontSize: 14, color: '#fff' }}>{label}</Text>
              </View>
            ))}
            <PressableScale onPress={() => { feedback.impact(); router.push('/prepper-premium'); }} accessibilityRole="button" accessibilityLabel="Upgrade to Pro"
              style={{ height: 60, borderRadius: Radius.md, backgroundColor: ORANGE, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Zap size={18} color="#fff" fill="#fff" />
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Upgrade to Pro</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  // Main screen — approved + Pro
  function handleCopyLink() {
    feedback.tap();
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      navigator.clipboard?.writeText(shareLink).catch(() => {});
    } else {
      Alert.alert('Share link', shareLink);
    }
  }

  async function toggleLive() {
    feedback[isLive ? 'tap' : 'success']();
    if (!isLive) {
      const { data: session } = await supabase
        .from('live_sessions')
        .insert({ prepper_id: prepper!.id, title: title.trim() || 'Live cooking' })
        .select('id')
        .single();
      setLiveSessionId(session?.id ?? null);
      setIsLive(true);
    } else {
      if (liveSessionId) {
        await supabase.from('live_sessions').update({ ended_at: new Date().toISOString() }).eq('id', liveSessionId);
        setLiveSessionId(null);
      }
      setIsLive(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 12 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 26, color: '#fff', letterSpacing: -0.6 }}>go live</Text>
        </View>

        <View style={{ flex: 1, padding: 20, gap: 20 }}>
          {/* Camera preview placeholder */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            <View style={{ height: 200, borderRadius: Radius.md, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {isLive && (
                <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: RED, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff' }}>LIVE</Text>
                </View>
              )}
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#1e2230', alignItems: 'center', justifyContent: 'center' }}>
                <Radio size={28} color={isLive ? ORANGE : MUTED} />
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 10 }}>
                {isLive ? 'broadcasting now' : 'camera preview'}
              </Text>
            </View>
          </MotiView>

          {/* Stream title */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
            <TextInput value={title} onChangeText={setTitle} placeholder="What are you cooking today?"
              placeholderTextColor="#4b5563" maxLength={80} accessibilityLabel="Stream title"
              style={{ height: 52, backgroundColor: CARD, borderRadius: Radius.sm, paddingHorizontal: 16, fontSize: 15, fontFamily: Font.body, color: '#fff' }} />
          </MotiView>

          {/* Broadcast toggle */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
            <PressableScale onPress={toggleLive} accessibilityRole="button" accessibilityLabel={isLive ? 'End broadcast' : 'Start broadcasting'}>
              {isLive ? (
                <View style={{ height: 60, borderRadius: Radius.md, backgroundColor: CARD, flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1.5, borderColor: RED + '60' }}>
                  <MotiView from={{ scale: 1 }} animate={{ scale: 1.04 }}
                    transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: RED }} />
                  </MotiView>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>You're Live · tap to end</Text>
                </View>
              ) : (
                <View style={{ height: 60, borderRadius: Radius.md, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Start Broadcasting →</Text>
                </View>
              )}
            </PressableScale>
          </MotiView>

          {/* Viewer count + share link (live only) */}
          {isLive && (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}
              style={{ gap: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE, textAlign: 'center' }}>👀 0 viewers</Text>
              <View style={{ backgroundColor: CARD, borderRadius: Radius.sm, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: '#fff' }} numberOfLines={1}>{shareLink}</Text>
                <PressableScale onPress={() => handleCopyLink()} accessibilityRole="button" accessibilityLabel="Copy share link"
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: ORANGE + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <Copy size={16} color={ORANGE} />
                </PressableScale>
              </View>
            </MotiView>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
