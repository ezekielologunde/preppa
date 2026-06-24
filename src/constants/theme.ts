/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * @deprecated Use `Palette` instead. This object is kept for backwards
 * compatibility only and will be removed in a future release.
 */
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
  // ── WARM v3 palette (from "Preppa Design.html") ──
  // Warm cream surfaces + warm near-black ink + amber-leaning flame orange. A
  // rebrand is a one-file edit: every screen imports from Palette, so swapping
  // these values re-skins the whole app.

  // Brand — used sparingly: CTAs, active nav, key accents. Never a full-screen fill.
  brand: '#E8611A', // v3 flame orange (warmer than the old #F15F22)
  brandLight: '#FF814A', // lighter orange — gradient start, logo glow, warm tint wash
  brandTint: '#FAE5D3', // warm peach wash — chip bg, icon wells, soft brand washes
  brandPressed: '#C84E10', // pressed CTA + AA-safe orange for text/links on white

  // Neutral ink ramp — warm (taupe-leaning) instead of cool slate
  ink: '#1C1A18', // primary text, headings, dark buttons (warm near-black)
  inkSoft: '#44403C', // labels and emphasized secondary text
  textSecondary: '#78716C', // real secondary copy — warm grey (~4.8:1 on white, WCAG AA)
  textMuted: '#B8B0A8', // ⚠️  DECORATIVE/DISABLED ONLY — never use on load-bearing text (contrast < 3:1)

  // Customer (light) surfaces — warm cream canvas framing white cards
  surface: '#FFFFFF',
  canvas: '#F7F3EE',
  border: '#EDE8E2',
  chip: '#F2ECE6', // light icon-chip / inset background on white cards
  chipOff: '#F0EDEA', // inactive/unselected chip, toggle-off bg, placeholder wells
  divider: '#DDD6CE', // hairlines on tinted surfaces; disabled outlines

  // Semantic accents — used with a text/icon pairing, never color alone
  success: '#16A34A', // verified, healthy, positive deltas, confirmed status
  amber: '#F59E0B', // star ratings, "popular" badges, gentle warnings
  danger: '#DC2626', // destructive actions, errors, favorites heart — 4.5:1 on white
  dangerTint: '#FEF2F2', // error banner background — red-50 wash
  dangerBorder: '#FECACA', // error banner border — red-200 outline
  dangerDeep: '#991B1B', // error message text on dangerTint — red-800, AA-safe
  amberTint: '#FEF3C7', // warning banner background — amber-100 wash
  amberDeep: '#92400E', // warning message text on amberTint — amber-900, AA-safe
  homeCook: '#5B21B6', // Home Cook feature accent — purple-700, 4.5:1 on white
  homeCookTint: '#EDE9FE', // Home Cook chip/banner background — purple-50 wash
  homeCookDeep: '#4C1D95', // Home Cook label text on homeCookTint — purple-900, AA-safe
  successTint: '#DCFCE7', // success chip/status background — green-100 wash
  successDark: '#15803D', // success text on successTint — green-700, 5.1:1 AA-safe
  confirmedTint: '#DBEAFE', // confirmed order chip bg — blue-100 wash
  confirmedDark: '#1D4ED8', // confirmed chip text — blue-700, AA-safe on confirmedTint
  preparingTint: '#FED7AA', // preparing order chip bg — orange-200 wash
  preparingDark: '#9A3412', // preparing chip text — orange-800, AA-safe on preparingTint
  cancelledTint: '#FEE2E2', // cancelled order chip bg — red-100 wash (dangerTint is red-50)

  // Feature accent triad — delivery (cyan), meetup/social (violet), vegan/home-cook (leaf-green)
  cyan: '#06B6D4',       // delivery type, lunch category, teal accent
  violet: '#A78BFA',    // meetup type, social/follow, purple accent
  leafGreen: '#22C55E', // home-cook type, vegan/healthy, green accent

  // Prepper (dark) app — intentionally an operations tool (kept dark by mandate)
  prepperBg: '#0C0E13',
  prepperCard: '#13161D',

  // Modal and sheet backdrop — warm-tinted to match the new ink
  overlay: 'rgba(28,26,24,0.55)',
} as const;

export type PaletteToken = keyof typeof Palette;

export const Radius = { sm: 14, md: 12, lg: 16, card: 18, avatar: 20, pill: 999 } as const;

/** Font sizes for the type scale (families live in constants/fonts.ts). */
export const Type = {
  hero: 48,
  heroLg: 40,
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

export const Motion = {
  springSnappy:  { type: 'timing' as const, duration: 220 },
  springRelaxed: { type: 'spring' as const, damping: 18, stiffness: 200 },
  springBouncy:  { type: 'spring' as const, damping: 20, stiffness: 260 },
  fade:          { type: 'timing' as const, duration: 200 },
  fadeQuick:     { type: 'timing' as const, duration: 140 },
} as const;

export const Space = {
  xs:   2,
  sm:   4,
  md:   8,
  lg:   16,
  xl:   24,
  xxl:  32,
  huge: 64,
} as const;

/** Standard min touch target (Apple HIG 44pt / Material 48dp). */
export const TouchTarget = 44;

/** Named gradient stop pairs — use with LinearGradient colors prop. */
export const Gradients = {
  mealWarm:   [Palette.brandLight, Palette.brand]         as const,
  mealGold:   ['#F59E0B', '#D97706']                       as const,
  mealGreen:  [Palette.leafGreen, Palette.success]         as const,
  mealBlue:   [Palette.cyan, '#0891B2']                    as const,
  brand:      [Palette.brandLight, Palette.brandPressed]   as const,
  avatarWarm:        [Palette.brand, Palette.amberDeep]           as const,
  avatarPlaceholder: ['#C8A882', '#E8D5B7']                       as const,
  surpriseBanner:    ['#88D858', '#184808']                       as const,
} as const;

/** Hairline dividers. */
export const Divider = {
  standard: { height: 1 as const, backgroundColor: Palette.border },
} as const;
