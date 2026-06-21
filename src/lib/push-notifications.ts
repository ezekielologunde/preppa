import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { Palette } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return; // Web & simulators don't support Expo Push

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  await supabase.from('push_tokens').upsert(
    { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,platform' },
  );
}

export async function clearPushToken(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('push_tokens').delete().eq('user_id', user.id);
}

export function usePushNotificationListeners() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const received = Notifications.addNotificationReceivedListener(_notification => {
      // Notification received while app is foregrounded — no-op for now.
    });

    const response = Notifications.addNotificationResponseReceivedListener(res => {
      const data = res.notification.request.content.data as Record<string, unknown>;
      // Allowlist of routes our edge functions may emit — blocks open-redirect
      // attacks via crafted notification payloads (no schemes, no external hosts).
      const ALLOWED_ROUTES = new Set(['/', '/prepper-orders', '/explore', '/orders', '/experiences', '/dashboard']);
      if (typeof data?.route === 'string' && ALLOWED_ROUTES.has(data.route)) {
        router.push(data.route as never);
        return;
      }
      // Legacy format: { screen: 'order', orderId: string }
      if (data?.screen === 'order' && typeof data.orderId === 'string') {
        router.push(`/order-status?id=${data.orderId}` as never);
      }
    });

    return () => {
      received.remove();
      response.remove();
    };
  }, [router]);
}

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Preppa',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: Palette.brand,
  });
}
