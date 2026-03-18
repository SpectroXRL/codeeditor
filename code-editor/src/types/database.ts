// Supabase Database Types

export interface Subject {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  name: string;
  order_index: number;
  created_at: string;
}

export interface SubTopic {
  id: string;
  topic_id: string;
  name: string;
  order_index: number;
  created_at: string;
}

export interface TestCase {
  input: string;
  expected_output: string;
}

export interface Content {
  id: string;
  subtopic_id: string;
  title: string;
  information: string;
  starter_code: string;
  test_cases_visible: TestCase[];
  test_cases_hidden: TestCase[];
  language_id: number;
  created_at: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  subtopic_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  saved_code: string | null;
  last_accessed_at: string;
}

// Extended types with relations
export interface TopicWithSubTopics extends Topic {
  subtopics: SubTopic[];
}

export interface SubTopicWithContent extends SubTopic {
  content: Content | null;
}

export interface SubTopicWithProgress extends SubTopic {
  user_progress?: UserProgress | null;
}
