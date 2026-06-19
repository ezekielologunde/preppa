import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type AppNotification = {
  id: string;
  type: 'order' | 'payment' | 'chat' | 'follow' | 'review' | 'promotion' | 'drop' | 'live' | 'bid' | 'bid_accepted' | 'approved' | 'rejected';
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
};

/** The signed-in user's notification rows (bids, reviews, follows, renewals). */
export function useNotifications(userId?: string | null) {
  return useQuery({
    queryKey: ['notifications', userId ?? 'anon'],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id,type,title,body,data,read,created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });
}

/** Mark one (or all) of the caller's notifications read. */
export function useMarkNotificationsRead(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id?: string) => {
      const { error } = await supabase.rpc('mark_notifications_read', { p_id: id ?? undefined });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId ?? 'anon'] }),
  });
}
