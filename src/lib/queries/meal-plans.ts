import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { PlanFrequency } from '@/types/database.types';

export type MealPlan = {
  id: string;
  prepper_id: string;
  name: string;
  description: string | null;
  frequency: string;
  price: number;
  meals_per_cycle: number;
  serves: number;
  image_url: string | null;
  tags: string[] | null;
  prepper: string;
};

type Row = MealPlan & { prepper_profiles?: { display_name: string } | { display_name: string }[] | null };

const PLAN_SELECT = 'id,prepper_id,name,description,frequency,price,meals_per_cycle,serves,image_url,tags,prepper_profiles(display_name)';

function mapPlan(r: Row): MealPlan {
  const pp = Array.isArray(r.prepper_profiles) ? r.prepper_profiles[0] : r.prepper_profiles;
  return { ...r, prepper: pp?.display_name ?? 'prepper' };
}

/** Active meal plans for the browse catalog (live; empty until plans exist). */
export function useMealPlans() {
  return useQuery({
    queryKey: ['meal-plans', 'active'],
    queryFn: async (): Promise<MealPlan[]> => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select(PLAN_SELECT)
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(mapPlan);
    },
  });
}

/** A single kitchen's active subscription plans (for its storefront profile). */
export function useKitchenPlans(prepperId?: string | null) {
  return useQuery({
    queryKey: ['meal-plans', 'kitchen', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<MealPlan[]> => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select(PLAN_SELECT)
        .eq('prepper_id', prepperId!)
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(mapPlan);
    },
  });
}

export type DeliveryDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type MySubscription = {
  id: string;
  plan_name: string;
  frequency: string;
  status: string;
  next_billing_at: string | null;
  qty: number;
  delivery_day: DeliveryDay | null;
  prepper: { display_name: string } | null;
};

/** The signed-in customer's meal-plan subscriptions. */
export function useMySubscriptions(userId?: string | null) {
  return useQuery({
    queryKey: ['subscriptions', 'mine', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<MySubscription[]> => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id,plan_name,frequency,status,next_billing_at,qty,delivery_day,prepper:prepper_profiles(display_name)')
        .eq('customer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as (Omit<MySubscription, 'prepper'> & { prepper: MySubscription['prepper'] | MySubscription['prepper'][] })[]).map(
        (s) => ({ ...s, prepper: Array.isArray(s.prepper) ? s.prepper[0] ?? null : s.prepper }),
      );
    },
  });
}

const DAY_INDEX: Record<DeliveryDay, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** The next calendar occurrence of a weekday (always in the future). */
export function nextDeliveryDate(day: DeliveryDay): Date {
  const now = new Date();
  const diff = (DAY_INDEX[day] - now.getDay() + 7) % 7 || 7;
  const d = new Date(now);
  d.setDate(now.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Subscribe to a meal plan with servings + a delivery-day schedule. */
export function useSubscribeToPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      userId: string;
      planId: string;
      prepperId: string;
      planName: string;
      frequency: string;
      qty: number;
      deliveryDay: DeliveryDay;
    }) => {
      const { error } = await supabase.from('subscriptions').insert({
        customer_id: v.userId,
        prepper_id: v.prepperId,
        plan_id: v.planId,
        plan_name: v.planName,
        frequency: v.frequency,
        qty: v.qty,
        delivery_day: v.deliveryDay,
        next_billing_at: nextDeliveryDate(v.deliveryDay).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['subscriptions', 'mine', v.userId] }),
  });
}

/** Pause / resume / cancel a subscription (RLS: customers update their own). */
export function useUpdateSubscription(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; status: 'active' | 'paused' | 'cancelled' }) => {
      const { error } = await supabase.from('subscriptions').update({ status: v.status }).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions', 'mine', userId ?? 'anon'] }),
  });
}

// ---------------------------------------------------------------------------
// Prepper-side plan management
// ---------------------------------------------------------------------------

export type PrepperMealPlan = {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  price: number;
  meals_per_cycle: number;
  serves: number;
  active: boolean;
  created_at: string;
};

/** The signed-in prepper's own meal plans (all, including inactive). */
export function useMyPrepperMealPlans(prepperId?: string | null) {
  return useQuery({
    queryKey: ['meal-plans', 'mine', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<PrepperMealPlan[]> => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('id,name,description,frequency,price,meals_per_cycle,serves,active,created_at')
        .eq('prepper_id', prepperId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, price: Number(r.price) }));
    },
  });
}

/** Create a new prepper meal plan. */
export function useCreatePrepperMealPlan(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      name: string;
      description?: string;
      price: number;
      frequency: string;
      mealsPerCycle: number;
      serves: number;
    }) => {
      const { error } = await supabase.from('meal_plans').insert({
        prepper_id: prepperId!,
        name: v.name,
        description: v.description || null,
        price: v.price,
        frequency: v.frequency as PlanFrequency,
        meals_per_cycle: v.mealsPerCycle,
        serves: v.serves,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plans', 'mine', prepperId ?? 'none'] });
      qc.invalidateQueries({ queryKey: ['meal-plans', 'active'] });
      qc.invalidateQueries({ queryKey: ['meal-plans', 'kitchen', prepperId ?? 'none'] });
    },
  });
}

/** Toggle a plan active/inactive or delete it. */
export function useUpdatePrepperMealPlan(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; active: boolean }) => {
      const { error } = await supabase.from('meal_plans').update({ active: v.active }).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plans', 'mine', prepperId ?? 'none'] });
      qc.invalidateQueries({ queryKey: ['meal-plans', 'active'] });
      qc.invalidateQueries({ queryKey: ['meal-plans', 'kitchen', prepperId ?? 'none'] });
    },
  });
}

/** Skip the next delivery — bumps next_billing_at forward one cycle, no charge. */
export function useSkipDelivery(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<{ ok: boolean; next?: string; reason?: string }> => {
      const { data, error } = await supabase.rpc('skip_subscription_delivery', { p_id: id });
      if (error) throw error;
      return data as unknown as { ok: boolean; next?: string; reason?: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions', 'mine', userId ?? 'anon'] }),
  });
}
