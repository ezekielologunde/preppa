import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type HolidayEventRow = {
  id: string;
  key: string;
  name: string;
  emoji: string;
  date_str: string;
  description: string;
  color_hex: string;
  dishes: string[];
  active: boolean;
  sort_order: number;
  created_at: string;
};

export function useHolidayEvents() {
  return useQuery({
    queryKey: ['holiday-events'],
    queryFn: async (): Promise<HolidayEventRow[]> => {
      const { data, error } = await supabase
        .from('holiday_events')
        .select('*')
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data as HolidayEventRow[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });
}
