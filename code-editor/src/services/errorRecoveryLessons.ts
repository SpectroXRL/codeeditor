/**
 * Error Recovery Lessons Service
 * Fetches lesson data for error recovery curriculum
 * Extends agentic lessons with error-specific data handling
 */

import { supabase } from './supabase';
import type { 
  Topic, 
  SubTopic, 
  Content, 
  LessonType,
  ApiErrorRecoveryScores,
  ErrorRecoveryHeuristics,
  TestDiffData
} from '../types/database';

/**
 * Extended Content type with error recovery fields guaranteed
 */
export interface ErrorRecoveryContent extends Content {
  broken_code: string;
  error_message: string;
  error_type: 'syntax' | 'runtime' | 'logic' | 'edge_case' | 'performance';
  root_cause_description: string;
  expected_fix_prompt: string;
  baseline_test_results: Array<{
    input: string;
    expected_output: string;
    passed: boolean;
  }>;
}

/**
 * Get lesson content by subtopic ID, with lesson type validation
 */
export async function getErrorRecoveryLessonContent(
  lessonId: string
): Promise<ErrorRecoveryContent | null> {
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('subtopic_id', lessonId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching error recovery lesson content:', error);
    return null;
  }

  // Validate that this is an error recovery lesson
  if (!data.broken_code || !data.error_message) {
    console.warn('Lesson is not an error recovery lesson:', lessonId);
    return null;
  }

  return data as ErrorRecoveryContent;
}

/**
 * Get error recovery lesson with its parent topic info
 */
export async function getErrorRecoveryLessonWithTopic(lessonId: string): Promise<{
  lesson: SubTopic;
  topic: Topic;
  content: ErrorRecoveryContent;
} | null> {
  // Get the subtopic with lesson_type check
  const { data: lesson, error: lessonError } = await supabase
    .from('subtopics')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lesson) {
    console.error('Error fetching lesson:', lessonError);
    return null;
  }

  // Verify this is an error recovery lesson
  if (lesson.lesson_type !== 'error_recovery') {
    console.warn('Lesson is not error_recovery type:', lessonId);
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

  // Get the content with error recovery fields
  const content = await getErrorRecoveryLessonContent(lessonId);
  if (!content) {
    console.error('Error recovery content not found for lesson:', lessonId);
    return null;
  }

  return { lesson, topic, content };
}

/**
 * Get lessons by lesson type
 */
export async function getLessonsByType(
  topicId: string, 
  lessonType: LessonType
): Promise<SubTopic[]> {
  const { data, error } = await supabase
    .from('subtopics')
    .select('*')
    .eq('topic_id', topicId)
    .eq('lesson_type', lessonType)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching lessons by type:', error);
    return [];
  }

  return data || [];
}

/**
 * Check if a lesson is error recovery type
 */
export async function isErrorRecoveryLesson(lessonId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('subtopics')
    .select('lesson_type')
    .eq('id', lessonId)
    .single();

  if (error || !data) return false;
  return data.lesson_type === 'error_recovery';
}

// ============================================
// Evaluation API Calls
// ============================================

export interface EvaluateErrorRecoveryRequest {
  attemptId: string;
  promptHistory: Array<{
    id: string;
    prompt: string;
    generatedCode: string;
    agentReasoning: string;
    timestamp: string;
    iterationNumber: number;
  }>;
  errorType: string;
  brokenCode: string;
  errorMessage: string;
  testsPassed: boolean;
  maxIterations: number;
  baselineTestResults: Array<{
    input: string;
    expected_output: string;
    passed: boolean;
  }>;
  afterTestResults: Array<{
    input: string;
    expected_output: string;
    passed: boolean;
    actual_output?: string;
  }>;
}

export interface EvaluateErrorRecoveryResponse {
  scores: ApiErrorRecoveryScores;
  aiFeedback: string;
  heuristics: ErrorRecoveryHeuristics;
  testDiff: TestDiffData;
  errorTypeDetected: string | null;
}

/**
 * Call the error recovery evaluation API
 */
export async function evaluateErrorRecovery(
  request: EvaluateErrorRecoveryRequest
): Promise<EvaluateErrorRecoveryResponse | null> {
  try {
    const response = await fetch('/api/evaluate-error-recovery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error recovery evaluation failed:', errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling evaluation API:', error);
    return null;
  }
}

/**
 * Compare test results before and after fix
 */
export function computeTestDiff(
  baseline: Array<{ input: string; expected_output: string; passed: boolean }>,
  after: Array<{ input: string; expected_output: string; passed: boolean; actual_output?: string }>
): TestDiffData {
  const beforeMap = new Map(baseline.map(t => [t.input, t]));
  
  const regressions: TestDiffData['regressions'] = [];
  const newlyPassing: TestDiffData['newlyPassing'] = [];

  for (const afterTest of after) {
    const beforeTest = beforeMap.get(afterTest.input);
    
    if (beforeTest) {
      // Test existed before
      if (beforeTest.passed && !afterTest.passed) {
        // Regression: was passing, now failing
        regressions.push({
          input: afterTest.input,
          expectedOutput: afterTest.expected_output,
          actualOutput: afterTest.actual_output,
          passed: false,
        });
      } else if (!beforeTest.passed && afterTest.passed) {
        // Improvement: was failing, now passing
        newlyPassing.push({
          input: afterTest.input,
          expectedOutput: afterTest.expected_output,
          actualOutput: afterTest.actual_output,
          passed: true,
        });
      }
    }
  }

  return {
    before: baseline.map(t => ({
      input: t.input,
      expectedOutput: t.expected_output,
      passed: t.passed,
    })),
    after: after.map(t => ({
      input: t.input,
      expectedOutput: t.expected_output,
      actualOutput: t.actual_output,
      passed: t.passed,
    })),
    regressions,
    newlyPassing,
  };
}
