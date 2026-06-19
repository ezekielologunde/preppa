import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type CustomPlanItem = {
  id: string;
  plan_id: string;
  meal_id: string;
  qty: number;
  meal: {
    id: string;
    title: string;
    base_price: number;
    prepper: { id: string; display_name: string; image_url: string | null } | null;
    images: { url: string }[];
  } | null;
};

export type CustomMealPlan = {
  id: string;
  name: string;
  frequency: string;
  delivery_day: string;
  status: 'active' | 'paused' | 'cancelled';
  next_billing_at: string | null;
  created_at: string;
  items: CustomPlanItem[];
};

const PLAN_SELECT =
  'id,name,frequency,delivery_day,status,next_billing_at,created_at,' +
  'items:customer_meal_plan_items(id,plan_id,meal_id,qty,meal:meals(id,title,base_price,prepper:prepper_profiles(id,display_name,image_url),images:meal_images(url)))';

/** All non-cancelled custom plans for the signed-in customer. */
export function useMyCustomPlans(userId?: string | null) {
  return useQuery({
    queryKey: ['custom-meal-plans', 'mine', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<CustomMealPlan[]> => {
      const { data, error } = await supabase
        .from('customer_meal_plans')
        .select(PLAN_SELECT)
        .eq('customer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CustomMealPlan[];
    },
  });
}

/** Single custom plan by ID — used by the plan detail screen. */
export function useCustomPlan(planId?: string | null) {
  return useQuery({
    queryKey: ['custom-meal-plans', 'single', planId ?? 'none'],
    enabled: !!planId,
    staleTime: 60_000,
    queryFn: async (): Promise<CustomMealPlan | null> => {
      const { data, error } = await supabase
        .from('customer_meal_plans')
        .select(PLAN_SELECT)
        .eq('id', planId!)
        .single();
      if (error) throw error;
      return data as unknown as CustomMealPlan;
    },
  });
}

/** Create a new custom plan and populate its meal items. */
export function useCreateCustomPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      name: string;
      frequency: string;
      deliveryDay: string;
      mealIds: string[];
    }): Promise<string> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { data: plan, error: planErr } = await supabase
        .from('customer_meal_plans')
        .insert({ customer_id: user.id, name: v.name, frequency: v.frequency, delivery_day: v.deliveryDay })
        .select('id')
        .single();
      if (planErr) throw planErr;
      const id = (plan as { id: string }).id;
      if (v.mealIds.length > 0) {
        const items = v.mealIds.map((meal_id) => ({ plan_id: id, meal_id, qty: 1 }));
        const { error: itemsErr } = await supabase.from('customer_meal_plan_items').insert(items);
        if (itemsErr) throw itemsErr;
      }
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['custom-meal-plans', 'mine'] });
      qc.invalidateQueries({ queryKey: ['custom-meal-plans', 'single', id] });
    },
  });
}

/** Pause, resume, or cancel a custom plan. */
export function useUpdateCustomPlan(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; status: 'active' | 'paused' | 'cancelled' }) => {
      const { error } = await supabase.from('customer_meal_plans').update({ status: v.status }).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-meal-plans', 'mine', userId ?? 'anon'] }),
  });
}
