/**
 * Marketing notification engine.
 *
 * Determines WHAT to send, to WHOM, and WHEN — without touching the actual
 * push delivery layer. Screens and background jobs import from here.
 *
 * Design: pure functions + lightweight computation. No Supabase calls — callers
 * pass in the data they already have (orders, prefs, etc.).
 */

import { Palette } from '@/constants/theme';
import type { OrderSummary } from '@/lib/queries/orders';
import { getCurrentRush, getNextRush, getTodayRushSchedule } from '@/lib/rush-hour';

// ─── Holiday Registry ─────────────────────────────────────────────────────────

export type HolidayEvent = {
  id: string;
  name: string;
  /** ISO date string YYYY-MM-DD (no year — matched to current/next year). */
  mmdd: string;
  culture: string;
  flag: string;
  color: string;
  /** Days before the event to start showing the alert. */
  windowDays: number;
  pushTitle: string;
  pushBody: string;
  route: string;
  cuisineTags: string[];
};

export const HOLIDAY_REGISTRY: HolidayEvent[] = [
  {
    id: 'eid_adha',      name: "Eid al-Adha",        mmdd: '06-16', culture: 'Muslim / West African',
    flag: '☪️',  color: Palette.success, windowDays: 5,
    pushTitle: '☪️ Eid al-Adha specials are live',
    pushBody: 'Celebratory suya, jollof, and lamb from verified preppers near you. Limited slots.',
    route: '/explore',  cuisineTags: ['Nigerian', 'West African', 'Middle Eastern'],
  },
  {
    id: 'juneteenth',    name: 'Juneteenth',           mmdd: '06-19', culture: 'African American',
    flag: '✊',  color: Palette.danger, windowDays: 7,
    pushTitle: '✊ Juneteenth soul food is live',
    pushBody: 'BBQ ribs, mac & cheese, and sweet potato pie from Black-owned kitchens. Order ahead.',
    route: '/explore',  cuisineTags: ['Soul Food', 'American'],
  },
  {
    id: 'fathers_day',   name: "Father's Day",         mmdd: '06-15', culture: 'Universal',
    flag: '👨',  color: Palette.brand, windowDays: 5,
    pushTitle: "👨 Father's Day feast packs available",
    pushBody: 'Treat dad to a homemade meal from a local prepper. Family packs for 4 in stock.',
    route: '/explore',  cuisineTags: ['Nigerian', 'Grills', 'Family'],
  },
  {
    id: 'sallah',        name: 'Sallah Day',            mmdd: '06-17', culture: 'Northern Nigerian',
    flag: '🌙',  color: '#8b5cf6', windowDays: 4,
    pushTitle: '🌙 Sallah specials from Northern kitchens',
    pushBody: 'Kilishi, tuwo shinkafa, and ram pepper soup — made by verified Northern preppers.',
    route: '/explore',  cuisineTags: ['Hausa', 'Northern Nigerian'],
  },
  {
    id: 'canada_day',    name: 'Canada Day',            mmdd: '07-01', culture: 'Canadian',
    flag: '🇨🇦', color: Palette.danger, windowDays: 7,
    pushTitle: '🇨🇦 Canada Day meal kits are live',
    pushBody: 'Poutine kits, maple-glazed dishes, and backyard BBQ packs delivered today.',
    route: '/explore',  cuisineTags: ['Canadian'],
  },
  {
    id: 'independence_ng', name: 'Nigerian Independence', mmdd: '10-01', culture: 'Nigerian',
    flag: '🇳🇬', color: Palette.success, windowDays: 14,
    pushTitle: '🇳🇬 Nigerian Independence specials dropping soon',
    pushBody: 'Jollof battles, suya parties, and naija feasts — pre-save your spot now.',
    route: '/explore',  cuisineTags: ['Nigerian'],
  },
  {
    id: 'christmas',     name: 'Christmas',             mmdd: '12-25', culture: 'Universal',
    flag: '🎄', color: Palette.danger, windowDays: 14,
    pushTitle: '🎄 Christmas feast prep is open',
    pushBody: 'Order your Christmas meal kit or catering from local preppers. Slots fill fast.',
    route: '/explore',  cuisineTags: ['Universal'],
  },
  {
    id: 'thanksgiving',  name: 'Thanksgiving',          mmdd: '11-28', culture: 'North American',
    flag: '🦃', color: '#d97706', windowDays: 10,
    pushTitle: '🦃 Thanksgiving orders are open',
    pushBody: 'Full turkey meals, sides, and pies from local preppers. Order 3 days ahead.',
    route: '/explore',  cuisineTags: ['American', 'Universal'],
  },
];

