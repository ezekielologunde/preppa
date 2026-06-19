import { Check } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const ORANGE = Palette.brand;
const INK = Palette.ink;

interface Props {
  onTrack: () => void;
  onHome: () => void;
}

export function CartPlacedScreen({ onTrack, onHome }: Props) {
  return (
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
        <MotiView from={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 160 }}>
          <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: Palette.success + '1F', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={36} color={Palette.success} strokeWidth={3} />
          </View>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, textAlign: 'center' }}>Preorder placed!</Text>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>
            Your preorder is in. The prepper will confirm shortly — track it in your preorders.
          </Text>
        </MotiView>
        <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
          <PressableScale
            onPress={() => { feedback.tap(); onTrack(); }}
            accessibilityRole="button"
            accessibilityLabel="Track your preorder"
            style={{ marginTop: 6, paddingHorizontal: 24, height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Track your preorder</Text>
          </PressableScale>
        </MotiView>
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 240, delay: 280 }}>
          <PressableScale
            onPress={() => { feedback.tap(); onHome(); }}
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            style={{ paddingHorizontal: 24, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Back to home</Text>
          </PressableScale>
        </MotiView>
      </SafeAreaView>
    </View>
  );
}
