import type { FulfillmentType, OrderStatus } from '@/types/database.types';

import { Palette } from '@/constants/theme';

/** Statuses that represent an order still in flight (not terminal). */
export const ACTIVE_STATUSES: readonly OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery',
];

/** Customer-facing status labels. */
export const STATUS_LABEL_CUSTOMER: Record<OrderStatus, string> = {
  pending:          'Pending',
  confirmed:        'Confirmed',
  preparing:        'Prepping',
  ready:            'Ready!',
  out_for_delivery: 'On the way',
  completed:        'Complete',
  cancelled:        'Cancelled',
};

/** Prepper-facing status labels (shorter, ops-optimised). */
export const STATUS_LABEL_PREPPER: Record<OrderStatus, string> = {
  pending:          'New',
  confirmed:        'Confirmed',
  preparing:        'Preparing',
  ready:            'Ready',
  out_for_delivery: 'On the way',
  completed:        'Complete',
  cancelled:        'Cancelled',
};

/** bg / fg token pair for customer-facing status chips and badges. */
export function statusChip(status: OrderStatus): { bg: string; fg: string } {
  switch (status) {
    case 'pending':          return { bg: Palette.amberTint,    fg: Palette.amberDeep };
    case 'confirmed':        return { bg: Palette.confirmedTint, fg: Palette.confirmedDark };
    case 'preparing':        return { bg: Palette.preparingTint, fg: Palette.preparingDark };
    case 'ready':            return { bg: Palette.successTint,   fg: Palette.successDark };
    case 'out_for_delivery': return { bg: Palette.homeCookTint,  fg: Palette.homeCook };
    case 'completed':        return { bg: Palette.successTint,   fg: Palette.successDark };
    case 'cancelled':        return { bg: Palette.cancelledTint, fg: Palette.dangerDeep };
  }
}

/** Single accent color for prepper-side indicators (card border, dot, icon). */
export function statusColor(status: OrderStatus): string {
  switch (status) {
    case 'pending':          return Palette.brand;
    case 'confirmed':        return Palette.cyan;
    case 'preparing':        return Palette.violet;
    case 'ready':            return Palette.success;
    case 'out_for_delivery': return Palette.leafGreen;
    case 'completed':        return Palette.success;
    case 'cancelled':        return Palette.textSecondary;
  }
}

/** Legal status transitions for prepper advancement. Server enforces the same rules. */
export const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending:          { next: 'confirmed', cta: 'Confirm preorder' },
  confirmed:        { next: 'preparing', cta: 'Start prepping' },
  preparing:        { next: 'ready',     cta: 'Mark ready' },
  ready:            { next: 'completed', cta: 'Mark complete' },
  out_for_delivery: { next: 'completed', cta: 'Mark complete' },
};

export const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  pickup:    'Pickup',
  delivery:  'Delivery',
  meetup:    'Meet-up',
  home_cook: 'Home cook',
};

export const FULFILLMENT_COLOR: Record<FulfillmentType, string> = {
  pickup:    Palette.amber,
  delivery:  Palette.cyan,
  meetup:    Palette.violet,
  home_cook: Palette.leafGreen,
};
