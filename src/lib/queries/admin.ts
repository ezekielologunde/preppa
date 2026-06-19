import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import type {
  AdminDisputeRow,
  MarketplaceFit,
  OrderStatus,
  PlatformStats,
  PrepperEarningsRow,
  PrepperStatus,
  UserStatus,
} from '@/types/database.types';

// ---------------------------------------------------------------------------
// READS — all gated server-side by is_admin(); a non-admin simply gets empties.
// ---------------------------------------------------------------------------

/** One-shot platform snapshot for the overview (counts + GMV). */
export function usePlatformStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async (): Promise<PlatformStats | null> => {
      const { data, error } = await supabase.rpc('admin_platform_stats');
      if (error) throw error;
      return (data as PlatformStats | null) ?? null;
    },
  });
}

/** The marketplace-fit signal: do customers reorder from the same prepper? */
export function useMarketplaceFit() {
  return useQuery({
    queryKey: ['admin', 'marketplace-fit'],
    queryFn: async (): Promise<MarketplaceFit | null> => {
      const { data, error } = await supabase.rpc('admin_marketplace_fit');
      if (error) throw error;
      return (data as MarketplaceFit | null) ?? null;
    },
  });
}

export type AdminPrepper = {
  id: string;
  display_name: string;
  bio: string | null;
  verified: boolean;
  status: PrepperStatus;
  rejection_note: string | null;
  created_at: string;
  is_featured: boolean;
  featured_at: string | null;
  user: { full_name: string | null; email: string | null; phone: string | null } | null;
};

/** Preppers filtered by application status — drives the approval queue. */
export function useAdminPreppers(status?: PrepperStatus) {
  return useQuery({
    queryKey: ['admin', 'preppers', status ?? 'all'],
    queryFn: async (): Promise<AdminPrepper[]> => {
      // Use SECURITY DEFINER RPC to bypass RLS and avoid PostgREST FK ambiguity
      // (prepper_profiles has two FKs to profiles: user_id + reviewed_by).
      const { data, error } = await supabase.rpc('admin_list_preppers', {
        p_status: status ?? 'all',
      });
      if (error) throw error;
      type Row = { id: string; display_name: string; bio: string | null; verified: boolean; status: string; rejection_note: string | null; created_at: string; user_full_name: string | null; user_email: string | null; user_phone: string | null; is_featured: boolean; featured_at: string | null };
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        display_name: r.display_name,
        bio: r.bio,
        verified: r.verified,
        status: r.status as PrepperStatus,
        rejection_note: r.rejection_note,
        created_at: r.created_at,
        is_featured: r.is_featured ?? false,
        featured_at: r.featured_at ?? null,
        user: { full_name: r.user_full_name, email: r.user_email, phone: r.user_phone },
      }));
    },
  });
}

export type AdminCustomer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  created_at: string;
};

/** All customer accounts, newest first; optional name/email search. */
export function useAdminCustomers(search?: string) {
  const term = search?.trim();
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'customers', term ?? ''],
    queryFn: async (): Promise<AdminCustomer[]> => {
      if (!isAdmin) throw new Error('Unauthorized');
      let q = supabase
        .from('profiles')
        .select('id,full_name,email,phone,status,created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (term) {
        const safe = term.replace(/[,(){}<>]/g, ' ').replace(/\s+/g, ' ').trim();
        q = q.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AdminCustomer[];
    },
  });
}

export type CustomerOrderStat = {
  order_count: number;
  completed_count: number;
  total_spend: number;
};

/** Lightweight order-count + spend map keyed by customer_id for the customers panel. */
export function useAdminCustomerOrderStats() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'customer-order-stats'],
    queryFn: async (): Promise<Map<string, CustomerOrderStat>> => {
      if (!isAdmin) throw new Error('Unauthorized');
      const { data, error } = await supabase
        .from('orders')
        .select('customer_id,total,status');
      if (error) throw error;
      const map = new Map<string, CustomerOrderStat>();
      for (const row of (data ?? []) as { customer_id: string; total: number; status: string }[]) {
        const s = map.get(row.customer_id) ?? { order_count: 0, completed_count: 0, total_spend: 0 };
        s.order_count += 1;
        if (row.status === 'completed') {
          s.completed_count += 1;
          s.total_spend += Number(row.total ?? 0);
        }
        map.set(row.customer_id, s);
      }
      return map;
    },
  });
}

export type AdminOrder = {
  id: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  tax: number;
  delivery_fee: number;
  service_fee: number;
  tip: number;
  created_at: string;
  customer: { full_name: string | null; email: string | null } | null;
  prepper: { display_name: string } | null;
  items: { quantity: number; unit_price: number; total: number; meal: { title: string } | null }[];
  payment: { status: string; amount: number; provider: string } | null;
};

