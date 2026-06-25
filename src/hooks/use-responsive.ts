import { useWindowDimensions } from 'react-native';

/**
 * Responsive breakpoints for Preppa. The app is phone-first; tablet and desktop
 * (web / large screens) widen content and switch single-column lists to grids.
 *
 *   phone   < 600   single column, full-bleed cards
 *   tablet  600-1023 2-column grids, constrained width
 *   desktop ≥ 1024  multi-column grids, max content width
 */
export const Breakpoints = {
  tablet: 600,
  desktop: 1024,
} as const;

export type DeviceClass = 'phone' | 'tablet' | 'desktop';

export type Responsive = {
  width: number;
  device: DeviceClass;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Suggested column count for card grids at the current width. */
  gridColumns: number;
  /** Max content width (px) — phones use the full width. */
  contentMaxWidth: number;
};

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();

  const device: DeviceClass =
    width >= Breakpoints.desktop ? 'desktop'
    : width >= Breakpoints.tablet ? 'tablet'
    : 'phone';

  const gridColumns = device === 'desktop' ? 3 : device === 'tablet' ? 2 : 1;
  const contentMaxWidth = device === 'desktop' ? 1040 : device === 'tablet' ? 760 : width;

  return {
    width,
    device,
    isPhone: device === 'phone',
    isTablet: device === 'tablet',
    isDesktop: device === 'desktop',
    gridColumns,
    contentMaxWidth,
  };
}
