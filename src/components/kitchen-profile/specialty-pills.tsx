/**
 * SpecialtyPills — horizontal-scroll row of cuisine/dietary specialty chips.
 * Tapping a chip navigates to /kitchens?tag=X.
 */
import { useRouter } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

interface SpecialtyPillsProps {
  specialties: string[];
}

export function SpecialtyPills({ specialties }: SpecialtyPillsProps) {
  const router = useRouter();

  if (!specialties.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {specialties.map((s) => (
        <PressableScale
          key={s}
          onPress={() => router.push(`/kitchens?tag=${encodeURIComponent(s)}`)}
          accessibilityRole="button"
          accessibilityLabel={`Find more ${s} kitchens`}
          style={{
            height: 32,
            borderRadius: 16,
            paddingHorizontal: 14,
            backgroundColor: Palette.chip,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{
            fontFamily: Font.semibold, fontSize: 12, color: Palette.textSecondary,
          }}>
            {s}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}
