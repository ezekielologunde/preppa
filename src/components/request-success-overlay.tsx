import { CheckCircle } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function RequestSuccessOverlay({ visible, onDismiss }: Props) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 2500);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss success message"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: Palette.surface,
        alignItems: 'center', justifyContent: 'center',
        zIndex: 100, paddingHorizontal: 32,
      }}>
      <MotiView
        from={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 220 }}
        style={{ alignItems: 'center', gap: 16 }}>
        <MotiView
          from={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 260, delay: 80 }}>
          <CheckCircle size={72} color={Palette.brand} strokeWidth={1.8} />
        </MotiView>
        <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.6, textAlign: 'center' }}>
          Request posted!
        </Text>
        <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22 }}>
          Preppers in your area will see it soon
        </Text>
      </MotiView>
    </Pressable>
  );
}