/** Recent orders with line items + payment — the receipts view. */
export function useAdminOrders(status?: OrderStatus) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'orders', status ?? 'all'],
    queryFn: async (): Promise<AdminOrder[]> => {
      if (!isAdmin) throw new Error('Unauthorized');
      let q = supabase
        .from('orders')
        .select(
          'id,status,total,subtotal,tax,delivery_fee,service_fee,tip,created_at,' +
            'customer:profiles!orders_customer_id_fkey(full_name,email),' +
            'prepper:prepper_profiles(display_name),' +
            'items:order_items(quantity,unit_price,total,meal:meals(title)),' +
            'payment:payments(status,amount,provider)',
        )
        .order('created_at', { ascending: false })
        .limit(100);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as (Omit<AdminOrder, 'payment'> & { payment: AdminOrder['payment'][] | AdminOrder['payment'] })[]).map(
        (o) => ({ ...o, payment: Array.isArray(o.payment) ? o.payment[0] ?? null : o.payment }),
      );
    },
  });
}

export type AdminOrderItem = { quantity: number; total: number; title: string };

/**
 * Line items for ONE order — lazy-loaded when an admin drills into a dispute.
 * Reuses the exact access path of useAdminOrders (order_items nested through
 * orders) so RLS behaves identically; only fires when `enabled` (card expanded).
 */
export function useAdminOrderItems(orderId: string | null, enabled: boolean) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'order-items', orderId],
    enabled: enabled && !!orderId,
    queryFn: async (): Promise<AdminOrderItem[]> => {
      if (!isAdmin) throw new Error('Unauthorized');
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id,items:order_items(quantity,total,meal:meals(title))')
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw error;
      type Row = { quantity: number; total: number; meal: { title: string } | { title: string }[] | null };
      const items = ((data as { items?: Row[] } | null)?.items ?? []) as Row[];
      return items.map((r) => ({
        quantity: r.quantity,
        total: Number(r.total ?? 0),
        title: (Array.isArray(r.meal) ? r.meal[0]?.title : r.meal?.title) ?? 'item',
      }));
    },
  });
}

/** Per-prepper earnings (GMV, completed sales, order counts) via admin RPC. */
export function usePrepperEarnings() {
  return useQuery({
    queryKey: ['admin', 'earnings'],
    queryFn: async (): Promise<PrepperEarningsRow[]> => {
      const { data, error } = await supabase.rpc('admin_prepper_earnings');
      if (error) throw error;
      return (data ?? []) as PrepperEarningsRow[];
    },
  });
}

export type AdminFlag = {
  key: string;
  label: string;
  description: string | null;
  category: string;
  enabled: boolean;
};

/** All feature flags (admin view — full metadata). */
export function useAdminFlags() {
  return useQuery({
    queryKey: ['admin', 'flags'],
    queryFn: async (): Promise<AdminFlag[]> => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('key,label,description,category,enabled')
        .order('category');
      if (error) throw error;
      return (data ?? []) as AdminFlag[];
    },
  });
}

// ---------------------------------------------------------------------------
// MUTATIONS — every write goes through an admin-guarded SECURITY DEFINER RPC.
// ---------------------------------------------------------------------------

export function useSetPrepperStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { prepperId: string; status: PrepperStatus; note?: string }) => {
      const { error } = await supabase.rpc('admin_set_prepper_status', {
        p_prepper: v.prepperId,
        p_status: v.status,
        p_note: v.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'preppers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      qc.invalidateQueries({ queryKey: ['preppers'] });
    },
  });
}

export function useSetFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { key: string; enabled: boolean }) => {
      const { error } = await supabase.rpc('admin_set_feature_flag', { p_key: v.key, p_enabled: v.enabled });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'flags'] });
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { userId: string; status: UserStatus }) => {
      const { error } = await supabase.rpc('admin_set_user_status', { p_user: v.userId, p_status: v.status });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'customers'] }),
  });
}

export function useGrantRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { userId: string; role: string; revoke?: boolean }) => {
      const fn = v.revoke ? 'admin_revoke_role' : 'admin_grant_role';
      const { error } = await supabase.rpc(fn, { p_user: v.userId, p_role: v.role });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'customers'] }),
  });
}

export function useVerifyPrepper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { prepperId: string; verified: boolean }) => {
      const { error } = await supabase.rpc('admin_verify_prepper', { p_prepper: v.prepperId, p_verified: v.verified });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'preppers'] });
      qc.invalidateQueries({ queryKey: ['preppers'] });
    },
  });
}

// ---------------------------------------------------------------------------
// OVERVIEW CHARTS
// ---------------------------------------------------------------------------

