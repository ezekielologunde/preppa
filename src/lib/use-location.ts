import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useDeviceLocation } from '@/providers/location-provider';

/**
 * Purges legacy GPS address rows (from the old use-location implementation that
 * incorrectly wrote device location into the delivery-address table).
 * Runs once when a signed-in user's address list loads.
 */
export function usePurgeGpsAddresses(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    void Promise.resolve(
      supabase
        .from('addresses')
        .delete()
        .eq('user_id', userId)
        .eq('label', 'GPS'),
    ).catch(() => {}); // fire-and-forget; non-critical
  }, [userId]);
}

/**
 * Re-exports useDeviceLocation for screens that previously imported useGPSLocation.
 * Device location is now in-memory only (LocationProvider context) — never written to DB.
 */
export { useDeviceLocation } from '@/providers/location-provider';
