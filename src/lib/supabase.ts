import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database.types';
import { env } from './env';

const isWeb = Platform.OS === 'web';

/**
 * Single shared Supabase client (auth, database, storage, realtime).
 *
 * - Native: persists the session in AsyncStorage (auth JWTs can exceed
 *   SecureStore's 2KB limit, so AsyncStorage is the supported store here).
 * - Web: lets supabase-js use the browser's default storage and parse the URL
 *   for OAuth redirects.
 */
export const supabase = createClient<Database>(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: isWeb ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWeb,
    },
  },
);

// Pause/resume token auto-refresh with app foreground state (native only).
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
