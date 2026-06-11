import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
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
  user: { full_name: string | null; email: string | null; phone: string | null } | null;
};

/** Preppers filtered by application status — drives the approval queue. */
export function useAdminPreppers(status?: PrepperStatus) {
  return useQuery({
    queryKey: ['admin', 'preppers', status ?? 'all'],
    queryFn: async (): Promise<AdminPrepper[]> => {
      // Disambiguate: prepper_profiles has two FKs to profiles (user_id + reviewed_by).
      // PostgREST requires an explicit hint when multiple FKs point to the same table.
      let q = supabase
        .from('prepper_profiles')
        .select('id,display_name,bio,verified,status,rejection_note,created_at,user:profiles!prepper_profiles_user_id_fkey(full_name,email,phone)')
        .order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AdminPrepper[];
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
  return useQuery({
    queryKey: ['admin', 'customers', term ?? ''],
    queryFn: async (): Promise<AdminCustomer[]> => {
      let q = supabase
        .from('profiles')
        .select('id,full_name,email,phone,status,created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AdminCustomer[];
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
  return useQuery({
    queryKey: ['admin', 'orders', status ?? 'all'],
    queryFn: async (): Promise<AdminOrder[]> => {
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
