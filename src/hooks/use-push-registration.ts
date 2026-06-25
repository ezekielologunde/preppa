import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';

// Foreground notifications: show a banner + play sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers this device's Expo push token for the signed-in user and keeps it
 * fresh. No-op on web / simulators (no push token available there).
 *
 * Pass the current user id; pass null when signed out (the effect then skips).
 */
export function usePushRegistration(userId: string | null): void {
  useEffect(() => {
    if (!userId || Platform.OS === 'web' || !Device.isDevice) return;

    let cancelled = false;

    (async () => {
      try {
        const settings = await Notifications.getPermissionsAsync();
        let status = settings.status;
        if (status !== 'granted') {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (status !== 'granted' || cancelled) return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const { data: token } = await Notifications.getExpoPushTokenAsync();
        if (!token || cancelled) return;
        await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
      } catch {
        // Push is best-effort — never block the app on registration failure.
      }
    })();

    // Token can rotate while the app is open.
    const sub = Notifications.addPushTokenListener(({ data: token }) => {
      if (token) supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS }).then(() => {}, () => {});
    });

    return () => { cancelled = true; sub.remove(); };
  }, [userId]);
}
