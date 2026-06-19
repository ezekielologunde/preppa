import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Prepper performance insights vs platform benchmarks
// ---------------------------------------------------------------------------

export type PrepperInsights = {
  avgRating: number;
  totalOrders: number;
  repeatRate: number;
  weeklyRevenue: number;
  platformAvgRating: number;
  platformAvgOrders: number;
  percentileRating: number; // 0–100
  streak: number;           // consecutive days with >= 1 completed order
};

export function usePrepperInsights(prepperId?: string | null) {
  return useQuery({
    queryKey: ['prepper-insights', prepperId ?? 'none'],
    enabled: !!prepperId,
    staleTime: 300_000,
    queryFn: async (): Promise<PrepperInsights | null> => {
      if (!prepperId) return null;

      const [ratingRes, platformRes, ordersRes] = await Promise.all([
        supabase
          .from('prepper_rating_summary')
          .select('average_rating')
          .eq('prepper_id', prepperId)
          .single(),
        supabase
          .from('prepper_rating_summary')
          .select('average_rating'),
        supabase
          .from('orders')
          .select('created_at, total, customer_id')
          .eq('prepper_id', prepperId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const myRating = (ratingRes.data as any)?.average_rating ?? 0;
      const allRatings = ((platformRes.data ?? []) as any[])
        .map((r) => r.average_rating as number)
        .filter(Boolean);
      const orders = (ordersRes.data ?? []) as any[];

      // Platform average
      const platformAvgRating = allRatings.length
        ? allRatings.reduce((s, r) => s + r, 0) / allRatings.length
        : 4.0;

      // Percentile
      const below = allRatings.filter((r) => r < myRating).length;
      const percentileRating = allRatings.length
        ? Math.round((below / allRatings.length) * 100)
        : 0;

      // Weekly revenue (current week Sun–today)
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weeklyRevenue = orders
        .filter((o) => new Date(o.created_at) >= weekStart)
        .reduce((s, o) => s + (o.total ?? 0), 0);

      // Repeat customers
      const customerIds = orders.map((o) => o.customer_id).filter(Boolean);
      const uniqueCustomers = new Set(customerIds).size;
      const totalIds = customerIds.length;
      const repeats = totalIds - uniqueCustomers;
      const repeatRate = uniqueCustomers > 0
        ? Math.round((repeats / totalIds) * 100)
        : 0;

      // Streak: consecutive calendar days back from today
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const orderDays = new Set(orders.map((o) => new Date(o.created_at).toDateString()));
      for (let d = new Date(today); streak <= 365; d.setDate(d.getDate() - 1)) {
        if (orderDays.has(d.toDateString())) streak++;
        else break;
      }

      return {
        avgRating: myRating,
        totalOrders: orders.length,
        repeatRate,
        weeklyRevenue,
        platformAvgRating,
        platformAvgOrders: 0,
        percentileRating,
        streak,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Top meals by order count for a prepper
// ---------------------------------------------------------------------------

export type TopMeal = {
  mealId: string;
  title: string;
  orderCount: number;
  revenue: number;
  imageUrl: string | null;
};

type OrderItemRow = {
  meal_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  meal: {
    title: string;
    prepper_id: string;
    images: { url: string }[] | null;
  } | {
    title: string;
    prepper_id: string;
    images: { url: string }[] | null;
  }[] | null;
};

export function useTopMeals(prepperId?: string | null, limit = 5) {
  return useQuery({
    queryKey: ['top-meals', prepperId ?? 'none', limit],
    enabled: !!prepperId,
    staleTime: 300_000,
    queryFn: async (): Promise<TopMeal[]> => {
      const { data, error } = await supabase
        .from('order_items')
        .select(
          'meal_id,quantity,unit_price,total,' +
          'meal:meals!inner(title,prepper_id,images:meal_images(url))',
        )
        .eq('meal.prepper_id', prepperId!);

      if (error) throw error;

      const grouped: Record<string, TopMeal> = {};
      for (const row of ((data ?? []) as unknown as OrderItemRow[])) {
        const mealId = row.meal_id;
        const meal = Array.isArray(row.meal) ? row.meal[0] : row.meal;
        if (!mealId || !meal) continue;
        if (!grouped[mealId]) {
          grouped[mealId] = {
            mealId,
            title: meal.title ?? 'Unknown',
            orderCount: 0,
            revenue: 0,
            imageUrl: meal.images?.[0]?.url ?? null,
          };
        }
        grouped[mealId].orderCount += row.quantity ?? 1;
        grouped[mealId].revenue += row.total ?? (row.unit_price ?? 0) * (row.quantity ?? 1);
      }

      return Object.values(grouped)
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, limit);
    },
  });
}

// ---------------------------------------------------------------------------
// Weekly revenue for a prepper — last 8 weeks grouped Sun–Sat
// ---------------------------------------------------------------------------

export type WeeklyRevenue = { label: string; amount: number; weekStart: Date };

export function useWeeklyRevenue(prepperId?: string | null) {
  return useQuery({
    queryKey: ['weekly-revenue', prepperId ?? 'none'],
    enabled: !!prepperId,
    staleTime: 300_000,
    queryFn: async (): Promise<WeeklyRevenue[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 56);

      const { data, error } = await supabase
        .from('orders')
        .select('created_at,total')
        .eq('prepper_id', prepperId!)
        .eq('status', 'completed')
        .gte('created_at', since.toISOString());

      if (error) throw error;

      // Group by week (Sunday = start)
      const weeks: Record<string, { amount: number; weekStart: Date }> = {};
      for (const row of ((data ?? []) as { created_at: string; total: number }[])) {
        const d = new Date(row.created_at);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const key = weekStart.toISOString();
        if (!weeks[key]) {
          weeks[key] = { amount: 0, weekStart };
        }
        weeks[key].amount += row.total ?? 0;
      }

      // Sort chronologically, take last 8
      return Object.entries(weeks)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([, { amount, weekStart }]) => ({
          label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          amount,
          weekStart,
        }));
    },
  });
}

// ---------------------------------------------------------------------------
// Repeat customer rate for a prepper
// ---------------------------------------------------------------------------

export type RepeatCustomerStats = {
  rate: number;
  repeatCount: number;
  totalUnique: number;
};

export function useRepeatCustomerRate(prepperId?: string | null) {
  return useQuery({
    queryKey: ['repeat-customers', prepperId ?? 'none'],
    enabled: !!prepperId,
    staleTime: 300_000,
    queryFn: async (): Promise<RepeatCustomerStats> => {
      const { data, error } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('prepper_id', prepperId!)
        .eq('status', 'completed');

      if (error) throw error;
      if (!data?.length) return { rate: 0, repeatCount: 0, totalUnique: 0 };

      const counts: Record<string, number> = {};
      for (const r of data as { customer_id: string }[]) {
        counts[r.customer_id] = (counts[r.customer_id] ?? 0) + 1;
      }

      const total = Object.keys(counts).length;
      const repeat = Object.values(counts).filter((c) => c > 1).length;
      return {
        rate: total ? Math.round((repeat / total) * 100) : 0,
        repeatCount: repeat,
        totalUnique: total,
      };
    },
  });
}
