import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { classifyDomain, getDomainRefusalMessage } from '../../lib/domainClassifier.js';
import { checkRateLimit, getRequestIdentity } from '../../lib/rateLimit.js';
import {
  getSafeBlockMessage,
  validateChatMessage,
  validateCode,
} from '../../lib/validator.js';

type SessionStage =
  | 'idle'
  | 'clarify'
  | 'teach'
  | 'practice'
  | 'reflect'
  | 'challenge';

interface SessionContext {
  selectedLanguage: {
    id: number;
    name: string;
    monacoLanguage: string;
  };
  currentCode: string;
  recentRunResult?: {
    stdout: string | null;
    stderr: string | null;
    compile_output: string | null;
    message: string | null;
    status: {
      id: number;
      description: string;
    };
    time: string | null;
    memory: number | null;
  } | null;
  lastAgentGoal?: string;
  sessionIntent?: string;
}

interface EvaluateRequest {
  originalCode: string;
  currentCode: string;
  studentExplanation?: string;
  context: SessionContext;
}

interface EvaluateResponse {
  understood: boolean;
  feedback: string;
  suggestChallenge: boolean;
  challengePrompt?: string;
  nextStage: SessionStage;
}

function estimateLineDiff(before: string, after: string): number {
  const beforeLines = before
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const afterLines = after
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (beforeLines.length === 0 && afterLines.length === 0) {
    return 0;
  }

  const overlap = beforeLines.filter((line) => afterLines.includes(line)).length;
  const baseline = Math.max(beforeLines.length, afterLines.length);
  if (baseline === 0) {
    return 0;
  }

  return Math.max(0, Math.round(((baseline - overlap) / baseline) * 100));
}

function normalizeEvaluateResponse(parsed: Partial<EvaluateResponse>): EvaluateResponse {
  const understood = Boolean(parsed.understood);
  const feedback =
    typeof parsed.feedback === 'string' && parsed.feedback.trim()
      ? parsed.feedback.trim()
      : understood
        ? 'Nice progress. You made meaningful edits and your reasoning is on track.'
        : 'Keep iterating: make a targeted code change and explain why it works.';

  const suggestChallenge = Boolean(parsed.suggestChallenge);
  const challengePrompt =
    typeof parsed.challengePrompt === 'string' && parsed.challengePrompt.trim()
      ? parsed.challengePrompt.trim()
      : undefined;

  const nextStage: SessionStage = understood
    ? suggestChallenge
      ? 'challenge'
      : 'practice'
    : 'practice';

  return {
    understood,
    feedback,
    suggestChallenge,
    challengePrompt,
    nextStage,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const identity = getRequestIdentity(req.headers['x-forwarded-for']);
  const rate = checkRateLimit(`learn-evaluate:${identity}`, 60, 60 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader('Retry-After', rate.retryAfterSeconds.toString());
    return res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.',
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const body = req.body as EvaluateRequest;
    if (!body || !body.context) {
      return res.status(400).json({ error: 'Request body and context are required' });
    }

    const originalCodeValidation = validateCode(body.originalCode || '// empty');
    const currentCodeValidation = validateCode(body.currentCode || '// empty');
    if (!originalCodeValidation.valid || !currentCodeValidation.valid) {
      return res.status(400).json({
        error: 'Both originalCode and currentCode must be valid non-empty strings',
      });
    }

    const studentExplanation = body.studentExplanation?.trim() || '';
    if (studentExplanation) {
      const explanationValidation = validateChatMessage(studentExplanation);
      if (!explanationValidation.valid) {
        return res.status(200).json({
          understood: false,
          feedback: getSafeBlockMessage(
            explanationValidation.blockedReason || 'Blocked request',
          ),
          suggestChallenge: false,
          nextStage: 'practice',
        } satisfies EvaluateResponse);
      }

      const classification = classifyDomain(explanationValidation.sanitized);
      if (classification !== 'coding') {
        return res.status(200).json({
          understood: false,
          feedback: getDomainRefusalMessage(classification),
          suggestChallenge: false,
          nextStage: 'practice',
        } satisfies EvaluateResponse);
      }
    }

    const diffPercent = estimateLineDiff(body.originalCode, body.currentCode);
    const hasMeaningfulEdit = diffPercent >= 10;

    if (!hasMeaningfulEdit && !studentExplanation) {
      return res.status(200).json({
        understood: false,
        feedback:
          'I do not see enough code changes yet. Make a small targeted edit, run it, then explain what changed and why.',
        suggestChallenge: false,
        nextStage: 'practice',
      } satisfies EvaluateResponse);
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: `You evaluate whether a student understands a coding concept.

Output valid JSON only:
{
  "understood": boolean,
  "feedback": "string",
  "suggestChallenge": boolean,
  "challengePrompt": "string optional",
  "nextStage": "practice|challenge"
}

Evaluation rubric:
- Check if code edits are meaningful and aligned with the goal.
- Check if student explanation reflects causal understanding.
- Be encouraging and precise.
- If understanding is weak, return nextStage=practice and suggestChallenge=false.
- If understanding is strong, return nextStage=challenge and suggestChallenge=true with a short challenge.`,
        },
        {
          role: 'user',
          content: `Language: ${body.context.selectedLanguage.name}
Session Intent: ${body.context.sessionIntent || '(not set)'}
Last Agent Goal: ${body.context.lastAgentGoal || '(not set)'}
Diff Percent Estimate: ${diffPercent}

Original code:
${body.originalCode}

Current code:
${body.currentCode}

Student explanation:
${studentExplanation || '(none provided)'}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return res.status(500).json({ error: 'No response from AI service' });
    }

    let parsed: Partial<EvaluateResponse>;
    try {
      parsed = JSON.parse(raw) as Partial<EvaluateResponse>;
    } catch {
      parsed = {
        understood: hasMeaningfulEdit,
        feedback: hasMeaningfulEdit
          ? 'You made useful edits. Explain the reasoning in one sentence, then I can give you a challenge.'
          : 'The changes are still too small or unclear. Try a focused update and explain your approach.',
        suggestChallenge: false,
        nextStage: 'practice',
      };
    }

    const normalized = normalizeEvaluateResponse(parsed);
    return res.status(200).json(normalized);
  } catch (error) {
    console.error('learn-session/evaluate error:', error);

    if (error instanceof OpenAI.APIError) {
      return res.status(error.status || 500).json({
        error: error.message || 'OpenAI API error',
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
