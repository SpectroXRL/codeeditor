import { supabase } from './supabase';
import type { Subject, Topic, SubTopic, Content } from '../types/database';

export async function getSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching subjects:', error);
    throw new Error('Failed to load subjects');
  }

  return data || [];
}

export async function getSubjectBySlug(slug: string): Promise<Subject | null> {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching subject:', error);
    throw new Error('Failed to load subject');
  }

  return data;
}

export async function getSubjectById(id: string): Promise<Subject | null> {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching subject:', error);
    throw new Error('Failed to load subject');
  }

  return data;
}

export async function getTopicsBySubject(subjectId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('order_index');

  if (error) {
    console.error('Error fetching topics:', error);
    throw new Error('Failed to load topics');
  }

  return data || [];
}

export async function getSubTopicsByTopic(topicId: string): Promise<SubTopic[]> {
  const { data, error } = await supabase
    .from('subtopics')
    .select('*')
    .eq('topic_id', topicId)
    .order('order_index');

  if (error) {
    console.error('Error fetching subtopics:', error);
    throw new Error('Failed to load subtopics');
  }

  return data || [];
}

export async function getContentBySubTopic(subtopicId: string): Promise<Content | null> {
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('subtopic_id', subtopicId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching content:', error);
    throw new Error('Failed to load content');
  }

  return data;
}

// Get first topic for a subject (for default selection)
export async function getFirstTopicForSubject(subjectId: string): Promise<Topic | null> {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('order_index')
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching first topic:', error);
    return null;
  }

  return data;
}

// Get first subtopic for a topic (for default selection)
export async function getFirstSubTopicForTopic(topicId: string): Promise<SubTopic | null> {
  const { data, error } = await supabase
    .from('subtopics')
    .select('*')
    .eq('topic_id', topicId)
    .order('order_index')
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching first subtopic:', error);
    return null;
  }

  return data;
}
