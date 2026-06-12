import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChangePasswordPanel } from '@/components/account/change-password';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette } from '@/constants/theme';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  function goBack() { feedback.tap(); try { router.back(); } catch { router.replace('/settings'); } }

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <Pressable style={{ flex: 1 }} onPress={goBack} accessibilityLabel="Dismiss" />
      <MotiView
        from={{ translateY: 400 }}
        animate={{ translateY: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: insets.bottom + 8 }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginBottom: 16 }} />
        <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 8 }}>change password</Text>
        <ChangePasswordPanel onClose={goBack} />
      </MotiView>
    </View>
  );
}
