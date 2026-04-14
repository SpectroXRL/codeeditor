/**
 * useAsync Hook
 * Wraps async functions with automatic loading/error state management
 */

import { useState, useCallback, useRef } from "react";

export interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface UseAsyncReturn<T, Args extends unknown[]> extends UseAsyncState<T> {
  /** Execute the async function */
  execute: (...args: Args) => Promise<T | null>;
  /** Reset state to initial values */
  reset: () => void;
  /** Set data manually */
  setData: (data: T | null) => void;
  /** Set error manually */
  setError: (error: Error | null) => void;
}

/**
 * Hook to manage async operations with loading/error states
 *
 * @param asyncFn - The async function to wrap
 * @param immediate - Whether to execute immediately on mount (default: false)
 *
 * @example
 * const { data, loading, error, execute } = useAsync(fetchUser);
 * // Later: execute(userId);
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
): UseAsyncReturn<T, Args> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  // Track current execution to handle race conditions
  const executionIdRef = useRef(0);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      const currentExecutionId = ++executionIdRef.current;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await asyncFn(...args);

        // Only update state if this is still the latest execution
        if (currentExecutionId === executionIdRef.current) {
          setState({ data: result, loading: false, error: null });
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        // Only update state if this is still the latest execution
        if (currentExecutionId === executionIdRef.current) {
          setState({ data: null, loading: false, error });
        }

        return null;
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    executionIdRef.current++;
    setState({ data: null, loading: false, error: null });
  }, []);

  const setData = useCallback((data: T | null) => {
    setState((prev) => ({ ...prev, data }));
  }, []);

  const setError = useCallback((error: Error | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
    setError,
  };
}
