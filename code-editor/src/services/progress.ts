import { supabase } from './supabase';
import type { UserProgress } from '../types/database';

export async function getUserProgress(
  userId: string,
  subtopicId: string
): Promise<UserProgress | null> {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('subtopic_id', subtopicId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching progress:', error);
    return null;
  }

  return data;
}

export async function saveProgress(
  userId: string,
  subtopicId: string,
  code: string,
  status: 'not_started' | 'in_progress' | 'completed'
): Promise<UserProgress | null> {
  const { data, error } = await supabase
    .from('user_progress')
    .upsert(
      {
        user_id: userId,
        subtopic_id: subtopicId,
        saved_code: code,
        status,
        last_accessed_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,subtopic_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving progress:', error);
    throw new Error('Failed to save progress');
  }

  return data;
}

export async function updateProgressStatus(
  userId: string,
  subtopicId: string,
  status: 'not_started' | 'in_progress' | 'completed'
): Promise<void> {
  const { error } = await supabase
    .from('user_progress')
    .update({ status, last_accessed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('subtopic_id', subtopicId);

  if (error) {
    console.error('Error updating progress status:', error);
    throw new Error('Failed to update progress');
  }
}

export async function getProgressForSubject(
  userId: string,
  subjectId: string
): Promise<UserProgress[]> {
  // Get all subtopics for this subject through topics, then get progress
  const { data, error } = await supabase
    .from('user_progress')
    .select(`
      *,
      subtopics!inner(
        topic_id,
        topics!inner(
          subject_id
        )
      )
    `)
    .eq('user_id', userId)
    .eq('subtopics.topics.subject_id', subjectId);

  if (error) {
    console.error('Error fetching subject progress:', error);
    return [];
  }

  return data || [];
}

export async function getLastAccessedSubtopic(
  userId: string,
  subjectId: string
): Promise<{ topicId: string; subtopicId: string } | null> {
  const { data, error } = await supabase
    .from('user_progress')
    .select(`
      subtopic_id,
      subtopics!inner(
        id,
        topic_id,
        topics!inner(
          id,
          subject_id
        )
      )
    `)
    .eq('user_id', userId)
    .eq('subtopics.topics.subject_id', subjectId)
    .order('last_accessed_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  // Type assertion since we know the structure
  const subtopics = data.subtopics as unknown as { topic_id: string };
  return {
    topicId: subtopics.topic_id,
    subtopicId: data.subtopic_id,
  };
}