export type GmvWeek = { label: string; gmv: number; orders: number };

export function useAdminGmvChart() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'gmv-chart'],
    staleTime: 300_000,
    queryFn: async (): Promise<GmvWeek[]> => {
      if (!isAdmin) throw new Error('Unauthorized');
      const since = new Date();
      since.setDate(since.getDate() - 56); // 8 weeks
      const { data, error } = await supabase
        .from('orders')
        .select('created_at,total')
        .gte('created_at', since.toISOString())
        .eq('status', 'completed');
      if (error) throw error;

      const weeks: Record<string, { gmv: number; orders: number }> = {};
      for (const row of (data ?? []) as { created_at: string; total: number }[]) {
        const d = new Date(row.created_at);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!weeks[key]) weeks[key] = { gmv: 0, orders: 0 };
        weeks[key].gmv += Number(row.total ?? 0);
        weeks[key].orders++;
      }

      return Object.entries(weeks)
        .slice(-8)
        .map(([label, { gmv, orders }]) => ({ label, gmv, orders }));
    },
  });
}

export type TopPrepper = {
  prepperId: string;
  displayName: string;
  totalRevenue: number;
  orderCount: number;
  avgRating: number;
};

/** Top preppers by revenue, derived from the admin_prepper_earnings() RPC. */
export function useAdminTopPreppers(limit = 10) {
  return useQuery({
    queryKey: ['admin', 'top-preppers', limit],
    staleTime: 300_000,
    queryFn: async (): Promise<TopPrepper[]> => {
      const { data, error } = await supabase.rpc('admin_prepper_earnings');
      if (error) throw error;
      return ((data ?? []) as import('@/types/database.types').PrepperEarningsRow[])
        .sort((a, b) => b.completed_sales - a.completed_sales)
        .slice(0, limit)
        .map((r) => ({
          prepperId: r.prepper_id,
          displayName: r.display_name,
          totalRevenue: r.completed_sales,
          orderCount: r.completed_orders,
          avgRating: r.rating,
        }));
    },
  });
}

export function useAdminDisputes(status: 'open' | 'resolved' | 'dismissed' | 'all' = 'open') {
  return useQuery({
    queryKey: ['admin', 'disputes', status],
    queryFn: async (): Promise<AdminDisputeRow[]> => {
      const { data, error } = await supabase.rpc('admin_list_disputes', { p_status: status });
      if (error) throw error;
      return (data ?? []) as AdminDisputeRow[];
    },
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { disputeId: string; resolution: 'resolved' | 'dismissed'; note?: string }) => {
      const { error } = await supabase.rpc('admin_resolve_dispute', {
        p_dispute: v.disputeId,
        p_resolution: v.resolution,
        p_note: v.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }),
  });
}

// ---------------------------------------------------------------------------
// USER MANAGEMENT
// ---------------------------------------------------------------------------

export type AdminUser = {
  id: string;
  displayName: string;
  email: string | null;
  roles: string[];
  status: UserStatus;
  createdAt: string;
};

/** All profiles with their roles, newest first; optional name/email search (min 2 chars). */
export function useAdminUsers(search: string = '') {
  const term = search.trim();
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['admin', 'users', term],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminUser[]> => {
      if (!isAdmin) throw new Error('Unauthorized');
      let q = supabase
        .from('profiles')
        .select('id,full_name,email,status,created_at,user_roles(roles(key))')
        .order('created_at', { ascending: false })
        .limit(100);
      if (term.length >= 2) {
        const safe = term.replace(/[,(){}<>]/g, ' ').replace(/\s+/g, ' ').trim();
        q = q.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      type Row = { id: string; full_name: string | null; email: string | null; status: string; created_at: string; user_roles: { roles: { key: string } | { key: string }[] | null }[] };
      return ((data ?? []) as unknown as Row[]).map((r) => {
        const roles = (r.user_roles ?? [])
          .map((ur) => (Array.isArray(ur.roles) ? ur.roles[0]?.key : ur.roles?.key))
          .filter((k): k is string => !!k);
        return {
          id: r.id,
          displayName: r.full_name ?? r.email?.split('@')[0] ?? 'Unknown',
          email: r.email,
          roles,
          status: r.status as UserStatus,
          createdAt: r.created_at,
        };
      });
    },
  });
}

export function useAdminUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: UserStatus }) => {
      const { error } = await supabase.rpc('admin_set_user_status', { p_user: userId, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
  });
}

export function useAdminUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role, revoke }: { userId: string; role: string; revoke?: boolean }) => {
      const fn = revoke ? 'admin_revoke_role' : 'admin_grant_role';
      const { error } = await supabase.rpc(fn, { p_user: userId, p_role: role });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
  });
}
