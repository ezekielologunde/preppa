import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock, UtensilsCrossed } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;

/**
 * Shown on the home feed for users who have not yet applied.
 * Hidden for approved preppers (they have a real dashboard).
 * Replaced with a pending-review card for applicants awaiting approval.
 */
export function BecomePrepperNudge() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);

  // Approved preppers don't need the nudge at all.
  if (prepper?.status === 'approved') return null;

  // Pending applicants see an informational "under review" card.
  if (prepper?.status === 'pending') {
    return (
      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 260, delay: 220 }}>
        <PressableScale
          onPress={() => { feedback.tap(); router.push('/become-prepper'); }}
          accessibilityRole="button"
          accessibilityLabel="Application under review — tap to see status"
          style={{ marginHorizontal: 20 }}>
          <View style={{ borderRadius: Radius.lg, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: Palette.amber + '18', borderWidth: 1, borderColor: Palette.amber + '38' }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: Palette.amber + '2A', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={24} color={Palette.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15.5, color: Palette.ink, letterSpacing: -0.3 }}>
                application under review
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.amber, marginTop: 5, lineHeight: 18 }}>
                We review applications within 48 hours.{'\n'}You'll be notified once approved.
              </Text>
            </View>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: Palette.amber + '26', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={17} color={Palette.amber} />
            </View>
          </View>
        </PressableScale>
      </MotiView>
    );
  }

  // Non-preppers see the recruitment card.
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
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(232,97,26,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(232,97,26,0.28)' }}>
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