/** Returns holidays whose alert window is currently active (sorted by proximity). */
export function getActiveHolidays(today = new Date()): Array<{ event: HolidayEvent; daysAway: number }> {
  const year = today.getFullYear();
  return HOLIDAY_REGISTRY.map((event) => {
    const [mm, dd] = event.mmdd.split('-').map(Number);
    let eventDate = new Date(year, mm - 1, dd);
    if (eventDate < today) eventDate = new Date(year + 1, mm - 1, dd);
    const daysAway = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);
    return { event, daysAway };
  })
    .filter(({ daysAway, event }) => daysAway >= 0 && daysAway <= event.windowDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

/** All upcoming holidays in order, regardless of alert window. */
export function getUpcomingHolidays(today = new Date(), limit = 8): Array<{ event: HolidayEvent; daysAway: number }> {
  const year = today.getFullYear();
  return HOLIDAY_REGISTRY.map((event) => {
    const [mm, dd] = event.mmdd.split('-').map(Number);
    let eventDate = new Date(year, mm - 1, dd);
    if (eventDate < today) eventDate = new Date(year + 1, mm - 1, dd);
    const daysAway = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);
    return { event, daysAway };
  })
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, limit);
}

// ─── Weekly Digest ────────────────────────────────────────────────────────────

export type WeeklyDigest = {
  orderCount: number;
  totalSpent: number;
  topCuisine: string | null;
  topPrepper: string | null;
  timeSavedMins: number;
  /** Which day of the week had the most orders (0=Sun). */
  peakDay: number;
  headline: string;
  nudge: string;
};

const CUISINE_KEYWORDS: Array<[string, string]> = [
  ['jollof', 'Nigerian'], ['suya', 'Nigerian'], ['egusi', 'Nigerian'], ['plantain', 'Nigerian'],
  ['taco', 'Mexican'], ['burrito', 'Mexican'], ['enchilada', 'Mexican'],
  ['pasta', 'Italian'], ['pizza', 'Italian'], ['risotto', 'Italian'],
  ['rice', 'Asian'], ['noodle', 'Asian'], ['ramen', 'Asian'], ['pho', 'Asian'],
  ['burger', 'American'], ['bbq', 'American'], ['wings', 'American'],
  ['curry', 'Indian'], ['butter chicken', 'Indian'], ['biryani', 'Indian'],
  ['jerk', 'Caribbean'], ['oxtail', 'Caribbean'],
  ['injera', 'Ethiopian'], ['tibs', 'Ethiopian'],
];

