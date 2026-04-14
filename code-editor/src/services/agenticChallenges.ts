/**
 * Agentic Challenges Service
 * Handles CRUD operations for agentic (prompt engineering) challenge attempts
 */

import { supabase } from './supabase';
import type {
  AgenticAttempt,
  PromptTurn,
  PromptTechnique,
  PromptScores,
  ChallengeAttempt,
} from '../types/database';

// ============================================
// API Interfaces
// ============================================

interface GenerateCodeRequest {
  attemptId: string;
  prompt: string;
  conversationHistory: PromptTurn[];
  challengeContext: {
    title: string;
    description: string;
    testCases: Array<{ input: string; expected_output: string }>;
    language: 'javascript' | 'typescript';
    starterCode?: string;
  };
}

interface GenerateCodeResponse {
  turnId: string;
  generatedCode: string;
  agentReasoning: string;
  iterationsRemaining: number;
  iterationNumber: number;
  timestamp: string;
}

interface GenerateCodeError {
  error: string;
  blockedReason?: string;
  iterationsRemaining?: number;
}

// API response scores shape (differs from database PromptScores)
interface ApiPromptScores {
  clarity: number;
  efficiency: number;
  context: number;
  technique: number;
  final: number;
}

interface EvaluatePromptResponse {
  scores: ApiPromptScores;
  aiFeedback: string;
  heuristics: {
    totalIterations: number;
    totalPromptTokens: number;
    averagePromptLength: number;
    techniquesDetected: PromptTechnique[];
    improvementBetweenIterations: boolean;
    firstAttemptSuccess: boolean;
  };
  referencePrompt: string | null;
  techniquesTags: PromptTechnique[];
}

// ============================================
// Agentic Attempt Management
// ============================================

/**
 * Start a new agentic challenge attempt
 * Creates both challenge_attempt and agentic_attempt records
 */
export async function startAgenticAttempt(
  challengeId: string,
  userId: string
): Promise<{ challengeAttemptId: string; agenticAttemptId: string } | null> {
  // First create the base challenge attempt
  const { data: challengeAttempt, error: caError } = await supabase
    .from('challenge_attempts')
    .insert({
      user_id: userId,
      challenge_id: challengeId,
      started_at: new Date().toISOString(),
      status: 'in_progress',
      tests_passed: 0,
      tests_total: 0,
      hints_used: 0,
    })
    .select()
    .single();

  if (caError || !challengeAttempt) {
    console.error('Error creating challenge attempt:', caError);
    return null;
  }

  // Create the agentic-specific attempt record
  const { data: agenticAttempt, error: aaError } = await supabase
    .from('agentic_attempts')
    .insert({
      challenge_attempt_id: challengeAttempt.id,
      user_id: userId,
      prompt_history: [],
      iterations_used: 0,
      techniques_tagged: [],
    })
    .select()
    .single();

  if (aaError || !agenticAttempt) {
    console.error('Error creating agentic attempt:', aaError);
    // Clean up the challenge attempt
    await supabase.from('challenge_attempts').delete().eq('id', challengeAttempt.id);
    return null;
  }

  return {
    challengeAttemptId: challengeAttempt.id,
    agenticAttemptId: agenticAttempt.id,
  };
}

/**
 * Get an existing in-progress agentic attempt for a challenge
 */
export async function getInProgressAgenticAttempt(
  challengeId: string,
  userId: string
): Promise<AgenticAttempt | null> {
  const { data, error } = await supabase
    .from('agentic_attempts')
    .select(`
      *,
      challenge_attempts!inner (
        id,
        challenge_id,
        status
      )
    `)
    .eq('user_id', userId)
    .eq('challenge_attempts.challenge_id', challengeId)
    .eq('challenge_attempts.status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching agentic attempt:', error);
    return null;
  }

  return data;
}

/**
 * Submit a prompt and get generated code
 */
export async function submitPrompt(
  request: GenerateCodeRequest
): Promise<{ success: true; data: GenerateCodeResponse } | { success: false; error: GenerateCodeError }> {
  try {
    const response = await fetch('/api/agentic-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as GenerateCodeError };
    }

    return { success: true, data: data as GenerateCodeResponse };
  } catch (error) {
    console.error('Submit prompt error:', error);
    return {
      success: false,
      error: { error: 'Network error. Please try again.' },
    };
  }
}

/**
 * Add a prompt turn to the agentic attempt's history
 */
export async function addPromptTurn(
  agenticAttemptId: string,
  turn: PromptTurn
): Promise<boolean> {
  // Get current history
  const { data: current, error: fetchError } = await supabase
    .from('agentic_attempts')
    .select('prompt_history, iterations_used')
    .eq('id', agenticAttemptId)
    .single();

  if (fetchError || !current) {
    console.error('Error fetching agentic attempt:', fetchError);
    return false;
  }

  const updatedHistory = [...(current.prompt_history as PromptTurn[]), turn];

  const { error: updateError } = await supabase
    .from('agentic_attempts')
    .update({
      prompt_history: updatedHistory,
      iterations_used: current.iterations_used + 1,
    })
    .eq('id', agenticAttemptId);

  if (updateError) {
    console.error('Error updating prompt history:', updateError);
    return false;
  }

  return true;
}

