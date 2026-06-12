/**
 * Prepper–Buyer matching engine.
 *
 * Builds a richer signal profile from a user's order history + favorites,
 * then scores every prepper against it. Returns a ranked list with match
 * reasons the UI can surface ("Orders your kind of food", etc.).
 *
 * This extends the meal-level ranking in recommend.ts to the prepper level.
 */

import { useMemo } from 'react';

import { useFavoriteKeys } from '@/lib/favorites';
import { useMyOrders, type OrderSummary } from '@/lib/queries/orders';

// ─── Cuisine Keyword Map ──────────────────────────────────────────────────────

const CUISINE_KEYWORDS: Array<[string, string]> = [
  ['jollof', 'Nigerian'], ['suya', 'Nigerian'], ['egusi', 'Nigerian'], ['plantain', 'Nigerian'],
  ['pepper soup', 'Nigerian'], ['moin moin', 'Nigerian'], ['puff puff', 'Nigerian'],
  ['taco', 'Mexican'], ['burrito', 'Mexican'], ['quesadilla', 'Mexican'],
  ['pasta', 'Italian'], ['pizza', 'Italian'], ['risotto', 'Italian'], ['carbonara', 'Italian'],
  ['ramen', 'Japanese'], ['sushi', 'Japanese'], ['miso', 'Japanese'],
  ['pho', 'Vietnamese'], ['banh mi', 'Vietnamese'],
  ['curry', 'Indian'], ['biryani', 'Indian'], ['butter chicken', 'Indian'], ['dhal', 'Indian'],
  ['jerk', 'Caribbean'], ['oxtail', 'Caribbean'], ['roti', 'Caribbean'],
  ['injera', 'Ethiopian'], ['tibs', 'Ethiopian'], ['kitfo', 'Ethiopian'],
  ['burger', 'American'], ['bbq', 'American'], ['wings', 'American'],
  ['shakshuka', 'Mediterranean'], ['falafel', 'Mediterranean'], ['hummus', 'Mediterranean'],
  ['rice', 'Asian'], ['noodle', 'Asian'], ['stir fry', 'Asian'],
  ['salad', 'Healthy'], ['bowl', 'Healthy'], ['smoothie', 'Healthy'], ['wrap', 'Healthy'],
];

// ─── Signal Types ─────────────────────────────────────────────────────────────

export type CuisineAffinities = Map<string, number>;

export type TimeAffinities = {
  morning: number;   // orders between 7–10
  lunch: number;     // orders between 11–14
  dinner: number;    // orders between 16–20
  weekend: number;   // orders on Sat/Sun
  weekday: number;   // orders Mon–Fri
};

export type MatchSignals = {
  cuisineAffinities: CuisineAffinities;
  timeAffinities: TimeAffinities;
  /** Prepper names (not IDs — what's on order summary) the user has ordered before. */
  orderedPreppers: Set<string>;
  favPrepperKeys: Set<string>;
  avgSpend: number;
  totalOrders: number;
};

// ─── Signal Builders ──────────────────────────────────────────────────────────

export function buildCuisineAffinities(orders: OrderSummary[]): CuisineAffinities {
  const freq: Map<string, number> = new Map();
  const completed = orders.filter((o) => o.status === 'completed');
  completed.forEach((o) => {
    const text = ((o as any).firstMealTitle ?? '').toLowerCase();
    CUISINE_KEYWORDS.forEach(([kw, cuisine]) => {
      if (text.includes(kw)) freq.set(cuisine, (freq.get(cuisine) ?? 0) + 1);
    });
  });
  // Normalise to 0–1 range
  const max = Math.max(...freq.values(), 1);
  const normalised: CuisineAffinities = new Map();
  freq.forEach((count, cuisine) => normalised.set(cuisine, count / max));
  return normalised;
}

export function buildTimeAffinities(orders: OrderSummary[]): TimeAffinities {
  const aff: TimeAffinities = { morning: 0, lunch: 0, dinner: 0, weekend: 0, weekday: 0 };
  const completed = orders.filter((o) => o.status === 'completed');
  if (!completed.length) return aff;
  completed.forEach((o) => {
    const d = new Date(o.created_at ?? '');
    if (isNaN(d.getTime())) return;
    const h = d.getHours();
    const dow = d.getDay();
    if (h >= 7 && h < 10) aff.morning++;
    else if (h >= 11 && h < 14) aff.lunch++;
    else if (h >= 16 && h < 20) aff.dinner++;
    if (dow === 0 || dow === 6) aff.weekend++;
    else aff.weekday++;
  });
  // Normalise by total orders
  const total = completed.length;
  aff.morning /= total;
  aff.lunch /= total;
  aff.dinner /= total;
  aff.weekend /= total;
  aff.weekday /= total;
  return aff;
}

