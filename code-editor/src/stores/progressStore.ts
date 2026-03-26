import { create } from 'zustand';
import { supabase } from '../services/supabase';

// ============================================
// Types
// ============================================

type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

interface ProgressEntry {
  subtopicId: string;
  status: ProgressStatus;
  savedCode: string | null;
  lastAccessedAt: string;
}

interface ProgressState {
  // State
  progress: Record<string, ProgressEntry>;
  isHydrated: boolean;
  isHydrating: boolean;
  error: string | null;

  // Actions
  hydrate: (userId: string) => Promise<void>;
  markComplete: (userId: string, subtopicId: string, code: string) => Promise<void>;
  saveCode: (userId: string, subtopicId: string, code: string) => Promise<void>;
  clear: () => void;
}

// ============================================
// Retry Logic
// ============================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<{ success: boolean; data?: T; error?: string }> {
  let lastError: string = '';
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      
      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { success: false, error: lastError };
}

// ============================================
// Store
// ============================================

export const useProgressStore = create<ProgressState>((set, get) => ({
  // Initial state
  progress: {},
  isHydrated: false,
  isHydrating: false,
  error: null,

  // Hydrate progress from database
  hydrate: async (userId: string) => {
    if (get().isHydrating) return;
    
    set({ isHydrating: true, error: null });

    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const progressMap: Record<string, ProgressEntry> = {};
      
      for (const row of data || []) {
        progressMap[row.subtopic_id] = {
          subtopicId: row.subtopic_id,
          status: row.status,
          savedCode: row.saved_code,
          lastAccessedAt: row.last_accessed_at,
        };
      }

      set({ 
        progress: progressMap, 
        isHydrated: true, 
        isHydrating: false 
      });
    } catch (err) {
      console.error('Error hydrating progress:', err);
      set({ 
        isHydrating: false, 
        error: 'Failed to load progress' 
      });
    }
  },

  // Mark a subtopic as complete (optimistic update)
  markComplete: async (userId: string, subtopicId: string, code: string) => {
    const prevState = get().progress[subtopicId];
    const now = new Date().toISOString();

    // Optimistic update
    set((state) => ({
      progress: {
        ...state.progress,
        [subtopicId]: {
          subtopicId,
          status: 'completed',
          savedCode: code,
          lastAccessedAt: now,
        },
      },
    }));

    // Persist to database with retry
    const result = await withRetry(async () => {
      const { error } = await supabase
        .from('user_progress')
        .upsert(
          {
            user_id: userId,
            subtopic_id: subtopicId,
            status: 'completed',
            saved_code: code,
            last_accessed_at: now,
          },
          { onConflict: 'user_id,subtopic_id' }
        );

      if (error) throw error;
    });

    if (!result.success) {
      // Rollback on failure
      if (prevState) {
        set((state) => ({
          progress: {
            ...state.progress,
            [subtopicId]: prevState,
          },
          error: 'Failed to save progress. Please try again.',
        }));
      } else {
        // Remove the optimistic entry if there was no previous state
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [subtopicId]: _removed, ...rest } = state.progress;
          return {
            progress: rest,
            error: 'Failed to save progress. Please try again.',
          };
        });
      }
    }
  },

  // Save code without marking complete (for auto-save)
  saveCode: async (userId: string, subtopicId: string, code: string) => {
    const prevState = get().progress[subtopicId];
    const now = new Date().toISOString();

    // Optimistic update - preserve existing status or set to in_progress
    const currentStatus = prevState?.status || 'in_progress';
    const newStatus = currentStatus === 'completed' ? 'completed' : 'in_progress';

    set((state) => ({
      progress: {
        ...state.progress,
        [subtopicId]: {
          subtopicId,
          status: newStatus,
          savedCode: code,
          lastAccessedAt: now,
        },
      },
    }));

    // Persist to database with retry (silent - no error display for auto-save)
    const result = await withRetry(async () => {
      const { error } = await supabase
        .from('user_progress')
        .upsert(
          {
            user_id: userId,
            subtopic_id: subtopicId,
            status: newStatus,
            saved_code: code,
            last_accessed_at: now,
          },
          { onConflict: 'user_id,subtopic_id' }
        );

      if (error) throw error;
    });

    if (!result.success) {
      console.error('Auto-save failed after retries:', result.error);
      // Don't rollback for auto-save - user's local state is more important
      // But set error so UI can show notification if desired
      set({ error: 'Auto-save failed. Your work may not be saved.' });
    }
  },

  // Clear all progress (on sign out)
  clear: () => {
    set({
      progress: {},
      isHydrated: false,
      isHydrating: false,
      error: null,
    });
  },
}));
