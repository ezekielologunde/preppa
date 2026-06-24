import { View } from 'react-native';
import { Star } from 'lucide-react-native';
import { Palette } from '@/constants/theme';

type Props = {
  value: number | null;
  size?: number;
};

export function Stars({ value, size = 14 }: Props) {
  const filled = Math.round((value ?? 0) * 2) / 2;
  const label = value != null ? `${value.toFixed(1)} out of 5 stars` : 'not yet rated';
  return (
    <View
      style={{ flexDirection: 'row', gap: 2 }}
      accessibilityLabel={label}
      accessibilityRole="image"
      importantForAccessibility="yes"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          color={filled >= n ? Palette.amber : Palette.border}
          fill={filled >= n ? Palette.amber : 'transparent'}
          strokeWidth={1.5}
          importantForAccessibility="no-hide-descendants"
        />
      ))}
    </View>
  );
}
