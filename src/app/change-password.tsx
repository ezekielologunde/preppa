import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChangePasswordPanel } from '@/components/account/change-password';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette } from '@/constants/theme';

export default function ChangePasswordScreen() {
  const router = useRouter();
  function goBack() { feedback.tap(); try { router.back(); } catch { router.replace('/settings'); } }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.6 }}>change password</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 130 }}>
          <ChangePasswordPanel onClose={goBack} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
