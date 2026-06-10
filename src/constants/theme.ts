/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * PREPPA design tokens — the single source of truth for color, radius, type and shadow.
 * Restrained by mandate: ONE brand orange + ONE semantic accent (success). Food imagery is the
 * visual hero, so surfaces stay neutral. No per-screen `const ORANGE/INK/MUTED` literals — import
 * from `Palette` instead so a rebrand is a one-file edit.
 */
export const Palette = {
  // Brand — used sparingly: CTAs, active nav, key accents. Never a full-screen fill.
  brand: '#F15F22',
  brandTint: '#FDEDE4', // flat orange wash (replaces peach gradients); icon-chip backgrounds
  brandPressed: '#D9430F', // pressed CTA + AA-safe orange for text/links on white

  // Neutral ink ramp
  ink: '#111827', // primary text, headings, dark buttons
  inkSoft: '#374151', // labels and emphasized secondary text (between ink and textSecondary)
  textSecondary: '#6B7280', // real secondary copy — AA on white
  textMuted: '#9CA3AF', // DECORATIVE/disabled only — never load-bearing text

  // Customer (light) surfaces
  surface: '#FFFFFF',
  canvas: '#F7F7F8',
  border: '#E5E7EB',
  chip: '#F3F4F6', // light icon-chip / inset background on white cards
  divider: '#D1D5DB', // hairlines on tinted surfaces; disabled outlines

  // Semantic accents — used with a text/icon pairing, never color alone
  success: '#16A34A', // verified, healthy, positive deltas, confirmed status
  amber: '#F59E0B', // star ratings, "popular" badges, gentle warnings
  danger: '#EF4444', // destructive actions, errors, favorites heart

  // Prepper (dark) app — intentionally an operations tool
  prepperBg: '#0C0E13',
  prepperCard: '#13161D',
} as const;

export type PaletteToken = keyof typeof Palette;

export const Radius = { sm: 14, md: 20, lg: 24, pill: 999 } as const;

/** Font sizes for the type scale (families live in constants/fonts.ts). */
export const Type = {
  displayXl: 32,
  displayLg: 24,
  display: 22,
  title: 18,
  body: 15,
  label: 13,
  micro: 11,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  navBar: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
} as const;

/** Standard min touch target (Apple HIG 44pt / Material 48dp). */
export const TouchTarget = 44;
