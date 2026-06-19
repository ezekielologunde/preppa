import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Palette, Type } from '@/constants/theme';
import { Font } from '@/constants/fonts';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <View style={{
      backgroundColor: '#1a1a1a',
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignItems: 'center',
    }}>
      <Text style={{ fontFamily: Font.body, fontSize: Type.label, color: '#fff' }}>
        No internet connection — showing cached data
      </Text>
    </View>
  );
}
