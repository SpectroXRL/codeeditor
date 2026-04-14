/**
 * useAgenticChallenge Hook
 * Manages state and actions for agentic (prompt engineering) challenge attempts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Challenge,
  PromptTurn,
  PromptTechnique,
} from '../types/database';
import type { ApiPromptScores } from '../types/database';
import { runTestCases } from '../services/judge0';
import {
  startAgenticAttempt,
  getInProgressAgenticAttempt,
  submitPrompt,
  addPromptTurn,
  tagTechniques,
  completeAgenticAttempt,
  abandonAgenticAttempt,
  evaluatePrompts,
  savePromptScores,
  logPromptValidation,
} from '../services/agenticChallenges';
import { useHint as recordHintUsage } from '../services/challenges';
import {
  validatePrompt,
  getSafeBlockMessage,
} from '../services/inputSanitizer';
import type { TestResult } from '../components/learning/TestCasesPanel';

// ============================================
// Types
// ============================================

export type AgenticChallengeState =
  | 'loading'
  | 'restoring'
  | 'ready'
  | 'generating'
  | 'testing'
  | 'evaluating'
  | 'completed'
  | 'abandoned';

export interface EvaluationResult {
  scores: ApiPromptScores;
  aiFeedback: string;
  heuristics: {
    techniquesDetected: PromptTechnique[];
  };
  referencePrompt: string | null;
}

interface UseAgenticChallengeOptions {
  challenge: Challenge | null;
  userId: string | undefined;
  onGenerationComplete?: (turn: PromptTurn) => void;
  onComplete?: (result: EvaluationResult) => void;
  onAbandon?: (result: EvaluationResult) => void;
}

interface UseAgenticChallengeReturn {
  // State
  state: AgenticChallengeState;
  challengeAttemptId: string | null;
  agenticAttemptId: string | null;
  promptHistory: PromptTurn[];
  iterationsUsed: number;
  maxIterations: number;

  // Generation output
  currentCode: string;
  currentReasoning: string;
  generationError: string | null;

  // Testing
  testResults: TestResult[];
  allTestsPassed: boolean;

  // Hints
  hintsUsed: number;
  hintsRemaining: number;
  revealedHints: string[];

  // Evaluation
  evaluationResult: EvaluationResult | null;
  selectedTechniques: PromptTechnique[];

  // Derived flags
  isGenerating: boolean;
  isRunning: boolean;
  isComplete: boolean;
  canSubmitPrompt: boolean;
  iterationsExhausted: boolean;

  // Error
  error: string | null;

  // Actions
  submitPrompt: (prompt: string) => Promise<void>;
  runTests: () => Promise<void>;
  requestHint: () => Promise<void>;
  setSelectedTechniques: (techniques: PromptTechnique[]) => void;
  completeAttempt: () => Promise<void>;
  abandonAttempt: () => Promise<void>;
}

// ============================================
// Hook Implementation
// ============================================

export function useAgenticChallenge({
  challenge,
  userId,
  onGenerationComplete,
  onComplete,
  onAbandon,
}: UseAgenticChallengeOptions): UseAgenticChallengeReturn {
  // State enum
  const [state, setState] = useState<AgenticChallengeState>('loading');
  const [error, setError] = useState<string | null>(null);

  // Attempt IDs
  const [challengeAttemptId, setChallengeAttemptId] = useState<string | null>(null);
  const [agenticAttemptId, setAgenticAttemptId] = useState<string | null>(null);

  // Prompt history
  const [promptHistory, setPromptHistory] = useState<PromptTurn[]>([]);
  const [iterationsUsed, setIterationsUsed] = useState(0);

  // Generation state
  const [currentCode, setCurrentCode] = useState('');
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Test state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [allTestsPassed, setAllTestsPassed] = useState(false);

  // Hints state
  const [hintsUsed, setHintsUsed] = useState(0);
  const [revealedHints, setRevealedHints] = useState<string[]>([]);

  // Completion state
  const [isComplete, setIsComplete] = useState(false);
  const [selectedTechniques, setSelectedTechniques] = useState<PromptTechnique[]>([]);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  // Ref to track mounted state for async operations
  const isMountedRef = useRef(true);

  // Derived values
  const maxIterations = challenge?.max_iterations || 5;
  const hintsRemaining = (challenge?.hints_allowed || 0) - hintsUsed;
  const iterationsExhausted = iterationsUsed >= maxIterations;
  const isGenerating = state === 'generating';
  const isRunning = state === 'testing';
  const canSubmitPrompt = !isGenerating && !isComplete && !iterationsExhausted && !!agenticAttemptId;

  // ============================================
  // Initialize / Restore Attempt
  // ============================================

  useEffect(() => {
    isMountedRef.current = true;

    async function initializeAttempt() {
      if (!challenge || !userId) {
        setState('loading');
        return;
      }

      setState('loading');
      setError(null);

      try {
        // Set initial code
        setCurrentCode(
          challenge.starter_code || '// Code will appear here after you submit a prompt'
        );

        // Check for existing in-progress attempt
        const existingAttempt = await getInProgressAgenticAttempt(challenge.id, userId);

        if (!isMountedRef.current) return;

        if (existingAttempt) {
          setState('restoring');

          setAgenticAttemptId(existingAttempt.id);
          setChallengeAttemptId(existingAttempt.challenge_attempt_id);
          setPromptHistory(existingAttempt.prompt_history as PromptTurn[]);
          setIterationsUsed(existingAttempt.iterations_used);

          // Restore last generated code
          const lastTurn = existingAttempt.prompt_history[
            existingAttempt.prompt_history.length - 1
          ] as PromptTurn | undefined;

          if (lastTurn) {
            setCurrentCode(lastTurn.generatedCode);
            setCurrentReasoning(lastTurn.agentReasoning);
          }

          setState('ready');
        } else {
          // Start a new attempt
          const newAttempt = await startAgenticAttempt(challenge.id, userId);

          if (!isMountedRef.current) return;

          if (newAttempt) {
            setChallengeAttemptId(newAttempt.challengeAttemptId);
            setAgenticAttemptId(newAttempt.agenticAttemptId);
            setState('ready');
          } else {
            setError('Failed to start challenge attempt');
            setState('loading');
          }
        }
      } catch (err) {
        console.error('Error initializing agentic attempt:', err);
        if (isMountedRef.current) {
          setError('Failed to load challenge');
          setState('loading');
        }
      }
    }

    initializeAttempt();

    return () => {
      isMountedRef.current = false;
    };
  }, [challenge?.id, userId]);

  // ============================================
  // Submit Prompt
  // ============================================

  const handleSubmitPrompt = useCallback(
    async (prompt: string) => {
      if (!challenge || !agenticAttemptId || !userId || isGenerating) return;

      // Client-side validation
      const validation = validatePrompt(prompt);

      // Log validation (fire-and-forget)
      logPromptValidation(
        userId,
        agenticAttemptId,
        prompt,
        validation.valid ? 'passed' : 'blocked',
        validation.blockedReason || null,
        validation.riskLevel || 'low'
      );

      if (!validation.valid) {
        setGenerationError(getSafeBlockMessage(validation.blockedReason || ''));
        return;
      }

      setState('generating');
      setGenerationError(null);
      setCurrentReasoning('');

      try {
        const result = await submitPrompt({
          attemptId: agenticAttemptId,
          prompt: validation.sanitized,
          conversationHistory: promptHistory,
          challengeContext: {
            title: challenge.title,
            description: challenge.description,
            testCases: challenge.test_cases,
            language: challenge.language_id === 93 ? 'javascript' : 'typescript',
            starterCode: challenge.starter_code,
          },
        });

        if (!isMountedRef.current) return;

        if (!result.success) {
          if (result.error.blockedReason) {
            setGenerationError(result.error.blockedReason);
          } else {
            setGenerationError(result.error.error);
          }
          setState('ready');
          return;
        }

        const {
          turnId,
          generatedCode,
          agentReasoning,
          iterationNumber,
          timestamp,
        } = result.data;

        // Create the turn record
        const newTurn: PromptTurn = {
          id: turnId,
          prompt: validation.sanitized,
          generatedCode,
          agentReasoning,
          timestamp,
          iterationNumber,
        };

        // Update local state
        setCurrentCode(generatedCode);
        setCurrentReasoning(agentReasoning);
        setPromptHistory((prev) => [...prev, newTurn]);
        setIterationsUsed(iterationNumber);
        setTestResults([]); // Clear previous test results

        // Persist to database
        await addPromptTurn(agenticAttemptId, newTurn);

        // Callback
        onGenerationComplete?.(newTurn);

        setState('ready');
      } catch (err) {
        console.error('Generation error:', err);
        if (isMountedRef.current) {
          setGenerationError('Failed to generate code. Please try again.');
          setState('ready');
        }
      }
    },
    [challenge, agenticAttemptId, userId, isGenerating, promptHistory, onGenerationComplete]
  );

  // ============================================
  // Run Tests
  // ============================================

  const handleRunTests = useCallback(async () => {
    if (!challenge || !currentCode) return;

    setState('testing');
    setTestResults([]);

    try {
      const results = await runTestCases(
        currentCode,
        challenge.language_id,
        challenge.test_cases
      );

      if (!isMountedRef.current) return;

      setTestResults(results);

      const passed = results.every((r) => r.passed);
      setAllTestsPassed(passed);

      if (passed) {
        setIsComplete(true);
      }

      setState('ready');
    } catch (err) {
      console.error('Error running tests:', err);
      if (isMountedRef.current) {
        setState('ready');
      }
    }
  }, [challenge, currentCode]);

  // ============================================
  // Request Hint
  // ============================================

  const handleRequestHint = useCallback(async () => {
    if (!challengeAttemptId || !challenge || hintsRemaining <= 0) return;

    try {
      const newHintsUsed = await recordHintUsage(challengeAttemptId);

      if (!isMountedRef.current) return;

      setHintsUsed(newHintsUsed);

      const hints = challenge.hints || [];
      if (hints[newHintsUsed - 1]) {
        setRevealedHints((prev) => [...prev, hints[newHintsUsed - 1]]);
      }
    } catch (err) {
      console.error('Error requesting hint:', err);
    }
  }, [challengeAttemptId, challenge, hintsRemaining]);

  // ============================================
  // Complete Attempt
  // ============================================

  const handleCompleteAttempt = useCallback(async () => {
    if (!challengeAttemptId || !agenticAttemptId || !challenge) return;

    setState('evaluating');

    try {
      // Save tagged techniques
      await tagTechniques(agenticAttemptId, selectedTechniques);

      // Evaluate prompts
      const evaluation = await evaluatePrompts(
        promptHistory,
        selectedTechniques,
        allTestsPassed,
        maxIterations,
        challenge.reference_prompt || undefined
      );

      if (!isMountedRef.current) return;

      if (evaluation) {
        const result: EvaluationResult = {
          scores: evaluation.scores,
          aiFeedback: evaluation.aiFeedback,
          heuristics: {
            techniquesDetected: evaluation.heuristics.techniquesDetected,
          },
          referencePrompt: evaluation.referencePrompt,
        };

        setEvaluationResult(result);

        // Save scores
        await savePromptScores(agenticAttemptId, evaluation);

        // Callback
        onComplete?.(result);
      }

      // Complete the attempt
      const passed = testResults.filter((r) => r.passed).length;
      const total = testResults.length;
      await completeAgenticAttempt(
        challengeAttemptId,
        agenticAttemptId,
        passed,
        total,
        currentCode
      );

      setState('completed');
    } catch (err) {
      console.error('Error completing attempt:', err);
      if (isMountedRef.current) {
        setError('Failed to complete challenge');
        setState('ready');
      }
    }
  }, [
    challengeAttemptId,
    agenticAttemptId,
    challenge,
    selectedTechniques,
    promptHistory,
    allTestsPassed,
    maxIterations,
    testResults,
    currentCode,
    onComplete,
  ]);

  // ============================================
  // Abandon Attempt
  // ============================================

  const handleAbandonAttempt = useCallback(async () => {
    if (!challengeAttemptId || !agenticAttemptId || !challenge) return;

    setState('evaluating');

    try {
      // Still evaluate the prompts for learning
      const evaluation = await evaluatePrompts(
        promptHistory,
        selectedTechniques,
        false, // tests didn't pass
        maxIterations,
        challenge.reference_prompt || undefined
      );

      if (!isMountedRef.current) return;

      if (evaluation) {
        const result: EvaluationResult = {
          scores: evaluation.scores,
          aiFeedback: evaluation.aiFeedback,
          heuristics: {
            techniquesDetected: evaluation.heuristics.techniquesDetected,
          },
          referencePrompt: evaluation.referencePrompt,
        };

        setEvaluationResult(result);
        await savePromptScores(agenticAttemptId, evaluation);

        // Callback
        onAbandon?.(result);
      }

      await abandonAgenticAttempt(challengeAttemptId, currentCode);

      setState('abandoned');
    } catch (err) {
      console.error('Error abandoning attempt:', err);
      if (isMountedRef.current) {
        setError('Failed to abandon challenge');
        setState('ready');
      }
    }
  }, [
    challengeAttemptId,
    agenticAttemptId,
    challenge,
    promptHistory,
    selectedTechniques,
    maxIterations,
    currentCode,
    onAbandon,
  ]);

  // ============================================
  // Return
  // ============================================

  return {
    // State
    state,
    challengeAttemptId,
    agenticAttemptId,
    promptHistory,
    iterationsUsed,
    maxIterations,

    // Generation output
    currentCode,
    currentReasoning,
    generationError,

    // Testing
    testResults,
    allTestsPassed,

    // Hints
    hintsUsed,
    hintsRemaining,
    revealedHints,

    // Evaluation
    evaluationResult,
    selectedTechniques,

    // Derived flags
    isGenerating,
    isRunning,
    isComplete,
    canSubmitPrompt,
    iterationsExhausted,

    // Error
    error,

    // Actions
    submitPrompt: handleSubmitPrompt,
    runTests: handleRunTests,
    requestHint: handleRequestHint,
    setSelectedTechniques,
    completeAttempt: handleCompleteAttempt,
    abandonAttempt: handleAbandonAttempt,
  };
}