export function buildMatchSignals(orders: OrderSummary[], favKeys: string[]): MatchSignals {
  const completed = orders.filter((o) => o.status === 'completed');
  const avgSpend = completed.length ? completed.reduce((s, o) => s + o.total, 0) / completed.length : 0;
  return {
    cuisineAffinities: buildCuisineAffinities(orders),
    timeAffinities: buildTimeAffinities(orders),
    orderedPreppers: new Set(completed.map((o) => o.prepper).filter(Boolean)),
    favPrepperKeys: new Set(favKeys.filter((k) => k.startsWith('prepper:'))),
    avgSpend,
    totalOrders: completed.length,
  };
}

// ─── Prepper Scoring ──────────────────────────────────────────────────────────

export type PrepperLike = {
  id: string;
  name: string;
  cuisine?: string | null;
  rating?: number | null;
  specialties?: string[];
  isAvailable?: boolean;
  orderCount?: number;
};

export type RankedPrepper = PrepperLike & {
  matchScore: number;
  matchReason: string;
};

const CUISINE_TAGS_MAP: Record<string, string[]> = {
  Nigerian: ['jollof', 'suya', 'egusi', 'nigerian'],
  Mexican: ['taco', 'burrito', 'mexican'],
  Italian: ['pasta', 'pizza', 'italian', 'risotto'],
  Indian: ['curry', 'biryani', 'indian'],
  Japanese: ['ramen', 'sushi', 'japanese'],
  Caribbean: ['jerk', 'oxtail', 'caribbean'],
  Ethiopian: ['injera', 'tibs', 'ethiopian'],
  American: ['burger', 'bbq', 'american', 'wings'],
  Mediterranean: ['shakshuka', 'falafel', 'mediterranean'],
  Healthy: ['salad', 'bowl', 'healthy', 'vegan'],
};

function cuisineMatchScore(prepper: PrepperLike, affinities: CuisineAffinities): number {
  const cuisine = (prepper.cuisine ?? '').toLowerCase();
  const specialties = (prepper.specialties ?? []).map((s) => s.toLowerCase()).join(' ');
  let score = 0;
  affinities.forEach((affinity, cuisineName) => {
    const tags = CUISINE_TAGS_MAP[cuisineName] ?? [cuisineName.toLowerCase()];
    if (tags.some((t) => cuisine.includes(t) || specialties.includes(t))) {
      score += affinity * 4;
    }
  });
  return score;
}

export function scorePrepperForUser(prepper: PrepperLike, signals: MatchSignals): { score: number; reason: string } {
  let score = (prepper.rating ?? 3) * 0.5; // quality base (0–2.5)
  let reason = 'highly rated in your area';

  // Previously ordered
  if (signals.orderedPreppers.has(prepper.name)) { score += 3.5; reason = `you've ordered from ${prepper.name} before`; }

  // Favourited
  if (signals.favPrepperKeys.has(`prepper:${prepper.id}`)) { score += 2.5; reason = `one of your saved kitchens`; }

  // Cuisine affinity
  const cuisineScore = cuisineMatchScore(prepper, signals.cuisineAffinities);
  if (cuisineScore > 0) {
    score += cuisineScore;
    if (prepper.cuisine && cuisineScore > 2) reason = `cooks ${prepper.cuisine} — your go-to cuisine`;
  }

  // Currently available bonus
  if (prepper.isAvailable) score += 1;

  // Established kitchen bonus
  if ((prepper.orderCount ?? 0) > 50) score += 0.8;

  // Slight deterministic jitter for tie-breaking
  let h = 0;
  for (let i = 0; i < prepper.id.length; i++) h = (h * 31 + prepper.id.charCodeAt(i)) % 1000;
  score += (h / 1000) * 0.3;

  return { score, reason };
}

export function rankPreppers<T extends PrepperLike>(preppers: T[], signals: MatchSignals): (T & { matchScore: number; matchReason: string })[] {
  return preppers
    .map((p) => {
      const { score, reason } = scorePrepperForUser(p, signals);
      return { ...p, matchScore: score, matchReason: reason };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ─── React Hook ───────────────────────────────────────────────────────────────

/** Live ranked preppers for the signed-in user, derived from real signals. */
export function useRankedPreppers<T extends PrepperLike>(preppers: T[], userId?: string | null): (T & { matchScore: number; matchReason: string })[] {
  const favKeys = useFavoriteKeys();
  const { data: orders } = useMyOrders(userId);
  return useMemo(() => {
    const signals = buildMatchSignals(orders ?? [], favKeys);
    return rankPreppers(preppers, signals);
  }, [preppers, favKeys, orders]);
}
