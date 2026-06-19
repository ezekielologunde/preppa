import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useAuth } from '@/providers/auth-provider';

export default function OnboardingWelcome() {
  const router = useRouter();
  const { user } = useAuth();

  const displayName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const greeting = displayName ? `you're all set, ${displayName.split(' ')[0]}!` : `you're all set!`;

  function handleStart() {
    feedback.success();
    router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>

        {/* Animated celebration emoji */}
        <MotiView
          from={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 10, stiffness: 120, delay: 80 }}
          style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 72 }}>🎉</Text>
        </MotiView>

        {/* Headline */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 180, delay: 220 }}>
          <Text
            style={{
              fontFamily: Font.display,
              fontSize: 30,
              color: Palette.ink,
              textAlign: 'center',
              letterSpacing: -0.8,
              lineHeight: 38,
              marginBottom: 14,
            }}>
            {greeting}
          </Text>
        </MotiView>

        {/* Body */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 180, delay: 340 }}
          style={{ marginBottom: 48 }}>
          <Text
            style={{
              fontFamily: Font.body,
              fontSize: 15,
              color: Palette.textSecondary,
              textAlign: 'center',
              lineHeight: 24,
              maxWidth: 280,
            }}>
            We've personalised your feed based on your taste. Local chefs are ready.
          </Text>
        </MotiView>

        {/* CTA */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 180, delay: 460 }}
          style={{ width: '100%' }}>
          <PressableScale
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Go to the home feed"
            style={{
              height: 54,
              borderRadius: Radius.pill,
              backgroundColor: Palette.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
              Let's eat
            </Text>
          </PressableScale>
        </MotiView>

      </SafeAreaView>
    </View>
  );
}
