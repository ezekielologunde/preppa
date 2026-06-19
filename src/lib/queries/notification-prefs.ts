import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export function usePushToken(userId?: string | null) {
  return useQuery({
    queryKey: ['push-token', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const platform = (await import('react-native')).Platform.OS;
      const { data } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', userId!)
        .eq('platform', platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'web')
        .maybeSingle();
      return data?.token ?? null;
    },
  });
}

export type NotifPrefs = {
  order_updates: boolean;
  new_followers: boolean;
  meal_drops: boolean;
  promotions: boolean;
  bid_updates: boolean;
  prepper_news: boolean;
  push_enabled: boolean;
};

const DEFAULTS: NotifPrefs = {
  order_updates: true,
  new_followers: true,
  meal_drops: true,
  promotions: false,
  bid_updates: true,
  prepper_news: false,
  push_enabled: true,
};

function prefKey(userId: string | null | undefined) {
  return ['notif-prefs', userId ?? 'anon'] as const;
}

export function useNotifPrefs(userId?: string | null) {
  return useQuery({
    queryKey: prefKey(userId),
    enabled: !!userId,
    staleTime: 300_000,
    queryFn: async (): Promise<NotifPrefs> => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('order_updates,new_followers,meal_drops,promotions,bid_updates,prepper_news,push_enabled')
        .eq('user_id', userId!)
        .maybeSingle();
      return { ...DEFAULTS, ...(data ?? {}) };
    },
  });
}

export function useUpdateNotifPrefs(userId?: string | null) {
  const qc = useQueryClient();
  const key = prefKey(userId);

  return useMutation({
    mutationFn: async (prefs: Partial<NotifPrefs>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onMutate: async (prefs) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<NotifPrefs>(key);
      qc.setQueryData(key, (old: NotifPrefs | undefined) => ({ ...DEFAULTS, ...(old ?? {}), ...prefs }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
