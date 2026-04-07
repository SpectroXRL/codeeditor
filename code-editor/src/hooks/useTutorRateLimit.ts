import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'ai_tutor_calls';
const MAX_CALLS_PER_HOUR = 15;
const HOUR_IN_MS = 60 * 60 * 1000;

interface RateLimitState {
  calls: number[];
}

function getStoredState(): RateLimitState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { calls: [] };
}

function saveState(state: RateLimitState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function filterRecentCalls(calls: number[]): number[] {
  const oneHourAgo = Date.now() - HOUR_IN_MS;
  return calls.filter((timestamp) => timestamp > oneHourAgo);
}

function getInitialCalls(userId: string | null): number[] {
  if (!userId) return [];
  const state = getStoredState();
  return filterRecentCalls(state.calls);
}

export interface UseTutorRateLimitResult {
  canCall: boolean;
  callsRemaining: number;
  callsUsed: number;
  resetTime: Date | null;
  recordCall: () => void;
  maxCalls: number;
}

/**
 * Rate limiting hook for tutor API calls
 * Separate from error explanation limit (15/hour vs 10/hour)
 */
export function useTutorRateLimit(userId: string | null): UseTutorRateLimitResult {
  const [calls, setCalls] = useState<number[]>(() => getInitialCalls(userId));

  // Re-filter calls periodically to update UI when limits reset
  useEffect(() => {
    const interval = setInterval(() => {
      setCalls((prev) => filterRecentCalls(prev));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Sync with localStorage when userId changes
  useEffect(() => {
    setCalls(getInitialCalls(userId));
  }, [userId]);

  const recordCall = useCallback(() => {
    if (!userId) return;

    const now = Date.now();
    setCalls((prev) => {
      const recentCalls = filterRecentCalls(prev);
      const newCalls = [...recentCalls, now];
      saveState({ calls: newCalls });
      return newCalls;
    });
  }, [userId]);

  const recentCalls = filterRecentCalls(calls);
  const callsUsed = recentCalls.length;
  const callsRemaining = Math.max(0, MAX_CALLS_PER_HOUR - callsUsed);
  const canCall = callsRemaining > 0;

  // Calculate when the oldest call will expire (reset time)
  let resetTime: Date | null = null;
  if (recentCalls.length > 0 && !canCall) {
    const oldestCall = Math.min(...recentCalls);
    resetTime = new Date(oldestCall + HOUR_IN_MS);
  }

  return {
    canCall,
    callsRemaining,
    callsUsed,
    resetTime,
    recordCall,
    maxCalls: MAX_CALLS_PER_HOUR,
  };
}
