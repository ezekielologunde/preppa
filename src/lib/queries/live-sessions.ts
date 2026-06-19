import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type ActiveLiveSession = {
  id: string;
  started_at: string;
  title: string | null;
  stream_url: string | null;
};

export function useMyActiveLiveSession(prepperId?: string | null) {
  return useQuery({
    queryKey: ['my-live-session', prepperId ?? 'none'],
    enabled: !!prepperId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('id, started_at, title, stream_url')
        .eq('prepper_id', prepperId!)
        .is('ended_at', null)
        .maybeSingle();
      return (data as ActiveLiveSession | null) ?? null;
    },
  });
}

export function useStartLiveSession(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      const { data, error } = await supabase
        .from('live_sessions')
        .insert({ prepper_id: prepperId!, title: title || null })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-live-session', prepperId] });
      qc.invalidateQueries({ queryKey: ['live-sessions'] });
    },
  });
}

export function useEndLiveSession(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('live_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-live-session', prepperId] });
      qc.invalidateQueries({ queryKey: ['live-sessions'] });
    },
  });
}
