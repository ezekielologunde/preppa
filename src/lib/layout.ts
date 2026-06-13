import { usePathname } from 'expo-router';
import { useWindowDimensions } from 'react-native';

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

export type WidthClass = 'form' | 'content' | 'browse' | 'business';

// Longest-prefix wins; anything unlisted is a focused 'form' flow.
const ROUTE_CLASS: [string, WidthClass][] = [
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
  ['/orders', 'content'],
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
];

const MAX: Record<WidthClass, { tablet: number; desktop: number }> = {
  form: { tablet: 520, desktop: 520 },
  content: { tablet: 620, desktop: 700 },
  browse: { tablet: 760, desktop: 1120 },
  business: { tablet: 760, desktop: 1120 },
};

export function widthClassFor(pathname: string): WidthClass {
  if (pathname === '/' || pathname === '') return 'content';
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
