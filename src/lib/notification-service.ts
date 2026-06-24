import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type NotificationType =
  | 'new_order'
  | 'order_update'
  | 'order_cancelled'
  | 'chat'
  | 'review'
  | 'new_follower'
  | 'listing_update'
  | 'capacity_warning'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  priority: NotificationPriority;
  created_at: string;
};

export async function getNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markAsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids });
  if (error) throw new Error(error.message);
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw new Error(error.message);
}

// ── Notification preferences ──────────────────────────────────────────────

export type NotificationChannel = 'in_app' | 'push' | 'email';

export type NotificationPreference = {
  channel: NotificationChannel;
  notification_type: NotificationType;
  enabled: boolean;
};

/** Returns all in_app preferences for the current user. Absent rows = enabled (opt-out). */
export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('channel, notification_type, enabled')
    .eq('channel', 'in_app');
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationPreference[];
}

/** Upsert a single preference for the current user. */
export async function setNotificationPreference(
  channel: NotificationChannel,
  notification_type: NotificationType,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('upsert_notification_preference', {
    p_channel: channel,
    p_notification_type: notification_type,
    p_enabled: enabled,
  });
  if (error) throw new Error(error.message);
}

/**
 * Subscribe to real-time incoming notifications for the current user.
 * Returns an unsubscribe function — call it on component unmount.
 */
export function subscribeToNotifications(
  userId: string,
  onNew: (notification: AppNotification) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      payload => onNew(payload.new as AppNotification),
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
