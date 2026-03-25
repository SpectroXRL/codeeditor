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

// Boss Challenges
export interface Challenge {
  id: string;
  topic_id: string | null;
  subject_id: string | null;
  challenge_type: 'mini_boss' | 'final_boss';
  title: string;
  description: string;
  starter_code: string;
  test_cases: TestCase[];
  language_id: number;
  time_limit_seconds: number;
  cooldown_seconds: number;
  max_score: number;
  hints_allowed: number;
  hint_penalty: number;
  hints: string[];
  created_at: string;
}

export interface ChallengeAttempt {
  id: string;
  user_id: string;
  challenge_id: string;
  started_at: string;
  completed_at: string | null;
  submitted_code: string | null;
  tests_passed: number;
  tests_total: number;
  time_taken_seconds: number | null;
  hints_used: number;
  base_score: number | null;
  time_bonus: number | null;
  hint_penalty: number | null;
  final_score: number | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  created_at: string;
}

export interface ChallengeAttemptability {
  can_attempt: boolean;
  reason?: 'in_progress' | 'cooldown' | 'not_unlocked' | string;
  attempt_id?: string;
  started_at?: string;
  cooldown_remaining?: number;
  cooldown_ends?: string;
}

export interface ChallengeWithAttempts extends Challenge {
  best_attempt?: ChallengeAttempt | null;
  latest_attempt?: ChallengeAttempt | null;
}

export interface SubTopicWithProgress extends SubTopic {
  user_progress?: UserProgress | null;
}
