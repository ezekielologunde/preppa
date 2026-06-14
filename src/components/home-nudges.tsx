import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, UtensilsCrossed } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const ORANGE = Palette.brand;

/** Dark cross-sell card nudging customer users toward becoming a Preppa chef. */
export function BecomePrepperNudge() {
  const router = useRouter();
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 220 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/become-prepper'); }}
        accessibilityRole="button"
        accessibilityLabel="Become a Preppa — cook for your neighborhood"
        style={{ marginHorizontal: 20 }}>
        <LinearGradient
          colors={['#0b0604', '#271007']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: Radius.lg, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 106 }}>
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(241,95,34,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(241,95,34,0.28)' }}>
            <UtensilsCrossed size={24} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 15.5, color: '#fff', letterSpacing: -0.3 }}>
              cook for your neighborhood
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: 'rgba(255,255,255,0.48)', marginTop: 5, lineHeight: 18 }}>
              Turn your kitchen into income.{'\n'}Join chefs already earning on Preppa.
            </Text>
          </View>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={17} color="#fff" />
          </View>
        </LinearGradient>
      </PressableScale>
    </MotiView>
  );
}
