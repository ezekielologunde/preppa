import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import { feedback } from '@/lib/feedback';
import type { Database } from '@/types/database.types';

// Tiny persistent favorites store. Keys are namespaced ("meal:<id>",
// "prepper:<id>", "cuisine:<id>") so one store serves every heart in the app.
// Module-level Set + subscribers keeps it dependency-free; AsyncStorage makes
// hearts survive reloads. Server sync can layer on later without touching the
// component API.

const KEY = 'preppa.favorites.v1';
let favorites = new Set<string>();
const listeners = new Set<() => void>();

let hydrated = false;
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      favorites = new Set(JSON.parse(raw) as string[]);
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* first run / storage unavailable — start empty */
    });
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify([...favorites])).catch(() => {
    /* non-fatal: favorites just won't survive this session */
  });
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleFavorite(key: string, userId?: string, supabaseClient?: SupabaseClient<Database>) {
  const added = !favorites.has(key);
  favorites = new Set(favorites);
  if (added) {
    favorites.add(key);
    feedback.success();
  } else {
    favorites.delete(key);
    feedback.tap();
  }
  persist();
  listeners.forEach((l) => l());
  if (userId && supabaseClient) {
    _syncToggle(key, added, userId, supabaseClient).catch(() => {});
  }
}

/** Sync a toggle to the server (fire-and-forget via caller). */
async function _syncToggle(key: string, added: boolean, userId: string, supabaseClient: SupabaseClient<Database>) {
  if (!key.startsWith('meal:')) return;
  const mealId = key.slice(5);
  if (added) {
    await supabaseClient
      .from('saved_meals')
      .upsert({ user_id: userId, meal_id: mealId }, { onConflict: 'user_id,meal_id' });
  } else {
    await supabaseClient
      .from('saved_meals')
      .delete()
      .eq('user_id', userId)
      .eq('meal_id', mealId);
  }
}

/** Hydrate favorites from the server on sign-in — call once after auth. */
export async function hydrateFromServer(userId: string, supabaseClient: SupabaseClient<Database>) {
  const { data } = await supabaseClient
    .from('saved_meals')
    .select('meal_id')
    .eq('user_id', userId);
  if (data && data.length > 0) {
    favorites = new Set(favorites);
    data.forEach((row) => favorites.add(`meal:${row.meal_id}`));
    persist();
    listeners.forEach((l) => l());
  }
}

/** Is this item hearted? Re-renders on toggle from anywhere in the app. */
export function useFavorite(key: string): boolean {
  return useSyncExternalStore(subscribe, () => favorites.has(key));
}

// Cached array snapshot — recomputed only when the favorites Set is replaced,
// so useSyncExternalStore gets a stable reference between unrelated renders.
let snapSource: Set<string> | null = null;
let snapKeys: string[] = [];
function favoriteKeysSnapshot(): string[] {
  if (snapSource !== favorites) {
    snapSource = favorites;
    snapKeys = [...favorites];
  }
  return snapKeys;
}

/** All favorited keys (e.g. "meal:<id>"), live. */
export function useFavoriteKeys(): string[] {
  return useSyncExternalStore(subscribe, favoriteKeysSnapshot);
}

/** Live count of favorites with the given namespace prefix (e.g. "meal:"). */
export function useFavoritesCount(prefix = ''): number {
  return useSyncExternalStore(subscribe, () => {
    let n = 0;
    favorites.forEach((k) => {
      if (k.startsWith(prefix)) n++;
    });
    return n;
  });
}
