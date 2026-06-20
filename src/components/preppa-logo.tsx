import { Flame } from 'lucide-react-native';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Palette } from '@/constants/theme';

/** Preppa brand palette — thin re-export so callsites don't need to change. */
export const BRAND = {
  orange: Palette.brand,
  orangeDeep: Palette.brandPressed,
  orangeLight: Palette.brandLight,
} as const;

type Props = {
  /** Size of the rounded tile (px). */
  size?: number;
  flameColor?: string;
  /** Solid tile color. Omit for the brand gradient. */
  tileColor?: string;
  /** Show the rounded tile behind the flame. */
  showTile?: boolean;
  /** Soft orange glow (use on light backgrounds). */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The Preppa mark — a white flame on a rounded orange tile.
 * Vector-based, so it stays crisp at any size (splash, onboarding, icons).
 */
export function PreppaLogo({
  size = 96,
  flameColor = '#ffffff',
  tileColor,
  showTile = true,
  glow = false,
  style,
}: Props) {
  const radius = size * 0.28;

  return (
    <View
      style={[
        showTile && {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tileColor ?? BRAND.orange,
          experimental_backgroundImage: tileColor
            ? undefined
            : `linear-gradient(155deg, ${BRAND.orangeLight}, ${BRAND.orange} 55%, ${BRAND.orangeDeep})`,
        },
        glow && {
          shadowColor: BRAND.orange,
          shadowOpacity: 0.55,
          shadowRadius: size * 0.34,
          shadowOffset: { width: 0, height: 0 },
          elevation: 16,
        },
        style,
      ]}>
      <Flame
        size={size * 0.58}
        color={flameColor}
        fill={flameColor}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </View>
  );
}
