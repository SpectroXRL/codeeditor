import { supabase } from './supabase';
import type { 
  Challenge, 
  ChallengeAttempt, 
  ChallengeAttemptability 
} from '../types/database';

// ============================================
// Challenge Fetching
// ============================================

export async function getChallengeById(challengeId: string): Promise<Challenge | null> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching challenge:', error);
    throw new Error('Failed to load challenge');
  }

  return data;
}

export async function getChallengeForTopic(topicId: string): Promise<Challenge | null> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('topic_id', topicId)
    .eq('challenge_type', 'mini_boss')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching topic challenge:', error);
    return null;
  }

  return data;
}

export async function getChallengeForSubject(subjectId: string): Promise<Challenge | null> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('challenge_type', 'final_boss')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching subject challenge:', error);
    return null;
  }

  return data;
}

// ============================================
// Unlock Checking
// ============================================

export async function isTopicChallengeUnlocked(
  userId: string,
  topicId: string
): Promise<boolean> {
  // Get all subtopics for the topic
  const { data: subtopics, error: subtopicsError } = await supabase
    .from('subtopics')
    .select('id')
    .eq('topic_id', topicId);

  if (subtopicsError || !subtopics || subtopics.length === 0) {
    return false;
  }

  const subtopicIds = subtopics.map(s => s.id);

  // Check if all subtopics are completed
  const { data: progress, error: progressError } = await supabase
    .from('user_progress')
    .select('subtopic_id, status')
    .eq('user_id', userId)
    .in('subtopic_id', subtopicIds)
    .eq('status', 'completed');

  if (progressError) {
    console.error('Error checking topic unlock:', progressError);
    return false;
  }

  // All subtopics must be completed
  return progress?.length === subtopicIds.length;
}

export async function isSubjectChallengeUnlocked(
  userId: string,
  subjectId: string
): Promise<boolean> {
  // Get all topics for the subject
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id')
    .eq('subject_id', subjectId);

  if (topicsError || !topics || topics.length === 0) {
    return false;
  }

  // Check if all mini-bosses are completed
  for (const topic of topics) {
    // First check if topic challenge is unlocked
    const topicUnlocked = await isTopicChallengeUnlocked(userId, topic.id);
    if (!topicUnlocked) return false;

    // Then check if topic challenge is completed
    const topicChallenge = await getChallengeForTopic(topic.id);
    if (topicChallenge) {
      const bestAttempt = await getUserBestAttempt(userId, topicChallenge.id);
      if (!bestAttempt || bestAttempt.status !== 'completed') {
        return false;
      }
    }
  }

  return true;
}

// ============================================
// Attempt Management
// ============================================

export async function canAttemptChallenge(
  userId: string,
  challengeId: string
): Promise<ChallengeAttemptability> {
  const { data, error } = await supabase
    .rpc('can_attempt_challenge', {
      p_user_id: userId,
      p_challenge_id: challengeId
    });

  if (error) {
    console.error('Error checking attemptability:', error);
    return { can_attempt: false, reason: 'Error checking status' };
  }

  return data as ChallengeAttemptability;
}

export async function startChallengeAttempt(
  userId: string,
  challengeId: string
): Promise<ChallengeAttempt> {
  // First check if can attempt
  const canAttempt = await canAttemptChallenge(userId, challengeId);
  
  if (!canAttempt.can_attempt) {
    if (canAttempt.reason === 'in_progress' && canAttempt.attempt_id) {
      // Return existing in-progress attempt
      const { data } = await supabase
        .from('challenge_attempts')
        .select('*')
        .eq('id', canAttempt.attempt_id)
        .single();
      
      if (data) return data;
    }
    throw new Error(canAttempt.reason || 'Cannot start challenge');
  }

  // Create new attempt
  const { data, error } = await supabase
    .from('challenge_attempts')
    .insert({
      user_id: userId,
      challenge_id: challengeId,
      status: 'in_progress'
    })
    .select()
    .single();

  if (error) {
    console.error('Error starting attempt:', error);
    throw new Error('Failed to start challenge');
  }

  return data;
}

export async function getInProgressAttempt(
  userId: string,
  challengeId: string
): Promise<ChallengeAttempt | null> {
  const { data, error } = await supabase
    .from('challenge_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching in-progress attempt:', error);
    return null;
  }

  return data;
}

