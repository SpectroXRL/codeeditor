/**
 * Agentic Lessons Service
 * Fetches lesson data for the prompt engineering curriculum
 */

import { supabase } from './supabase';
import type { Topic, SubTopic, Content } from '../types/database';

// The known ID for the Agentic Engineering subject
const AGENTIC_SUBJECT_SLUG = 'agentic-engineering';

/**
 * Get the Agentic Engineering subject ID
 */
export async function getAgenticSubjectId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id')
    .eq('slug', AGENTIC_SUBJECT_SLUG)
    .single();

  if (error || !data) {
    console.error('Error fetching agentic subject:', error);
    return null;
  }

  return data.id;
}

/**
 * Get all topics for the Agentic Engineering curriculum
 */
export async function getAgenticTopics(): Promise<Topic[]> {
  const subjectId = await getAgenticSubjectId();
  console.log('[DEBUG] getAgenticSubjectId returned:', subjectId);
  if (!subjectId) return [];

  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('order_index', { ascending: true });

  console.log('[DEBUG] topics query result:', { data, error });

  if (error) {
    console.error('Error fetching agentic topics:', error);
    return [];
  }

  return data || [];
}

/**
 * Get subtopics (lessons) for a topic
 */
export async function getAgenticLessons(topicId: string): Promise<SubTopic[]> {
  const { data, error } = await supabase
    .from('subtopics')
    .select('*')
    .eq('topic_id', topicId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching agentic lessons:', error);
    return [];
  }

  return data || [];
}

/**
 * Get lesson content by subtopic ID
 */
export async function getAgenticLessonContent(lessonId: string): Promise<Content | null> {
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('subtopic_id', lessonId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching lesson content:', error);
    return null;
  }

  return data;
}

/**
 * Get lesson with its parent topic info
 */
export async function getAgenticLessonWithTopic(lessonId: string): Promise<{
  lesson: SubTopic;
  topic: Topic;
  content: Content | null;
} | null> {
  // Get the subtopic
  const { data: lesson, error: lessonError } = await supabase
    .from('subtopics')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lesson) {
    console.error('Error fetching lesson:', lessonError);
    return null;
  }

  // Get the parent topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*')
    .eq('id', lesson.topic_id)
    .single();

  if (topicError || !topic) {
    console.error('Error fetching topic:', topicError);
    return null;
  }

  // Get the content
  const content = await getAgenticLessonContent(lessonId);

  return { lesson, topic, content };
}

export interface TopicWithLessons extends Topic {
  lessons: SubTopic[];
}

/**
 * Get all topics with their lessons for the curriculum overview
 */
export async function getAgenticCurriculum(): Promise<TopicWithLessons[]> {
  const topics = await getAgenticTopics();
  console.log('[DEBUG] getAgenticTopics returned:', topics.length, 'topics');
  console.log('[DEBUG] Topic IDs:', topics.map(t => ({ id: t.id, name: t.name })));
  
  const topicsWithLessons = await Promise.all(
    topics.map(async (topic) => {
      const lessons = await getAgenticLessons(topic.id);
      console.log(`[DEBUG] Topic "${topic.name}" has ${lessons.length} lessons`);
      return { ...topic, lessons };
    })
  );

  return topicsWithLessons;
}
