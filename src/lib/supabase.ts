import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database.types';
import { env } from './env';

const isWeb = Platform.OS === 'web';

const CHUNK_SIZE = 1800;

const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    try {
      const countStr = await SecureStore.getItemAsync(`${key}__n`);
      if (countStr === null) return null;
      const n = parseInt(countStr, 10);
      const chunks: string[] = [];
      for (let i = 0; i < n; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}__${i}`);
        if (chunk === null) return null;
        chunks.push(chunk);
      }
      return chunks.join('');
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}__n`, String(chunks.length));
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}__${i}`, chunk)));
  },
  async removeItem(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(`${key}__n`).catch(() => null);
    await SecureStore.deleteItemAsync(`${key}__n`).catch(() => {});
    if (countStr) {
      const n = parseInt(countStr, 10);
      await Promise.all(
        Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`).catch(() => {}))
      );
    }
  },
};

export const supabase = createClient<Database>(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: isWeb ? undefined : LargeSecureStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWeb,
    },
  },
);

if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
