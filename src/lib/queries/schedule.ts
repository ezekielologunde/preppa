import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type DaySchedule = { open: boolean; from: string; to: string };
export type CookSchedule = Record<string, DaySchedule>;

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const DEFAULT_SCHEDULE: CookSchedule = Object.fromEntries(
  DAYS.map((d) => [d, { open: ['mon', 'tue', 'wed', 'thu', 'fri'].includes(d), from: '10:00 AM', to: '6:00 PM' }])
);

export function genTimes(): string[] {
  const times: string[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      const period = h < 12 ? 'AM' : 'PM';
      const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      times.push(`${hour}:${m === 0 ? '00' : '30'} ${period}`);
    }
  }
  return times;
}

export function useCookSchedule(prepperId?: string | null) {
  return useQuery({
    queryKey: ['cook-schedule', prepperId ?? 'none'],
    enabled: !!prepperId,
    queryFn: async (): Promise<CookSchedule> => {
      const { data, error } = await supabase
        .from('prepper_profiles')
        .select('cook_schedule')
        .eq('id', prepperId!)
        .single();
      if (error) throw error;
      return (data as unknown as { cook_schedule: CookSchedule | null }).cook_schedule ?? DEFAULT_SCHEDULE;
    },
  });
}

export function useSaveCookSchedule(prepperId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: CookSchedule) => {
      const { error } = await supabase
        .from('prepper_profiles')
        .update({ cook_schedule: schedule as unknown as import('@/types/database.types').Json })
        .eq('id', prepperId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cook-schedule', prepperId] });
      qc.invalidateQueries({ queryKey: ['prepper', 'profile', prepperId] });
    },
  });
}

/** Parse a time string in either "H:MM AM/PM" or "HH:MM" (24h) format to minutes since midnight. */
export function parseTimeToMinutes(t: string): number {
  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const period = ampm[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }
  // Fall back to HH:MM 24-hour
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isKitchenOpenNow(schedule: CookSchedule | null | undefined): boolean {
  if (!schedule) return true; // no schedule = always available
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = dayKeys[new Date().getDay()];
  const day = schedule[dayKey] as DaySchedule | undefined;
  if (!day?.open) return false;
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  return currentMinutes >= parseTimeToMinutes(day.from) && currentMinutes < parseTimeToMinutes(day.to);
}

export function nextOpenTime(schedule: CookSchedule | null | undefined): string | null {
  if (!schedule) return null;
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const nextDayIdx = (now.getDay() + i) % 7;
    const dayKey = dayKeys[nextDayIdx];
    const day = schedule[dayKey] as DaySchedule | undefined;
    if (day?.open) {
      const label = i === 1 ? 'tomorrow' : DAY_LABELS[dayKey as Day];
      return `Opens ${label} at ${day.from}`;
    }
  }
  return null;
}

/**
 * Compress consecutive days with identical hours into display ranges.
 * Returns rows like "Mon – Fri  10am – 6pm" or "Sat – Sun  Closed".
 */
export function compressSchedule(schedule: CookSchedule): { label: string; hours: string }[] {
  type Group = { days: Day[]; open: boolean; from: string; to: string };
  const groups: Group[] = [];

  for (const d of DAYS) {
    const slot = schedule[d] ?? { open: false, from: '10:00 AM', to: '6:00 PM' };
    const last = groups[groups.length - 1];
    if (last && last.open === slot.open && last.from === slot.from && last.to === slot.to) {
      last.days.push(d);
    } else {
      groups.push({ days: [d], open: slot.open, from: slot.from, to: slot.to });
    }
  }

  return groups.map(({ days, open, from, to }) => {
    const short = (d: Day) => DAY_LABELS[d].slice(0, 3);
    const label = days.length === 1 ? short(days[0]) : `${short(days[0])} – ${short(days[days.length - 1])}`;
    const fmt = (t: string) => t.replace(':00', '').toLowerCase();
    const hours = open ? `${fmt(from)} – ${fmt(to)}` : 'Closed';
    return { label, hours };
  });
}
