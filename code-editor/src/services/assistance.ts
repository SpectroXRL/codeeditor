import { supabase } from './supabase';
import type { AIAssistanceLog, AssistanceTier } from '../types/database';

export interface LogAssistanceParams {
  userId: string;
  subtopicId: string;
  assistanceTier: AssistanceTier;
  issueType?: string;
  codeSnippet?: string;
  responseSummary?: string;
}

/**
 * Log an AI assistance interaction to the database
 */
export async function logAssistance(
  params: LogAssistanceParams
): Promise<AIAssistanceLog | null> {
  const { userId, subtopicId, assistanceTier, issueType, codeSnippet, responseSummary } = params;

  const { data, error } = await supabase
    .from('ai_assistance_logs')
    .insert({
      user_id: userId,
      subtopic_id: subtopicId,
      assistance_tier: assistanceTier,
      issue_type: issueType || null,
      code_snippet: codeSnippet || null,
      response_summary: responseSummary || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging assistance:', error);
    return null;
  }

  return data;
}

/**
 * Get assistance history for a specific subtopic
 */
export async function getAssistanceForSubtopic(
  userId: string,
  subtopicId: string
): Promise<AIAssistanceLog[]> {
  const { data, error } = await supabase
    .from('ai_assistance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('subtopic_id', subtopicId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching assistance history:', error);
    return [];
  }

  return data || [];
}

/**
 * Increment the assistance count in user_progress
 */
export async function incrementAssistanceCount(
  userId: string,
  subtopicId: string
): Promise<void> {
  // First, ensure a progress record exists
  const { data: existing } = await supabase
    .from('user_progress')
    .select('assistance_count')
    .eq('user_id', userId)
    .eq('subtopic_id', subtopicId)
    .single();

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('user_progress')
      .update({
        assistance_count: (existing.assistance_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('subtopic_id', subtopicId);

    if (error) {
      console.error('Error incrementing assistance count:', error);
    }
  } else {
    // Create new progress record with assistance count
    const { error } = await supabase
      .from('user_progress')
      .insert({
        user_id: userId,
        subtopic_id: subtopicId,
        status: 'in_progress',
        assistance_count: 1,
        last_accessed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error creating progress with assistance:', error);
    }
  }
}

/**
 * Get total assistance stats for a user
 */
export async function getAssistanceStats(
  userId: string
): Promise<{ totalUsed: number; byTier: Record<AssistanceTier, number> }> {
  const { data, error } = await supabase
    .from('ai_assistance_logs')
    .select('assistance_tier')
    .eq('user_id', userId);

  if (error || !data) {
    return {
      totalUsed: 0,
      byTier: { tip: 0, question: 0, hint: 0, explanation: 0 },
    };
  }

  const byTier: Record<AssistanceTier, number> = {
    tip: 0,
    question: 0,
    hint: 0,
    explanation: 0,
  };

  for (const log of data) {
    const tier = log.assistance_tier as AssistanceTier;
    byTier[tier] = (byTier[tier] || 0) + 1;
  }

  return {
    totalUsed: data.length,
    byTier,
  };
}
