import { supabase } from '@/lib/supabase';
import type { Kitchen, KitchenStatus } from '@/types/database.types';

/**
 * Kitchen Status Service
 *
 * Single source of truth for a kitchen's operational state.
 * Every screen that shows availability uses this — never raw DB fields.
 *
 * Server-side priority: manual override → vacation → capacity → hours → accepting_orders
 */
export async function getKitchenStatus(kitchenId: string): Promise<KitchenStatus> {
  const { data, error } = await supabase.rpc('get_kitchen_status', {
    p_kitchen_id: kitchenId,
  });
  if (error) throw new Error(error.message);
  return data as KitchenStatus;
}

export async function getMyKitchen(): Promise<Kitchen | null> {
  const { data, error } = await supabase
    .from('kitchens')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getKitchenById(kitchenId: string): Promise<Kitchen | null> {
  const { data, error } = await supabase
    .from('kitchens')
    .select('*')
    .eq('id', kitchenId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateKitchenProfile(
  kitchenId: string,
  patch: { display_name?: string; bio?: string; daily_capacity?: number },
) {
  const { error } = await supabase
    .from('kitchens')
    .update(patch)
    .eq('id', kitchenId);
  if (error) throw new Error(error.message);
}

/**
 * Manual override — set to null to return to computed status.
 * Use for: emergency pause, marking busy, going offline temporarily.
 */
export async function setStatusOverride(
  kitchenId: string,
  override: KitchenStatus | null,
) {
  const { error } = await supabase
    .from('kitchens')
    .update({ status_override: override })
    .eq('id', kitchenId);
  if (error) throw new Error(error.message);
}

/**
 * Vacation mode — blocks all orders until the given date.
 * Pass null to end vacation immediately.
 */
export async function setVacationMode(kitchenId: string, until: Date | null) {
  const { error } = await supabase
    .from('kitchens')
    .update({
      vacation_until: until?.toISOString() ?? null,
      status_override: null, // clear override when going on/off vacation
    })
    .eq('id', kitchenId);
  if (error) throw new Error(error.message);
}

/**
 * Today's capacity snapshot: { limit, accepted, remaining }.
 * Returns null if no capacity row exists (kitchen hasn't had orders today).
 */
export async function getTodayCapacity(kitchenId: string): Promise<{
  daily_limit: number;
  orders_accepted: number;
  remaining: number;
} | null> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from('kitchen_capacity')
    .select('daily_limit, orders_accepted')
    .eq('kitchen_id', kitchenId)
    .eq('date', today)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    daily_limit: data.daily_limit,
    orders_accepted: data.orders_accepted,
    remaining: Math.max(0, data.daily_limit - data.orders_accepted),
  };
}

/** Human-readable label for each kitchen status. */
export const KITCHEN_STATUS_LABELS: Record<KitchenStatus, string> = {
  accepting_orders: 'Accepting Orders',
  busy:             'Busy',
  limited:          'Limited Availability',
  booked:           'Fully Booked',
  vacation:         'On Vacation',
  offline:          'Offline',
  emergency_pause:  'Paused',
};

/** Whether the kitchen is currently taking new orders. */
export function isAcceptingOrders(status: KitchenStatus): boolean {
  return status === 'accepting_orders' || status === 'busy';
}
