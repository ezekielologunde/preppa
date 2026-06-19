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
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client mistakes, not transient failures)
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30_000), // 1s, 2s, 4s, max 30s
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
