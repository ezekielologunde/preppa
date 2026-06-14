import { MotiView } from 'moti';
import type { ReactNode } from 'react';
import { type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';

// Bottom-anchored container for a screen's primary action(s). Replaces the
// pattern of free-floating overlays sitting mid-screen: it sticks flush to
// the bottom edge, respects the device safe area, and lays a solid backdrop
// + hairline divider so the CTA never visually collides with scrolled
// content behind it. Give the screen's scroll content paddingBottom ≈ the
// bar height so nothing hides underneath.

export function BottomActionBar({
  children,
  maxWidth,
  style,
}: {
  children: ReactNode;
  /** Center + cap width on large screens (e.g. 540). Omit for full-bleed. */
  maxWidth?: number;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  return (
    <MotiView
      from={{ translateY: 24, opacity: 0 }}
      animate={{ translateY: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 19, stiffness: 200 }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Palette.surface,
        borderTopWidth: 1,
        borderTopColor: Palette.border,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 14),
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
        ...(maxWidth ? { alignSelf: 'center', width: '100%', maxWidth } : {}),
        ...style,
      }}>
      {children}
    </MotiView>
  );
}
