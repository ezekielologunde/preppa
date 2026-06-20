/**
 * Central rush-hour engine.
 *
 * Single source of truth for every screen and notification that reacts to
 * meal-prep rush windows. Import from here — do NOT inline hour checks.
 */

import { Palette } from '@/constants/theme';

export type RushId = 'morning' | 'lunch' | 'dinner';

export type RushWindow = {
  id: RushId;
  label: string;
  /** Inclusive start hour (24-h). */
  start: number;
  /** Exclusive end hour (24-h). */
  end: number;
  color: string;
  /** Tip shown to buyers during this window. */
  buyerTip: string;
  /** Headline shown to preppers during this window. */
  prepperAlert: string;
  /** Actionable prep advice for preppers. */
  prepperPrepTip: string;
  /** Push notification body sent to nearby buyers. */
  pushBody: string;
  /** Emoji used in notification titles. */
  emoji: string;
};

export const RUSH_WINDOWS: RushWindow[] = [
  {
    id: 'morning',
    label: 'morning prep',
    start: 7,
    end: 10,
    color: '#d97706',
    buyerTip: 'Morning drop — grab breakfast from your local prep kitchen before 10 am.',
    prepperAlert: 'Morning rush is active (7–10 am)',
    prepperPrepTip: 'Batch high-protein bowls, egg dishes, and oats now for fast fulfilment.',
    pushBody: 'Fresh breakfast drops are available from kitchens near you. Preorder before 10 am.',
    emoji: '☀️',
  },
  {
    id: 'lunch',
    label: 'lunch rush',
    start: 11,
    end: 14,
    color: Palette.brand,
    buyerTip: 'Lunch rush is on — preorder for 12–2 pm pickup or delivery.',
    prepperAlert: 'Lunch rush is active (11 am–2 pm)',
    prepperPrepTip: 'Stock extra rice, soups, and wraps. Batch-cook proteins — this is your highest-volume window.',
    pushBody: 'Lunch is ready. Top kitchens near you are live right now — preorder for 12–2 pm.',
    emoji: '🍱',
  },
  {
    id: 'dinner',
    label: 'dinner window',
    start: 16,
    end: 20,
    color: '#7c3aed',
    buyerTip: 'Dinner window — preorder for 6–7 pm. Top kitchens are live.',
    prepperAlert: 'Dinner window is active (4–8 pm)',
    prepperPrepTip: 'Pre-portion family packs and one-pot meals. Being ready by 4:30 pm puts you first in the queue.',
    pushBody: "What's for dinner? Your neighbourhood kitchens are live — preorder for 6–7 pm.",
    emoji: '🌆',
  },
];

/** Returns the rush window active RIGHT NOW, or null if between windows. */
export function getCurrentRush(hour = new Date().getHours()): RushWindow | null {
  return RUSH_WINDOWS.find((w) => hour >= w.start && hour < w.end) ?? null;
}

/** Returns the next upcoming rush today/tomorrow with minutes until it starts. */
export function getNextRush(
  hour = new Date().getHours(),
  minute = new Date().getMinutes(),
): { window: RushWindow; inMins: number } | null {
  const upcoming = RUSH_WINDOWS
    .map((w) => ({ window: w, inMins: (w.start - hour) * 60 - minute }))
    .filter((r) => r.inMins > 0);
  return upcoming.length ? upcoming[0] : null;
}

/** True if any rush window is currently active. */
export function isRushHour(hour = new Date().getHours()): boolean {
  return getCurrentRush(hour) !== null;
}

/**
 * How many minutes until this rush window ENDS.
 * Returns 0 if the window is not currently active.
 */
export function minsUntilRushEnds(
  window: RushWindow,
  hour = new Date().getHours(),
  minute = new Date().getMinutes(),
): number {
  if (hour < window.start || hour >= window.end) return 0;
  return (window.end - hour) * 60 - minute;
}

/** Returns the best CTA label for a buyer given the current time. */
export function getBuyerCta(hour = new Date().getHours()): string {
  const rush = getCurrentRush(hour);
  if (rush) return `preorder during ${rush.label}`;
  const next = getNextRush(hour);
  if (next) return `next rush in ~${Math.round(next.inMins / 60 * 10) / 10}h`;
  return 'browse local kitchens';
}

/**
 * Returns a ranked list of push-notification payloads for the current moment.
 * Callers decide whether to actually send them (based on user prefs / last-sent).
 */
export function getRushPushPayloads(role: 'buyer' | 'prepper'): Array<{ title: string; body: string; route: string }> {
  const rush = getCurrentRush();
  if (!rush) return [];
  if (role === 'buyer') {
    return [{ title: `${rush.emoji} ${rush.label}`, body: rush.pushBody, route: '/specials' }];
  }
  return [{ title: `${rush.emoji} ${rush.prepperAlert}`, body: rush.prepperPrepTip, route: '/dashboard' }];
}

/**
 * Urgency level for UI styling.
 * 'live'    — window active right now
 * 'soon'    — window starts within 60 minutes
 * 'upcoming'— window starts later today
 * 'quiet'   — no more windows today
 */
export type RushUrgency = 'live' | 'soon' | 'upcoming' | 'quiet';

export function getRushUrgency(hour = new Date().getHours(), minute = new Date().getMinutes()): RushUrgency {
  if (getCurrentRush(hour)) return 'live';
  const next = getNextRush(hour, minute);
  if (!next) return 'quiet';
  if (next.inMins <= 60) return 'soon';
  return 'upcoming';
}

/** Weekly patterns — which rush window fires on which days. Used by marketing engine. */
export const RUSH_SCHEDULE: Record<number, RushId[]> = {
  0: ['lunch', 'dinner'],        // Sunday
  1: ['morning', 'lunch', 'dinner'],
  2: ['morning', 'lunch', 'dinner'],
  3: ['morning', 'lunch', 'dinner'],
  4: ['morning', 'lunch', 'dinner'],
  5: ['morning', 'lunch', 'dinner'],
  6: ['lunch', 'dinner'],        // Saturday
};

/** Returns the rush IDs that should fire marketing notifications today. */
export function getTodayRushSchedule(dayOfWeek = new Date().getDay()): RushId[] {
  return RUSH_SCHEDULE[dayOfWeek] ?? ['lunch', 'dinner'];
}
