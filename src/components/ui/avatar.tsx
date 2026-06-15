import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

/**
 * User avatar: real photo when the account has one, otherwise the user's
 * initials on brand tint. Never someone else's stock photo.
 */
export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
  if (url) {
    return <Image source={url} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={200} accessibilityLabel={name} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: Font.heading, fontSize: size * 0.36, color: Palette.brand }}>{initials}</Text>
    </View>
  );
}
