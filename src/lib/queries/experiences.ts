import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ExperienceKind, ExperienceStatus } from '@/types/database.types';

export type MyExperienceRequest = {
  id: string;
  kind: ExperienceKind;
  title: string;
  details: string | null;
  guests: number | null;
  budget: number | null;
  event_date: string | null;
  location: string | null;
  status: ExperienceStatus;
  created_at: string;
  bids: { id: string; amount: number; message: string | null; status: string; prepper: { display_name: string } | null }[];
};

/** The signed-in customer's experience requests + any bids received. */
export function useMyExperienceRequests(userId?: string | null) {
  return useQuery({
    queryKey: ['experiences', 'mine', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async (): Promise<MyExperienceRequest[]> => {
      const { data, error } = await supabase
        .from('experience_requests')
        .select('id,kind,title,details,guests,budget,event_date,location,status,created_at,' +
          'bids:experience_bids(id,amount,message,status,prepper:prepper_profiles(display_name))')
        .eq('customer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MyExperienceRequest[];
    },
  });
}

/** Post a new experience request. */
export function useCreateExperienceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      userId: string;
      kind: ExperienceKind;
      title: string;
      details: string;
      guests: number | null;
      budget: number | null;
      location: string;
    }) => {
      const { error } = await supabase.from('experience_requests').insert({
        customer_id: v.userId,
        kind: v.kind,
        title: v.title,
        details: v.details || null,
        guests: v.guests,
        budget: v.budget,
        location: v.location || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['experiences', 'mine', v.userId] }),
  });
}

export type OpenRequest = {
  id: string;
  kind: ExperienceKind;
  title: string;
  details: string | null;
  guests: number | null;
  budget: number | null;
  location: string | null;
  created_at: string;
  myBid: { id: string; amount: number; status: string } | null;
  bidCount: number;
};

/** Open experience requests an approved prepper can bid on (RLS-scoped). */
export function useOpenRequests(prepperId?: string | null) {
  return useQuery({
    queryKey: ['experiences', 'open', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<OpenRequest[]> => {
      const { data, error } = await supabase
        .from('experience_requests')
        .select('id,kind,title,details,guests,budget,location,created_at,bids:experience_bids(id,amount,status,prepper_id)')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      type Row = Omit<OpenRequest, 'myBid' | 'bidCount'> & { bids: { id: string; amount: number; status: string; prepper_id: string }[] };
      return ((data ?? []) as unknown as Row[]).map((r) => {
        const mine = r.bids.find((b) => b.prepper_id === prepperId);
        return { ...r, myBid: mine ? { id: mine.id, amount: mine.amount, status: mine.status } : null, bidCount: r.bids.length };
      });
    },
  });
}

/** Submit a bid on an open request. */
export function useSubmitBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { requestId: string; prepperId: string; amount: number; message: string }) => {
      const { error } = await supabase.from('experience_bids').insert({
        request_id: v.requestId,
        prepper_id: v.prepperId,
        amount: v.amount,
        message: v.message || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiences', 'open'] }),
  });
}

/** Accept a bid — atomically accepts bid, declines others, books request, creates order. */
export function useAcceptBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bidId: string) => {
      const { error } = await supabase.rpc('accept_experience_bid', { p_bid: bidId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experiences', 'mine'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/** Cancel an open request — sets status to 'cancelled'. */
export function useCancelExperienceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('experience_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiences', 'mine'] }),
  });
}

export type BookedExperienceJob = {
  bidId: string;
  amount: number;
  message: string | null;
  requestId: string;
  kind: ExperienceKind;
  title: string;
  details: string | null;
  guests: number | null;
  budget: number | null;
  event_date: string | null;
  location: string | null;
  status: ExperienceStatus;
  created_at: string;
};

/** Experience requests where this prepper's bid was accepted. */
export function usePrepperBookedExperiences(prepperId?: string | null) {
  return useQuery({
    queryKey: ['experiences', 'booked-prepper', prepperId ?? 'none'],
    enabled: !!prepperId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<BookedExperienceJob[]> => {
      const { data, error } = await supabase
        .from('experience_bids')
        .select('id,amount,message,experience_requests(id,kind,title,details,guests,budget,event_date,location,status,created_at)')
        .eq('prepper_id', prepperId!)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });
      if (error) throw error;
      type Row = { id: string; amount: number; message: string | null; experience_requests: { id: string; kind: ExperienceKind; title: string; details: string | null; guests: number | null; budget: number | null; event_date: string | null; location: string | null; status: ExperienceStatus; created_at: string } | null };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        bidId: r.id,
        amount: r.amount,
        message: r.message,
        requestId: r.experience_requests?.id ?? '',
        kind: r.experience_requests?.kind ?? 'catering',
        title: r.experience_requests?.title ?? '',
        details: r.experience_requests?.details ?? null,
        guests: r.experience_requests?.guests ?? null,
        budget: r.experience_requests?.budget ?? null,
        event_date: r.experience_requests?.event_date ?? null,
        location: r.experience_requests?.location ?? null,
        status: r.experience_requests?.status ?? 'booked',
        created_at: r.experience_requests?.created_at ?? '',
      })).filter((j) => j.requestId);
    },
  });
}

/** Update a request's details / food-preference text. */
export function useUpdateRequestDetails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, details }: { requestId: string; details: string }) => {
      const { error } = await supabase
        .from('experience_requests')
        .update({ details: details || null })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiences', 'mine'] }),
  });
}
