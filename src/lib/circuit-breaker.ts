import { useState, useCallback } from 'react';

type CircuitState = 'closed' | 'open' | 'half-open';

// Simple client-side circuit breaker for preventing cascading failures.
// "open" = service is down, stop calling it
// "closed" = service is healthy
// "half-open" = trying one probe request
export function useCircuitBreaker(threshold = 3, resetMs = 30_000) {
  const [state, setState] = useState<CircuitState>('closed');
  const [failures, setFailures] = useState(0);
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  const recordSuccess = useCallback(() => {
    setFailures(0);
    setState('closed');
    setOpenedAt(null);
  }, []);

  const recordFailure = useCallback(() => {
    setFailures((f) => {
      const next = f + 1;
      if (next >= threshold) {
        setState('open');
        setOpenedAt(Date.now());
      }
      return next;
    });
  }, [threshold]);

  const isOpen = useCallback((): boolean => {
    if (state === 'closed') return false;
    if (state === 'open' && openedAt != null && Date.now() - openedAt > resetMs) {
      setState('half-open');
      return false; // allow one probe
    }
    return state === 'open';
  }, [state, openedAt, resetMs]);

  return { isOpen, recordSuccess, recordFailure, state };
}
