import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// Stores the last MAX_SIZE meal IDs visited. Follows the same
// useSyncExternalStore pattern as favorites.ts for a dependency-free,
// reactive, persisted store.

const KEY = 'preppa.recently-viewed.v1';
const MAX_SIZE = 25;

let ids: string[] = [];
const listeners = new Set<() => void>();

let hydrated = false;
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      ids = JSON.parse(raw) as string[];
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* first run / storage unavailable */
    });
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {
    /* non-fatal */
  });
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordMealView(id: string) {
  hydrate();
  // Move to front, deduplicate, cap length
  ids = [id, ...ids.filter((x) => x !== id)].slice(0, MAX_SIZE);
  persist();
  listeners.forEach((l) => l());
}

let snapSource: string[] | null = null;
let snapCount = 0;
function countSnapshot(): number {
  if (snapSource !== ids) {
    snapSource = ids;
    snapCount = ids.length;
  }
  return snapCount;
}

export function useRecentlyViewedCount(): number {
  return useSyncExternalStore(subscribe, countSnapshot);
}

let idsSnapshot: string[] | null = null;
function idsSnap(): string[] {
  if (idsSnapshot !== ids) idsSnapshot = ids;
  return idsSnapshot;
}

export function useRecentlyViewedIds(): string[] {
  return useSyncExternalStore(subscribe, idsSnap);
}

export function clearRecentlyViewed() {
  ids = [];
  idsSnapshot = null;
  snapSource = null;
  persist();
  listeners.forEach((l) => l());
}
