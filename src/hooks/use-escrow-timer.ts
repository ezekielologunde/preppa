import { useEffect, useState } from 'react';

export type EscrowTimerState = {
  timeLeft: string;   // "HH:MM:SS"
  hoursLeft: number;
  isExpired: boolean;
  isUrgent: boolean;  // true when < 4 hours remain
  progress: number;   // 1 → 0 over the 24h window (for progress bar)
};

const WINDOW_MS = 24 * 60 * 60 * 1_000;

function compute(autoReleaseAt: string | null): EscrowTimerState {
  if (!autoReleaseAt) {
    return { timeLeft: '—', hoursLeft: 24, isExpired: false, isUrgent: false, progress: 1 };
  }
  const remaining = Math.max(0, new Date(autoReleaseAt).getTime() - Date.now());
  const isExpired = remaining === 0;
  const hoursLeft = Math.floor(remaining / 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = hoursLeft;
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  return {
    timeLeft: isExpired ? '00:00:00' : `${pad(h)}:${pad(m)}:${pad(s)}`,
    hoursLeft,
    isExpired,
    isUrgent: hoursLeft < 4,
    progress: Math.min(1, remaining / WINDOW_MS),
  };
}

export function useEscrowTimer(autoReleaseAt: string | null): EscrowTimerState {
  const [state, setState] = useState<EscrowTimerState>(() => compute(autoReleaseAt));

  useEffect(() => {
    setState(compute(autoReleaseAt));
    if (!autoReleaseAt) return;
    const id = setInterval(() => setState(compute(autoReleaseAt)), 1_000);
    return () => clearInterval(id);
  }, [autoReleaseAt]);

  return state;
}
