import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 18, color: Palette.ink }}>
          {user?.email ?? 'Not signed in'}
        </Text>
        {user ? (
          <Pressable
            onPress={signOut}
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Palette.danger }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.danger }}>Sign out</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
