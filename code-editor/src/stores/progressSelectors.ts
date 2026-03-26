import { useProgressStore } from './progressStore';

// ============================================
// Single Subtopic Progress
// ============================================

export function useSubtopicProgress(subtopicId: string | undefined) {
  return useProgressStore((state) => 
    subtopicId ? state.progress[subtopicId] : undefined
  );
}

export function useSubtopicStatus(subtopicId: string | undefined) {
  return useProgressStore((state) =>
    subtopicId ? state.progress[subtopicId]?.status : undefined
  );
}

export function useSavedCode(subtopicId: string | undefined) {
  return useProgressStore((state) =>
    subtopicId ? state.progress[subtopicId]?.savedCode : undefined
  );
}

// ============================================
// Topic-Level Progress
// ============================================

export function useTopicProgress(subtopicIds: string[]) {
  return useProgressStore((state) => {
    if (subtopicIds.length === 0) {
      return { completed: 0, total: 0 };
    }

    const completed = subtopicIds.filter(
      (id) => state.progress[id]?.status === 'completed'
    ).length;

    return {
      completed,
      total: subtopicIds.length,
    };
  });
}

export function useIsTopicComplete(subtopicIds: string[]) {
  return useProgressStore((state) => {
    if (subtopicIds.length === 0) return false;

    return subtopicIds.every(
      (id) => state.progress[id]?.status === 'completed'
    );
  });
}

// ============================================
// Store State Selectors
// ============================================

export function useProgressHydrated() {
  return useProgressStore((state) => state.isHydrated);
}

export function useProgressHydrating() {
  return useProgressStore((state) => state.isHydrating);
}

export function useProgressError() {
  return useProgressStore((state) => state.error);
}

// ============================================
// Actions (for convenience)
// ============================================

export function useProgressActions() {
  const hydrate = useProgressStore((state) => state.hydrate);
  const markComplete = useProgressStore((state) => state.markComplete);
  const saveCode = useProgressStore((state) => state.saveCode);
  const clear = useProgressStore((state) => state.clear);

  return { hydrate, markComplete, saveCode, clear };
}