/**
 * Tag techniques used (called after tests pass)
 */
export async function tagTechniques(
  agenticAttemptId: string,
  techniques: PromptTechnique[]
): Promise<boolean> {
  const { error } = await supabase
    .from('agentic_attempts')
    .update({ techniques_tagged: techniques })
    .eq('id', agenticAttemptId);

  if (error) {
    console.error('Error tagging techniques:', error);
    return false;
  }

  return true;
}

/**
 * Complete an agentic attempt and trigger scoring
 */
export async function completeAgenticAttempt(
  challengeAttemptId: string,
  _agenticAttemptId: string,
  testsPassed: number,
  testsTotal: number,
  finalCode: string
): Promise<boolean> {
  const { error } = await supabase
    .from('challenge_attempts')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      submitted_code: finalCode,
      tests_passed: testsPassed,
      tests_total: testsTotal,
    })
    .eq('id', challengeAttemptId);

  if (error) {
    console.error('Error completing attempt:', error);
    return false;
  }

  return true;
}

/**
 * Abandon an agentic attempt (exhausted iterations or gave up)
 */
export async function abandonAgenticAttempt(
  challengeAttemptId: string,
  finalCode: string
): Promise<boolean> {
  const { error } = await supabase
    .from('challenge_attempts')
    .update({
      status: 'abandoned',
      completed_at: new Date().toISOString(),
      submitted_code: finalCode,
    })
    .eq('id', challengeAttemptId);

  if (error) {
    console.error('Error abandoning attempt:', error);
    return false;
  }

  return true;
}

/**
 * Evaluate prompt quality
 */
export async function evaluatePrompts(
  promptHistory: PromptTurn[],
  techniquesTags: PromptTechnique[],
  testsPassed: boolean,
  maxIterations: number,
  referencePrompt?: string
): Promise<EvaluatePromptResponse | null> {
  try {
    const response = await fetch('/api/evaluate-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptHistory,
        techniquesTags,
        testsPassed,
        maxIterations,
        referencePrompt,
      }),
    });

    if (!response.ok) {
      console.error('Evaluation API error:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Evaluate prompts error:', error);
    return null;
  }
}

/**
 * Save prompt scores to database
 */
export async function savePromptScores(
  agenticAttemptId: string,
  evaluation: EvaluatePromptResponse
): Promise<boolean> {
  const { error } = await supabase.from('prompt_scores').insert({
    agentic_attempt_id: agenticAttemptId,
    clarity_score: evaluation.scores.clarity,
    efficiency_score: evaluation.scores.efficiency,
    context_score: evaluation.scores.context,
    technique_score: evaluation.scores.technique,
    final_score: evaluation.scores.final,
    ai_feedback: evaluation.aiFeedback,
    heuristics_data: evaluation.heuristics,
  });

  if (error) {
    console.error('Error saving prompt scores:', error);
    return false;
  }

  return true;
}

/**
 * Log a validation event (for security audit)
 */
export async function logPromptValidation(
  userId: string,
  attemptId: string | null,
  promptText: string,
  validationResult: 'passed' | 'blocked',
  blockedReason: string | null,
  riskLevel: 'low' | 'medium' | 'high'
): Promise<void> {
  // Fire and forget - don't block on logging
  supabase
    .from('prompt_validation_logs')
    .insert({
      user_id: userId,
      attempt_id: attemptId,
      prompt_text: promptText.slice(0, 1000), // Truncate for storage
      validation_result: validationResult,
      blocked_reason: blockedReason,
      risk_level: riskLevel,
    })
    .then(({ error }) => {
      if (error) console.error('Error logging validation:', error);
    });
}

/**
 * Get best agentic attempt for a challenge
 */
export async function getBestAgenticAttempt(
  challengeId: string,
  userId: string
): Promise<{ attempt: ChallengeAttempt; scores: PromptScores } | null> {
  const { data, error } = await supabase
    .from('challenge_attempts')
    .select(`
      *,
      agentic_attempts (
        id,
        prompt_history,
        iterations_used,
        techniques_tagged,
        prompt_scores (*)
      )
    `)
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('final_score', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    if (error?.code !== 'PGRST116') console.error('Error fetching best attempt:', error);
    return null;
  }

  const agenticAttempt = data.agentic_attempts?.[0];
  const scores = agenticAttempt?.prompt_scores?.[0];

  if (!scores) return null;

  return {
    attempt: data as ChallengeAttempt,
    scores: scores as PromptScores,
  };
}
