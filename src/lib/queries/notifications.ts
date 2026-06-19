import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

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

/** The signed-in user's notification rows (bids, reviews, follows, renewals).
 *  Call useNotificationsRealtime() once at the app root to get instant updates. */
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

/** Mount once at the app root — opens a single Realtime channel that invalidates
 *  the notifications query instantly on INSERT instead of waiting for the 30s poll. */
export function useNotificationsRealtime(userId?: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);
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
