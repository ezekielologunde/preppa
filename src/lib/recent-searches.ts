import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// Persisted history of the user's recent search queries. Follows the exact
// useSyncExternalStore + AsyncStorage pattern as recently-viewed.ts /
// favorites.ts — dependency-free, reactive, and survives app restarts.

const KEY = 'preppa.recent-searches.v1';
const MAX_SIZE = 8;
const MIN_LEN = 2;

let queries: string[] = [];
const listeners = new Set<() => void>();

let hydrated = false;
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      queries = JSON.parse(raw) as string[];
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* first run / storage unavailable */
    });
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(queries)).catch(() => {
    /* non-fatal */
  });
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Record a query at the front of the list (case-insensitive dedupe, capped). */
export function recordSearch(raw: string) {
  hydrate();
  const q = raw.trim();
  if (q.length < MIN_LEN) return;
  const lower = q.toLowerCase();
  queries = [q, ...queries.filter((x) => x.toLowerCase() !== lower)].slice(0, MAX_SIZE);
  persist();
  listeners.forEach((l) => l());
}

/** Remove a single query (the per-row 'x'). */
export function removeSearch(q: string) {
  hydrate();
  const lower = q.toLowerCase();
  const next = queries.filter((x) => x.toLowerCase() !== lower);
  if (next.length === queries.length) return;
  queries = next;
  persist();
  listeners.forEach((l) => l());
}

let snapshot: string[] | null = null;
function snap(): string[] {
  if (snapshot !== queries) snapshot = queries;
  return snapshot;
}

export function useRecentSearches(): string[] {
  return useSyncExternalStore(subscribe, snap);
}

export function clearRecentSearches() {
  queries = [];
  snapshot = null;
  persist();
  listeners.forEach((l) => l());
}
