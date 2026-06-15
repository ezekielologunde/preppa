import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useDeviceLocation } from '@/lib/use-location';

export default function OnboardingStep2() {
  const router = useRouter();
  const { loc, requestDeviceLocation } = useDeviceLocation();

  async function handleAllow() {
    feedback.tap();
    await requestDeviceLocation();
    // Proceed regardless of result — denied is handled gracefully downstream
    router.replace('/onboarding/step-3');
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, paddingHorizontal: 24 }}>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 32 }}>
          <MotiView from={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 180 }}>
            <View style={{ width: 120, height: 120, borderRadius: 36, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={56} color={Palette.brand} />
            </View>
          </MotiView>

          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 120 }}
            style={{ alignItems: 'center', gap: 10 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 28, color: Palette.ink, letterSpacing: -0.8, textAlign: 'center' }}>
              Find chefs near you
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 23, maxWidth: 280 }}>
              We use your location to show local preppers and fresh meals within your area.
            </Text>
          </MotiView>
        </View>

        <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 240 }}
          style={{ gap: 12, paddingBottom: 12 }}>
          <PressableScale
            onPress={handleAllow}
            disabled={loc.status === 'requesting'}
            accessibilityRole="button"
            accessibilityLabel="Allow location access"
            style={{ height: 56, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', ...Shadow.floating, opacity: loc.status === 'requesting' ? 0.7 : 1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
              {loc.status === 'requesting' ? 'requesting...' : 'allow location access'}
            </Text>
          </PressableScale>

          <PressableScale
            onPress={() => { feedback.tap(); router.replace('/onboarding/step-3'); }}
            accessibilityRole="button"
            accessibilityLabel="Skip location access"
            style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textSecondary }}>skip for now</Text>
          </PressableScale>
        </MotiView>

      </SafeAreaView>
    </View>
  );
}
