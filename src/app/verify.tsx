import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, CircleX, QrCode } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette } from '@/constants/theme';
import { useVerifyHandoffToken } from '@/lib/queries/orders';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;

/**
 * QR landing: the cook scans the customer's pickup/meetup QR with their phone
 * camera, which opens this URL (?t=<token>). Being the order's cook + holding
 * the token completes the handoff. Anyone else gets a clean rejection.
 */
export default function VerifyScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useLocalSearchParams<{ t?: string }>();
  const verify = useVerifyHandoffToken();
  // A link with no token can never verify — start in the failed state directly.
  const token = (t ?? '').toString();
  const [state, setState] = useState<'working' | 'ok' | 'fail'>(token ? 'working' : 'fail');
  const [reason, setReason] = useState<string | null>(token ? null : 'No code in the link.');
  const ran = useRef(false);

  useEffect(() => {
    if (loading || ran.current || !token) return;
    if (!user) return; // wait for sign-in (handled in render)
    ran.current = true;
    verify.mutate(token, {
      onSuccess: (r) => {
        if (r.ok && r.completed) { feedback.success(); setState('ok'); }
        else { feedback.error(); setState('fail'); setReason(r.reason ?? 'Could not verify this code.'); }
      },
      onError: (e) => { feedback.error(); setState('fail'); setReason(e instanceof Error ? e.message : 'Could not verify.'); },
    });
  }, [loading, user, token, verify]);

  const Icon = state === 'ok' ? CircleCheck : state === 'fail' ? CircleX : QrCode;
  const color = state === 'ok' ? Palette.success : state === 'fail' ? Palette.danger : ORANGE;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.prepperBg }}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        {loading || (user && state === 'working') ? (
          <>
            <ActivityIndicator color={ORANGE} size="large" />
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Verifying handoff…</Text>
          </>
        ) : !user ? (
          <>
            <MotiView from={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20, stiffness: 220 }}>
              <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: ORANGE + '26', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={32} color={ORANGE} />
              </View>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff', textAlign: 'center' }}>Sign in to verify</Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 20 }}>
                Only the order&apos;s kitchen can confirm a handoff. Sign in to your prepper account to continue.
              </Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
              <PressableScale onPress={() => { feedback.tap(); router.replace(`/auth?mode=signin`); }} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 24, height: 50, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
              </PressableScale>
            </MotiView>
          </>
        ) : (
          <>
            <MotiView from={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 200 }}>
              <View style={{ width: 84, height: 84, borderRadius: 26, backgroundColor: color + '26', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={40} color={color} strokeWidth={2.4} />
              </View>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', textAlign: 'center', letterSpacing: -0.5 }}>
                {state === 'ok' ? 'Handoff confirmed' : 'Could not verify'}
              </Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: Palette.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 21 }}>
                {state === 'ok' ? 'The order is now marked complete and counts toward your earnings.' : reason}
              </Text>
            </MotiView>
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
              <PressableScale onPress={() => { feedback.tap(); router.replace('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel="Back to orders" style={{ marginTop: 6, paddingHorizontal: 24, height: 50, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Back to orders</Text>
              </PressableScale>
            </MotiView>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
