import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 28, color: Palette.ink }}>
          Preppa
        </Text>
        <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary }}>
          Fresh start.
        </Text>
      </View>
    </SafeAreaView>
  );
}
