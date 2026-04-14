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
  hints: string[];
  created_at: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  subtopic_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  saved_code: string | null;
  last_accessed_at: string;
  assistance_count?: number;
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
  challenge_mode?: 'code' | 'agentic'; // 'code' is default for backwards compatibility
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
  // Agentic-specific fields (only present when challenge_mode = 'agentic')
  reference_prompt?: string | null;
  max_iterations?: number;
  techniques_covered?: string[];
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

// AI Tutor Types
export type AssistanceTier = 'tip' | 'question' | 'hint' | 'explanation';

export interface AIAssistanceLog {
  id: string;
  user_id: string;
  subtopic_id: string;
  assistance_tier: AssistanceTier;
  issue_type: string | null;
  code_snippet: string | null;
  response_summary: string | null;
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

// ============================================
// Agentic Engineering Types
// ============================================

export type ChallengeMode = 'code' | 'agentic';

export type PromptTechnique = 
  | 'zero-shot'
  | 'few-shot'
  | 'chain-of-thought'
  | 'system-prompt'
  | 'iterative-refinement'
  | 'context-management'
  | 'tool-calling';

export interface AgenticChallenge extends Challenge {
  challenge_mode: ChallengeMode;
  reference_prompt?: string | null;
  max_iterations: number;
  techniques_covered: PromptTechnique[];
}

export interface PromptTurn {
  id: string;
  prompt: string;
  generatedCode: string;
  agentReasoning: string;
  timestamp: string;
  iterationNumber: number;
}

export interface AgenticAttempt {
  id: string;
  challenge_attempt_id: string;
  user_id: string;
  prompt_history: PromptTurn[];
  iterations_used: number;
  techniques_tagged: PromptTechnique[];
  created_at: string;
  updated_at: string;
}

export interface PromptScores {
  id: string;
  agentic_attempt_id: string;
  clarity_score: number;
  efficiency_score: number;
  context_score: number;
  technique_score: number;
  final_score: number;
  ai_feedback: string | null;
  heuristics_data: PromptHeuristics;
  created_at: string;
}

/**
 * API/UI shape for prompt scores (camelCase, scores only)
 * Used in API responses and UI components
 */
export interface ApiPromptScores {
  clarity: number;
  efficiency: number;
  context: number;
  technique: number;
  final: number;
}

/**
 * API/UI shape for heuristics data (camelCase)
 */
export interface ApiHeuristicsData {
  totalIterations: number;
  totalPromptTokens: number;
  averagePromptLength: number;
  techniquesDetected: PromptTechnique[];
  improvementBetweenIterations: boolean;
  firstAttemptSuccess: boolean;
}

export interface PromptHeuristics {
  total_iterations: number;
  total_prompt_tokens: number;
  average_prompt_length: number;
  techniques_detected: PromptTechnique[];
  improvement_between_iterations: boolean;
  first_attempt_success: boolean;
}

export interface PromptValidationLog {
  id: string;
  user_id: string;
  attempt_id: string | null;
  prompt_text: string;
  validation_result: 'passed' | 'blocked';
  blocked_reason: string | null;
  risk_level: 'low' | 'medium' | 'high';
  created_at: string;
}

// Scoring rubric weights (configurable per challenge)
export interface PromptRubric {
  clarity_weight: number;
  efficiency_weight: number;
  context_weight: number;
  technique_weight: number;
}

// Default rubric
export const DEFAULT_PROMPT_RUBRIC: PromptRubric = {
  clarity_weight: 0.30,
  efficiency_weight: 0.25,
  context_weight: 0.20,
  technique_weight: 0.25,
};

// Technique metadata for UI
export const PROMPT_TECHNIQUES: Record<PromptTechnique, { label: string; description: string }> = {
  'zero-shot': {
    label: 'Zero-Shot',
    description: 'Direct instruction without examples'
  },
  'few-shot': {
    label: 'Few-Shot',
    description: 'Providing examples to guide the output'
  },
  'chain-of-thought': {
    label: 'Chain-of-Thought',
    description: 'Encouraging step-by-step reasoning'
  },
  'system-prompt': {
    label: 'System Prompt / Role',
    description: 'Setting context or persona for the agent'
  },
  'iterative-refinement': {
    label: 'Iterative Refinement',
    description: 'Building on previous responses to improve output'
  },
  'context-management': {
    label: 'Context Management',
    description: 'Strategic inclusion/exclusion of information'
  },
  'tool-calling': {
    label: 'Tool/Function Calling',
    description: 'Instructing the agent to use specific capabilities'
  },
};

export interface SubTopicWithProgress extends SubTopic {
  user_progress?: UserProgress | null;
}

export interface SubTopicWithProgress extends SubTopic {
  user_progress?: UserProgress | null;
}
