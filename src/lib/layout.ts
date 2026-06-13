import { usePathname } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';

/** Sidebar widths used by the web ResponsiveFrame (kept in sync with _layout). */
export const SIDEBAR = { tablet: 72, desktop: 220 } as const;

/**
 * Responsive layout system. Mobile ≠ tablet ≠ desktop: every route gets a
 * width CLASS, and each class has intentional tablet/desktop maximums —
 * browse surfaces become real grids, business surfaces become dashboards,
 * focused flows (forms, checkout, chat) stay a comfortable column instead of
 * stretching across a monitor.
 *
 * NOTE: All hooks use raw window width, no Platform guard — the responsive
 * system applies equally to iOS, Android, and web. An iPad is a tablet.
 */
export const BP = { sm: 390, md: 480, tablet: 768, desktop: 1120 } as const;

export type WidthClass = 'form' | 'content' | 'browse' | 'business' | 'feed';

// Longest-prefix wins; anything unlisted is a focused 'form' flow.
const ROUTE_CLASS: [string, WidthClass][] = [
  ['/profile', 'feed'],
  ['/dashboard', 'business'],
  ['/prepper-orders', 'business'],
  ['/earnings', 'business'],
  ['/customers', 'business'],
  ['/meal-editor', 'business'],
  ['/admin', 'business'],
  ['/opportunities', 'business'],
  ['/search', 'browse'],
  ['/category', 'browse'],
  ['/explore', 'browse'],
  ['/orders', 'browse'],
  ['/messages', 'content'],
  ['/meal-plans', 'content'],
  ['/experiences', 'content'],
  ['/rewards', 'content'],
  ['/bid-requests', 'content'],
  ['/settings', 'form'],
  ['/edit-profile', 'form'],
  ['/account', 'form'],
  ['/addresses', 'form'],
  ['/payment-methods', 'form'],
  ['/post-video', 'form'],
  ['/become-prepper', 'form'],
  // Bare meal detail page widens for the desktop gallery + details two-pane.
  // (Listed AFTER /meal-editor and /meal-plans so those still match first.)
  ['/meal', 'browse'],
];

const MAX: Record<WidthClass, { tablet: number; desktop: number }> = {
  form: { tablet: 520, desktop: 520 },
  content: { tablet: 620, desktop: 700 },
  browse: { tablet: 760, desktop: 1120 },
  business: { tablet: 760, desktop: 1120 },
  // 'feed' is the home surface: on desktop it widens enough to fit a primary
  // column + a right rail (see useHomeColumns), instead of a lonely column.
  feed: { tablet: 720, desktop: 1240 },
};

export function widthClassFor(pathname: string): WidthClass {
  if (pathname === '/' || pathname === '') return 'feed';
  for (const [prefix, cls] of ROUTE_CLASS) if (pathname.startsWith(prefix)) return cls;
  return 'form';
}

export function maxWidthFor(pathname: string, windowWidth: number): number {
  if (windowWidth <= 560) return windowWidth;
  const tier = windowWidth >= BP.desktop ? 'desktop' : 'tablet';
  return Math.min(windowWidth, MAX[widthClassFor(pathname)][tier]);
}

/** The actual rendered content width for the current route (frame-aware). */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  return maxWidthFor(pathname ?? '/', width);
}

/** Breakpoint tier for the current window — works on all platforms. */
export function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const { width } = useWindowDimensions();
  return width >= BP.desktop ? 'desktop' : width >= BP.tablet ? 'tablet' : 'mobile';
}

/** Responsive horizontal page padding: 20 → 28 → 36 as screen grows. */
export function usePagePadding(): number {
  const { width } = useWindowDimensions();
  return width >= BP.desktop ? 36 : width >= BP.tablet ? 28 : 20;
}

/**
 * Dynamic card width for horizontal-scroll carousels — always shows a partial
 * card as a scroll affordance. ~2.2 cards on a phone, 3+ on a tablet.
 */
export function useCarouselCardWidth(): number {
  const { width } = useWindowDimensions();
  if (width >= BP.desktop) return Math.floor(width / 4.2);
  if (width >= BP.tablet) return Math.floor(width / 3.4);
  if (width >= BP.md) return Math.floor(width / 2.5);
  return Math.floor(width / 2.15);
}

/** Meal-grid columns for a content width (2 phone / 3 tablet / 4 desktop). */
export const gridColumns = (contentWidth: number): number =>
  contentWidth >= 1000 ? 4 : contentWidth >= 700 ? 3 : 2;

/** Card width that fills `contentWidth` with `pad` page padding and 12px gaps. */
export function gridCardWidth(contentWidth: number, pad = 20): number {
  const cols = gridColumns(contentWidth);
  return Math.floor((contentWidth - pad * 2 - (cols - 1) * 12) / cols);
}

/**
 * Two-column geometry for wide (desktop) surfaces. On web ≥ desktop a screen can
 * render a primary column + a fixed-width companion rail; everywhere else it
 * stays a single column (`twoCol: false`). Widths are derived from a centred
 * frame minus the sidebar, so the screen never has to know about frame chrome.
 *
 * Used by Home (feed + rail) and any content screen that wants a summary/detail
 * split on desktop while collapsing to one column on phone/tablet.
 */
export function useTwoPane(opts?: { rail?: number; minMain?: number }): {
  twoCol: boolean;
  main: number;
  rail: number;
  gap: number;
} {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const twoCol = Platform.OS === 'web' && width >= BP.desktop;
  const gap = 28;
  if (!twoCol) return { twoCol: false, main: 0, rail: 0, gap };

  // Derive columns from the ACTUAL route frame (route class → max width) so the
  // screen always fits inside whatever the ResponsiveFrame gives it. A screen
  // that wants two panes must have a wide-enough width class (feed/browse/business).
  const frame = maxWidthFor(pathname ?? '/', width);
  const rail = opts?.rail ?? 320;
  const outerPad = 24; // horizontal breathing room inside the content area
  const contentArea = frame - SIDEBAR.desktop;
  const main = Math.max(opts?.minMain ?? 520, contentArea - rail - gap - outerPad);
  return { twoCol: true, main, rail, gap };
}

/** @deprecated use useTwoPane() — kept as the Home alias. */
export const useHomeColumns = useTwoPane;
