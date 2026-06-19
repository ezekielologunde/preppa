import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide TanStack Query client. Caching + request dedup here is what keeps
 * backend load flat as the user base grows — most reads should hit this cache,
 * not the network.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min: treat data as fresh, skip refetch storms
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
