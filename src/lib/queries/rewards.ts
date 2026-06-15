import { useMyOrders, type OrderSummary } from '@/lib/queries/orders';

/** Points earned per $1 of completed spend. */
const POINTS_PER_DOLLAR = 10;

export type TierKey = 'bronze' | 'silver' | 'gold';

export type Tier = {
  key: TierKey;
  name: string;
  /** Lifetime completed spend ($) required to reach this tier. */
  min: number;
  color: string;
  perks: string[];
};

// Ascending. A customer is in the highest tier whose `min` they've passed.
export const TIERS: Tier[] = [
  { key: 'bronze', name: 'Bronze', min: 0, color: '#B45309', perks: ['Earn 10 points per $1', 'Member-only meal drops'] },
  { key: 'silver', name: 'Silver', min: 150, color: '#6B7280', perks: ['Everything in Bronze', 'Early access to new preppers', 'Birthday treat'] },
  { key: 'gold', name: 'Gold', min: 500, color: '#D97706', perks: ['Everything in Silver', 'Free delivery on every order', 'Priority support', '2× points events'] },
];

export type Rewards = {
  points: number;
  lifetimeSpend: number;
  orders: number;
  tier: Tier;
  nextTier: Tier | null;
  /** 0–1 progress from current tier toward the next. */
  progress: number;
  /** $ remaining to the next tier (0 if maxed). */
  toNext: number;
};

export function rewardsFromOrders(orders: OrderSummary[] | undefined): Rewards {
  const completed = (orders ?? []).filter((o) => o.status === 'completed');
  const lifetimeSpend = completed.reduce((s, o) => s + o.total, 0);
  const points = Math.floor(lifetimeSpend * POINTS_PER_DOLLAR);

  let tier = TIERS[0];
  for (const t of TIERS) if (lifetimeSpend >= t.min) tier = t;
  const nextTier = TIERS.find((t) => t.min > tier.min) ?? null;

  const span = nextTier ? nextTier.min - tier.min : 1;
  const progress = nextTier ? Math.min((lifetimeSpend - tier.min) / span, 1) : 1;
  const toNext = nextTier ? Math.max(nextTier.min - lifetimeSpend, 0) : 0;

  return { points, lifetimeSpend, orders: completed.length, tier, nextTier, progress, toNext };
}

/** Live rewards for the signed-in customer, derived from real completed orders. */
export function useRewards(userId?: string | null): Rewards & { refetch: ReturnType<typeof useMyOrders>['refetch']; isLoading: boolean; isError: boolean } {
  const { data: orders, isLoading, isError, refetch } = useMyOrders(userId);
  return { ...rewardsFromOrders(orders), isLoading, isError, refetch };
}