export async function getUserBestAttempt(
  userId: string,
  challengeId: string
): Promise<ChallengeAttempt | null> {
  const { data, error } = await supabase
    .from('challenge_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .eq('status', 'completed')
    .order('final_score', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching best attempt:', error);
    return null;
  }

  return data;
}

export async function useHint(attemptId: string): Promise<number> {
  // Get current hints used
  const { data: attempt, error: fetchError } = await supabase
    .from('challenge_attempts')
    .select('hints_used')
    .eq('id', attemptId)
    .single();

  if (fetchError || !attempt) {
    throw new Error('Failed to get attempt');
  }

  const newHintsUsed = attempt.hints_used + 1;

  // Update hints used
  const { error: updateError } = await supabase
    .from('challenge_attempts')
    .update({ hints_used: newHintsUsed })
    .eq('id', attemptId);

  if (updateError) {
    throw new Error('Failed to use hint');
  }

  return newHintsUsed;
}

export async function abandonAttempt(attemptId: string): Promise<void> {
  const { error } = await supabase
    .from('challenge_attempts')
    .update({
      status: 'abandoned',
      completed_at: new Date().toISOString()
    })
    .eq('id', attemptId);

  if (error) {
    console.error('Error abandoning attempt:', error);
    throw new Error('Failed to abandon challenge');
  }
}

// ============================================
// Scoring & Submission
// ============================================

export interface SubmitChallengeParams {
  attemptId: string;
  code: string;
  testsPassed: number;
  testsTotal: number;
  timeTakenSeconds: number;
  hintsUsed: number;
  hintPenaltyPerHint: number;
  timeLimitSeconds: number;
}

export function calculateScore(params: {
  testsPassed: number;
  testsTotal: number;
  timeTakenSeconds: number;
  timeLimitSeconds: number;
  hintsUsed: number;
  hintPenaltyPerHint: number;
}): {
  baseScore: number;
  timeBonus: number;
  hintPenalty: number;
  finalScore: number;
} {
  const { testsPassed, testsTotal, timeTakenSeconds, timeLimitSeconds, hintsUsed, hintPenaltyPerHint } = params;

  // Base score: proportion of tests passed × 1000
  const baseScore = Math.round((testsPassed / testsTotal) * 1000);

  // Time bonus based on how quickly completed
  let timeBonus = 0;
  if (timeTakenSeconds <= timeLimitSeconds) {
    const timeRatio = timeTakenSeconds / timeLimitSeconds;
    if (timeRatio <= 0.25) {
      timeBonus = 300;
    } else if (timeRatio <= 0.5) {
      timeBonus = 200;
    } else if (timeRatio <= 0.75) {
      timeBonus = 100;
    }
  }

  // Hint penalty
  const hintPenalty = hintsUsed * hintPenaltyPerHint;

  // Final score (minimum 0)
  const finalScore = Math.max(0, baseScore + timeBonus - hintPenalty);

  return { baseScore, timeBonus, hintPenalty, finalScore };
}

export async function submitChallengeAttempt(
  params: SubmitChallengeParams
): Promise<ChallengeAttempt> {
  const { attemptId, code, testsPassed, testsTotal, timeTakenSeconds, hintsUsed, hintPenaltyPerHint, timeLimitSeconds } = params;

  const scores = calculateScore({
    testsPassed,
    testsTotal,
    timeTakenSeconds,
    timeLimitSeconds,
    hintsUsed,
    hintPenaltyPerHint
  });

  const { data, error } = await supabase
    .from('challenge_attempts')
    .update({
      submitted_code: code,
      tests_passed: testsPassed,
      tests_total: testsTotal,
      time_taken_seconds: timeTakenSeconds,
      hints_used: hintsUsed,
      base_score: scores.baseScore,
      time_bonus: scores.timeBonus,
      hint_penalty: scores.hintPenalty,
      final_score: scores.finalScore,
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', attemptId)
    .select()
    .single();

  if (error) {
    console.error('Error submitting attempt:', error);
    throw new Error('Failed to submit challenge');
  }

  return data;
}

// ============================================
// Progress Aggregation
// ============================================

export async function getTopicProgress(
  userId: string,
  topicId: string
): Promise<{ completed: number; total: number }> {
  const { data: subtopics } = await supabase
    .from('subtopics')
    .select('id')
    .eq('topic_id', topicId);

  if (!subtopics) return { completed: 0, total: 0 };

  const subtopicIds = subtopics.map(s => s.id);

  const { data: progress } = await supabase
    .from('user_progress')
    .select('subtopic_id')
    .eq('user_id', userId)
    .in('subtopic_id', subtopicIds)
    .eq('status', 'completed');

  return {
    completed: progress?.length || 0,
    total: subtopicIds.length
  };
}
