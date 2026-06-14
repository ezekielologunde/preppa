import { MotiView } from 'moti';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { Shield } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

export function PaymentRedirectOverlay({ visible }: { visible: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        <MotiView
          from={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 220 }}
          style={{ backgroundColor: Palette.canvas, borderRadius: 24, paddingHorizontal: 36, paddingVertical: 32, alignItems: 'center', gap: 18, minWidth: 260, maxWidth: 320 }}>
          <ActivityIndicator size="large" color={Palette.brand} />
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5, textAlign: 'center' }}>
              taking you to{'\n'}<Text style={{ color: Palette.brand }}>payment</Text>
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: 0.4 }}>
              <Shield size={11} color={Palette.ink} />
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.ink }}>Secured by Stripe</Text>
            </View>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}
