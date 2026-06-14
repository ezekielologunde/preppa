import * as Location from 'expo-location';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

type AddressEntry = { id: string; label: string; isDefault: boolean };

export function useGPSLocation(userId: string | undefined, addresses: AddressEntry[]) {
  const [capturing, setCapturing] = useState(false);
  const qc = useQueryClient();

  async function captureLocation(): Promise<'done' | 'denied' | 'error'> {
    if (!userId) return 'error';
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return 'denied';

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      if (!place) return 'error';

      const city = place.city ?? place.district ?? place.subregion ?? '';
      const state = place.region ?? '';

      const existing = addresses.find((a) => a.label === 'GPS');
      if (existing) {
        await supabase.from('addresses')
          .update({ city, state, line1: city, is_default: true })
          .eq('id', existing.id);
        const clearIds = addresses.filter((a) => a.id !== existing.id && a.isDefault).map((a) => a.id);
        if (clearIds.length > 0) {
          await supabase.from('addresses').update({ is_default: false }).in('id', clearIds);
        }
      } else {
        const defaultIds = addresses.filter((a) => a.isDefault).map((a) => a.id);
        if (defaultIds.length > 0) {
          await supabase.from('addresses').update({ is_default: false }).in('id', defaultIds);
        }
        await supabase.from('addresses').insert({
          user_id: userId,
          label: 'GPS',
          line1: city,
          city,
          state,
          postal_code: '',
          country: 'US',
          is_default: true,
        });
      }

      qc.invalidateQueries({ queryKey: ['addresses', userId] });
      return 'done';
    } catch {
      return 'error';
    } finally {
      setCapturing(false);
    }
  }

  return { captureLocation, capturing };
}
