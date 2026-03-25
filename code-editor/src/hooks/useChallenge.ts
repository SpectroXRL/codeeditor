import { useState, useEffect, useCallback, useRef } from 'react';
import type { Challenge, ChallengeAttempt } from '../types/database';
import {
  startChallengeAttempt,
  submitChallengeAttempt,
  abandonAttempt,
  useHint as recordHintUsage,
  getInProgressAttempt,
  calculateScore
} from '../services/challenges';

export type ChallengeState = 'loading' | 'ready' | 'active' | 'submitting' | 'completed' | 'abandoned';

interface UseChallengeOptions {
  challenge: Challenge;
  userId: string;
  onComplete?: (attempt: ChallengeAttempt) => void;
  onAbandon?: () => void;
}

interface UseChallengeReturn {
  state: ChallengeState;
  attempt: ChallengeAttempt | null;
  elapsedSeconds: number;
  hintsUsed: number;
  hintsRemaining: number;
  isOverTime: boolean;
  currentHint: string | null;
  scorePreview: {
    baseScore: number;
    timeBonus: number;
    hintPenalty: number;
    finalScore: number;
  } | null;
  
  startChallenge: () => Promise<void>;
  submitChallenge: (code: string, testsPassed: number, testsTotal: number) => Promise<void>;
  abandonChallenge: () => Promise<void>;
  requestHint: () => Promise<void>;
  error: string | null;
}

export function useChallenge({
  challenge,
  userId,
  onComplete,
  onAbandon
}: UseChallengeOptions): UseChallengeReturn {
  const [state, setState] = useState<ChallengeState>('loading');
  const [attempt, setAttempt] = useState<ChallengeAttempt | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Check for existing in-progress attempt on mount
  useEffect(() => {
    let isMounted = true;

    async function checkExistingAttempt() {
      try {
        const existing = await getInProgressAttempt(userId, challenge.id);
        if (existing && isMounted) {
          setAttempt(existing);
          setHintsUsed(existing.hints_used);
          
          // Calculate elapsed time from when attempt started
          const startTime = new Date(existing.started_at);
          const now = new Date();
          const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          
          setElapsedSeconds(elapsed);
          startTimeRef.current = startTime;
          setState('active');
          
          // Start timer
          timerRef.current = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
          }, 1000);
        } else if (isMounted) {
          setState('ready');
        }
      } catch {
        if (isMounted) {
          setState('ready');
        }
      }
    }

    checkExistingAttempt();

    return () => {
      isMounted = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [userId, challenge.id]);

  const isOverTime = elapsedSeconds > challenge.time_limit_seconds;

  const hintsRemaining = Math.max(0, challenge.hints_allowed - hintsUsed);

  // Calculate score preview for current state
  const scorePreview = attempt ? calculateScore({
    testsPassed: 0, // Unknown until submission
    testsTotal: 1,
    timeTakenSeconds: elapsedSeconds,
    timeLimitSeconds: challenge.time_limit_seconds,
    hintsUsed,
    hintPenaltyPerHint: challenge.hint_penalty
  }) : null;

  const startChallenge = useCallback(async () => {
    setError(null);
    setState('loading');

    try {
      const newAttempt = await startChallengeAttempt(userId, challenge.id);
      setAttempt(newAttempt);
      setHintsUsed(newAttempt.hints_used);
      setElapsedSeconds(0);
      startTimeRef.current = new Date();
      setState('active');

      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start challenge');
      setState('ready');
    }
  }, [userId, challenge.id]);

  const submitChallenge = useCallback(async (
    code: string,
    testsPassed: number,
    testsTotal: number
  ) => {
    if (!attempt) return;

    setError(null);
    setState('submitting');

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const completedAttempt = await submitChallengeAttempt({
        attemptId: attempt.id,
        code,
        testsPassed,
        testsTotal,
        timeTakenSeconds: elapsedSeconds,
        hintsUsed,
        hintPenaltyPerHint: challenge.hint_penalty,
        timeLimitSeconds: challenge.time_limit_seconds
      });

      setAttempt(completedAttempt);
      setState('completed');
      onComplete?.(completedAttempt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit challenge');
      setState('active');
      
      // Restart timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
  }, [attempt, elapsedSeconds, hintsUsed, challenge.hint_penalty, challenge.time_limit_seconds, onComplete]);

  const abandonChallenge = useCallback(async () => {
    if (!attempt) return;

    setError(null);

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await abandonAttempt(attempt.id);
      setState('abandoned');
      onAbandon?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to abandon challenge');
      // Restart timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
  }, [attempt, onAbandon]);

  const requestHint = useCallback(async () => {
    if (!attempt || hintsRemaining <= 0) return;

    try {
      const hints = challenge.hints || [];
      const newHintsUsed = await recordHintUsage(attempt.id);
      setHintsUsed(newHintsUsed);
      
      // Show the hint at index hintsUsed (0-based)
      if (hints[newHintsUsed - 1]) {
        setCurrentHint(hints[newHintsUsed - 1]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to use hint');
    }
  }, [attempt, hintsRemaining, challenge.hints]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    state,
    attempt,
    elapsedSeconds,
    hintsUsed,
    hintsRemaining,
    isOverTime,
    currentHint,
    scorePreview,
    startChallenge,
    submitChallenge,
    abandonChallenge,
    requestHint,
    error
  };
}

// Utility function to format time as MM:SS
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
