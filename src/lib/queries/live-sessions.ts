import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type ActiveLiveSession = {
  id: string;
  started_at: string;
  title: string | null;
  viewer_count: number;
};

export function useMyActiveLiveSession(prepperId?: string | null) {
  return useQuery({
    queryKey: ['my-live-session', prepperId ?? 'none'],
    enabled: !!prepperId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('id, started_at, title, viewer_count')
        .eq('prepper_id', prepperId!)
        .is('ended_at', null)
        .maybeSingle();
      return data ?? null;
    },
  });
}

export type LiveSessionCard = {
  id: string;
  prepperId: string;
  prepperName: string;
  avatarUrl: string | null;
  title: string | null;
  viewerCount: number;
  startedAt: string;
};

export function useActiveLiveSessions() {
  return useQuery({
    queryKey: ['live-sessions'],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<LiveSessionCard[]> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, prepper_id, title, viewer_count, started_at, prepper:preppers(display_name, avatar_url)')
        .is('ended_at', null)
        .order('viewer_count', { ascending: false })
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => {
        const prepper = Array.isArray(r.prepper) ? r.prepper[0] : r.prepper;
        return {
          id: r.id,
          prepperId: r.prepper_id,
          prepperName: prepper?.display_name ?? 'Kitchen',
          avatarUrl: prepper?.avatar_url ?? null,
          title: r.title,
          viewerCount: r.viewer_count ?? 0,
          startedAt: r.started_at,
        };
      });
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
