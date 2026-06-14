import { usePathname } from 'expo-router';
import { useWindowDimensions } from 'react-native';

/**
 * Adaptive layout system — one model for iOS, Android, iPad and web.
 *
 *   < 600px  (compact)  bottom tab bar · single full-bleed column
 *   600–1024 (tablet)   left icon RAIL (72px) · content FILLS the rest
 *   > 1024   (desktop)  left labelled SIDEBAR (240px) · content fills,
 *                        feed surfaces add a right context panel
 *
 * Every route gets a width CLASS. "Fill" classes (browse / business / feed)
 * stretch to use the whole content area beside the rail — no dead whitespace.
 * "Focused" classes (form / content) stay a centred, comfortable column so a
 * settings form never smears across a monitor. All hooks key off raw window
 * width — no Platform guard — so a native iPad gets the same shell as web.
 */
export const BP = { sm: 390, md: 480, tablet: 600, desktop: 1024 } as const;

/** Rail / sidebar widths — kept in sync with AppSidebar in app/_layout.tsx. */
export const SIDEBAR = { tablet: 72, desktop: 240 } as const;

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
  ['/cart', 'content'],
  ['/settings', 'form'],
  ['/edit-profile', 'form'],
  ['/addresses', 'form'],
  ['/payment-methods', 'form'],
  ['/post-video', 'form'],
  ['/become-prepper', 'form'],
  // Bare meal detail widens for the desktop gallery + details two-pane.
  // (After /meal-editor and /meal-plans so those still match first.)
  ['/meal', 'browse'],
];

// Focused flows cap at a comfortable column; fill flows use the whole area
// (huge tablet cap = "fill"; desktop cap only stops absurd ultrawide stretch).
const MAX: Record<WidthClass, { tablet: number; desktop: number }> = {
  form: { tablet: 560, desktop: 600 },
  content: { tablet: 720, desktop: 860 },
  browse: { tablet: 100_000, desktop: 1440 },
  business: { tablet: 100_000, desktop: 1440 },
  feed: { tablet: 100_000, desktop: 1440 },
};

const FILL_CLASSES: WidthClass[] = ['browse', 'business', 'feed'];
export const isFillClass = (c: WidthClass): boolean => FILL_CLASSES.includes(c);

export function widthClassFor(pathname: string): WidthClass {
  if (pathname === '/' || pathname === '') return 'feed';
  for (const [prefix, cls] of ROUTE_CLASS) if (pathname.startsWith(prefix)) return cls;
  return 'form';
}

/** Width of the rail/sidebar at a given window width (0 on compact phones). */
export function sidebarWidthFor(width: number): number {
  if (width >= BP.desktop) return SIDEBAR.desktop;
  if (width >= BP.tablet) return SIDEBAR.tablet;
  return 0;
}

/**
 * The REAL rendered content width: the viewport minus the rail/sidebar, then
 * capped for focused flows. Fill flows return the whole available area, so grids
 * and panels size to what's actually on screen (no sidebar-math surprises).
 */
export function contentWidthFor(pathname: string, width: number): number {
  if (width < BP.tablet) return width; // compact: full-bleed
  const avail = width - sidebarWidthFor(width);
  const tier = width >= BP.desktop ? 'desktop' : 'tablet';
  return Math.min(avail, MAX[widthClassFor(pathname)][tier]);
}

/** Should the frame CENTER this route (focused flow) vs let it fill the area? */
export function shouldCenter(pathname: string, width: number): boolean {
  if (width < BP.tablet) return false;
  return !isFillClass(widthClassFor(pathname));
}

/** @deprecated name — now returns the true content width (minus sidebar). */
export const maxWidthFor = contentWidthFor;

/** The actual rendered content width for the current route. */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  return contentWidthFor(pathname ?? '/', width);
}

/** Breakpoint tier for the current window — works on all platforms. */
export function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const { width } = useWindowDimensions();
  return width >= BP.desktop ? 'desktop' : width >= BP.tablet ? 'tablet' : 'mobile';
}

/** Fluid horizontal page padding — the RN analogue of clamp(16px, 3.2vw, 40px). */
export function usePagePadding(): number {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(40, Math.max(16, width * 0.032)));
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

/** Auto-fitting column count for a content width (≈ minmax(280px, 1fr)). */
export const gridColumns = (contentWidth: number): number =>
  contentWidth >= 1180 ? 4 : contentWidth >= 860 ? 3 : contentWidth >= 560 ? 2 : 2;

/** Card width that fills `contentWidth` with `pad` page padding and 12px gaps. */
export function gridCardWidth(contentWidth: number, pad = 20): number {
  const cols = gridColumns(contentWidth);
  return Math.floor((contentWidth - pad * 2 - (cols - 1) * 12) / cols);
}

/**
 * Two-column geometry for wide (desktop) surfaces: a primary column + a fixed
 * companion rail. Triggers at desktop width on ANY platform (an iPad in
 * landscape gets it too). Widths derive from the real content area, so the
 * screen never has to know about the sidebar.
 */
export function useTwoPane(opts?: { rail?: number; minMain?: number }): {
  twoCol: boolean;
  main: number;
  rail: number;
  gap: number;
} {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const twoCol = width >= BP.desktop;
  const gap = 28;
  if (!twoCol) return { twoCol: false, main: 0, rail: 0, gap };

  const content = contentWidthFor(pathname ?? '/', width); // already minus sidebar
  const rail = opts?.rail ?? 320;
  const pad = 24;
  const main = Math.max(opts?.minMain ?? 480, content - rail - gap - pad);
  return { twoCol: true, main, rail, gap };
}

/** @deprecated use useTwoPane() — kept as the Home alias. */
export const useHomeColumns = useTwoPane;