function inferCuisine(orders: OrderSummary[]): string | null {
  const freq: Record<string, number> = {};
  orders.forEach((o) => {
    const text = ((o as any).firstMealTitle ?? '').toLowerCase();
    CUISINE_KEYWORDS.forEach(([kw, cuisine]) => {
      if (text.includes(kw)) freq[cuisine] = (freq[cuisine] ?? 0) + 1;
    });
  });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Generates a personalised weekly digest from a user's recent orders. */
export function buildWeeklyDigest(orders: OrderSummary[]): WeeklyDigest {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const recent = orders.filter((o) => o.status === 'completed' && new Date(o.created_at ?? '') > weekAgo);

  const totalSpent = recent.reduce((s, o) => s + o.total, 0);
  const timeSavedMins = recent.length * 45;

  const dayCounts = Array(7).fill(0);
  recent.forEach((o) => {
    const d = new Date(o.created_at ?? '').getDay();
    if (!isNaN(d)) dayCounts[d]++;
  });
  const peakDay = dayCounts.indexOf(Math.max(...dayCounts));

  const prepperFreq: Record<string, number> = {};
  recent.forEach((o) => { if (o.prepper) prepperFreq[o.prepper] = (prepperFreq[o.prepper] ?? 0) + 1; });
  const topPrepper = Object.entries(prepperFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const topCuisine = inferCuisine(recent);
  const headline =
    recent.length === 0
      ? "You haven't ordered this week — your local preppers are ready when you are."
      : recent.length === 1
      ? `One order this week — ${timeSavedMins} min saved. Keep the streak going.`
      : `${recent.length} orders · $${totalSpent.toFixed(0)} spent · ${Math.round(timeSavedMins / 60)}h saved this week.`;

  const nudge =
    topPrepper
      ? `${topPrepper} is your most-ordered kitchen this week. They'd love a review.`
      : topCuisine
      ? `You're on a ${topCuisine} kick. Explore more ${topCuisine} kitchens nearby.`
      : 'Try a new cuisine this week — your personalized picks are ready.';

  return { orderCount: recent.length, totalSpent, topCuisine, topPrepper, timeSavedMins, peakDay, headline, nudge };
}

// ─── Alert Priority Queue ─────────────────────────────────────────────────────

export type AlertType = 'rush_hour' | 'holiday' | 'weekly_digest' | 'seasonal' | 'milestone' | 'new_prepper';

export type MarketingAlert = {
  type: AlertType;
  title: string;
  body: string;
  route: string;
  /** Higher = more urgent. Used to pick which alert fires if multiple are due. */
  priority: number;
  /** Minimum ms between firings of the same alert type for the same user. */
  cooldownMs: number;
};

export type NotifPrefs = Partial<Record<AlertType | 'rush' | 'weekly' | 'holiday', boolean>>;

/** Returns true if enough time has passed since the last firing. */
export function shouldFireAlert(lastFiredAt: Date | null, cooldownMs: number): boolean {
  if (!lastFiredAt) return true;
  return Date.now() - lastFiredAt.getTime() > cooldownMs;
}

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/**
 * Computes the prioritised list of marketing alerts that SHOULD fire right now,
 * given user preferences and last-fired timestamps. Callers decide how to deliver.
 */
export function getPendingAlerts(opts: {
  prefs: NotifPrefs;
  lastFiredByType: Partial<Record<AlertType, Date | null>>;
  role: 'buyer' | 'prepper';
  today?: Date;
}): MarketingAlert[] {
  const { prefs, lastFiredByType, role, today = new Date() } = opts;
  const pending: MarketingAlert[] = [];
  const hour = today.getHours();

  // Rush hour — fires at most once per rush window per user
  const rush = getCurrentRush(hour);
  if (rush && prefs.rush !== false) {
    const last = lastFiredByType.rush_hour ?? null;
    if (shouldFireAlert(last, 2 * HOUR_MS)) {
      pending.push({
        type: 'rush_hour',
        title: `${rush.emoji} ${rush.label}`,
        body: role === 'buyer' ? rush.pushBody : rush.prepperPrepTip,
        route: role === 'buyer' ? '/specials' : '/dashboard',
        priority: 10,
        cooldownMs: 2 * HOUR_MS,
      });
    }
  }

  // Holiday alerts
  if (prefs.holiday !== false) {
    const active = getActiveHolidays(today);
    active.forEach(({ event, daysAway }) => {
      const key = `holiday_${event.id}` as AlertType;
      const last = (lastFiredByType as any)[key] ?? null;
      const cooldown = daysAway === 0 ? 6 * HOUR_MS : DAY_MS;
      if (shouldFireAlert(last, cooldown)) {
        pending.push({
          type: 'holiday',
          title: event.pushTitle,
          body: event.pushBody,
          route: event.route,
          priority: daysAway === 0 ? 9 : 7,
          cooldownMs: cooldown,
        });
      }
    });
  }

  // Weekly digest — Sundays, 9 am
  if (prefs.weekly !== false && today.getDay() === 0 && hour >= 9 && hour < 11) {
    const last = lastFiredByType.weekly_digest ?? null;
    if (shouldFireAlert(last, 6 * DAY_MS)) {
      pending.push({
        type: 'weekly_digest',
        title: '📊 Your week on Preppa',
        body: role === 'buyer' ? 'Your personalised weekly summary is ready.' : 'See how your kitchen performed this week.',
        route: role === 'buyer' ? '/insights' : '/prepper-analytics',
        priority: 6,
        cooldownMs: 6 * DAY_MS,
      });
    }
  }

  return pending.sort((a, b) => b.priority - a.priority);
}

/** Returns the single highest-priority alert to show as a banner in-app. */
export function getTopAlert(opts: Parameters<typeof getPendingAlerts>[0]): MarketingAlert | null {
  const alerts = getPendingAlerts(opts);
  return alerts[0] ?? null;
}

// ─── Seasonal Context ─────────────────────────────────────────────────────────

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export function getSeason(today = new Date()): Season {
  const m = today.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export const SEASONAL_THEMES: Record<Season, { label: string; color: string; tag: string }> = {
  spring: { label: 'spring freshness', color: Palette.success, tag: 'Fresh salads, light bowls, and floral drinks' },
  summer: { label: 'summer grilling', color: '#ea580c', tag: 'BBQ packs, cold sides, and chilled desserts' },
  autumn: { label: 'harvest comfort', color: '#d97706', tag: 'Stews, soups, and warming spice blends' },
  winter: { label: 'winter warmers', color: '#7c3aed', tag: 'Hearty one-pots, festive bakes, and hot drinks' },
};

export function getSeasonalTheme(today = new Date()) {
  return SEASONAL_THEMES[getSeason(today)];
}
