import type { Content } from '../types/database';
import type { AssistanceTier, DetectedIssue, TutorResponse } from '../types';

export interface TutorHelpParams {
  code: string;
  content: Content;
  issue?: DetectedIssue;
  tier: AssistanceTier;
  language: string;
}

/**
 * Get AI tutor help for a lesson
 * Sends lesson context for more relevant responses
 */
export async function getTutorHelp(params: TutorHelpParams): Promise<TutorResponse> {
  const { code, content, issue, tier, language } = params;

  try {
    const response = await fetch('/api/tutor-help', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        lessonTitle: content.title,
        lessonContent: content.information,
        starterCode: content.starter_code,
        issue: issue
          ? {
              type: issue.type,
              message: issue.message,
              line: issue.line,
            }
          : null,
        tier,
        language,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to get tutor help' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      response: data.response,
      tier: data.tier,
      followUpAvailable: data.followUpAvailable,
    };
  } catch (error) {
    console.error('Tutor help API error:', error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to get tutor help. Please try again.');
  }
}

/**
 * Get the next assistance tier for escalation
 */
export function getNextTier(currentTier: AssistanceTier): AssistanceTier | null {
  const tierOrder: AssistanceTier[] = ['tip', 'question', 'hint', 'explanation'];
  const currentIndex = tierOrder.indexOf(currentTier);

  if (currentIndex === -1 || currentIndex >= tierOrder.length - 1) {
    return null; // Already at max tier
  }

  return tierOrder[currentIndex + 1];
}

/**
 * Get display label for tier
 */
export function getTierLabel(tier: AssistanceTier): string {
  const labels: Record<AssistanceTier, string> = {
    tip: 'Quick Tip',
    question: 'Guiding Question',
    hint: 'Helpful Hint',
    explanation: 'Full Explanation',
  };
  return labels[tier];
}
