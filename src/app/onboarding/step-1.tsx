import { useRouter } from 'expo-router';
import { ChefHat, Clock, MapPin } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const BULLETS = [
  { Icon: ChefHat, title: 'Local chefs, real kitchens', body: 'Hand-picked preppers in your neighbourhood cook fresh, every day.' },
  { Icon: MapPin,  title: 'Delivered to your door', body: 'Order once, eat all week. Meal plans from $8 per serving.' },
  { Icon: Clock,   title: 'Skip the Sunday chaos', body: 'Set your preferences, we handle the rest. Done in minutes.' },
] as const;

export default function OnboardingStep1() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, paddingHorizontal: 24 }}>

        <View style={{ flex: 1, justifyContent: 'center', gap: 32 }}>
          <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 380 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 38, color: Palette.ink, letterSpacing: -1.2, lineHeight: 44 }}>
              {'Welcome to\nPreppa.'}
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 16, color: Palette.textSecondary, marginTop: 10, lineHeight: 24 }}>
              Your local meal-prep marketplace.
            </Text>
          </MotiView>

          <View style={{ gap: 16 }}>
            {BULLETS.map(({ Icon, title, body }, i) => (
              <MotiView key={title} from={{ opacity: 0, translateX: -16 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 320, delay: 120 + i * 80 }}>
                <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start', backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, ...Shadow.card }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color={Palette.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{title}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 3, lineHeight: 19 }}>{body}</Text>
                  </View>
                </View>
              </MotiView>
            ))}
          </View>
        </View>

        <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 480 }}
          style={{ paddingBottom: 12 }}>
          <PressableScale
            onPress={() => { feedback.tap(); router.replace('/onboarding/step-2'); }}
            accessibilityRole="button"
            accessibilityLabel="Continue to set up your account"
            style={{ height: 56, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', ...Shadow.floating }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>let's set you up →</Text>
          </PressableScale>
        </MotiView>

      </SafeAreaView>
    </View>
  );
}
