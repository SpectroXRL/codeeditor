import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import {
  classifyDomain,
  getDomainRefusalMessage,
} from '../shared/domainClassifier.js';
import { getRequestIdentity, checkRateLimit } from '../shared/rateLimit.js';
import {
  getSafeBlockMessage,
  validateChatMessage,
  validateCode,
} from '../shared/validator.js';

type SessionStage =
  | 'idle'
  | 'clarify'
  | 'teach'
  | 'practice'
  | 'check_in'
  | 'reflect'
  | 'challenge';

type MessageType =
  | 'chat'
  | 'clarifying_question'
  | 'starter_code'
  | 'feedback'
  | 'evaluation'
  | 'challenge'
  | 'refusal';

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

interface LearnMessageRequest {
  message: string;
  context: SessionContext;
  sessionStage: SessionStage;
}

interface LearnMessageResponse {
  response: string;
  starterCode?: string;
  nextStage: SessionStage;
  messageType: MessageType;
  learningGoal?: string;
}

const STAGES: SessionStage[] = [
  'idle',
  'clarify',
  'teach',
  'practice',
  'check_in',
  'reflect',
  'challenge',
];

function isSessionStage(value: string): value is SessionStage {
  return STAGES.includes(value as SessionStage);
}

function nextDefaultStage(stage: SessionStage): SessionStage {
  switch (stage) {
    case 'idle':
      return 'clarify';
    case 'clarify':
      return 'teach';
    case 'teach':
      return 'practice';
    case 'practice':
      return 'check_in';
    case 'check_in':
      return 'reflect';
    case 'reflect':
      return 'challenge';
    case 'challenge':
      return 'practice';
    default:
      return 'clarify';
  }
}

function defaultMessageType(stage: SessionStage): MessageType {
  switch (stage) {
    case 'clarify':
      return 'clarifying_question';
    case 'teach':
      return 'starter_code';
    case 'practice':
      return 'feedback';
    case 'check_in':
      return 'chat';
    case 'reflect':
      return 'evaluation';
    case 'challenge':
      return 'challenge';
    default:
      return 'chat';
  }
}

function buildSystemPrompt(stage: SessionStage): string {
  return `You are the learning agent for a code editor "Learn Mode".

Current stage: ${stage}

Mission:
- Help a student learn coding through application, not theory-only explanations.
- Keep responses concise and practical.
- Stay within safe coding-learning support.

Stage behavior:
- idle/clarify: ask one short clarifying question to narrow the goal.
- teach: explain quickly and provide tiny starter code the student can edit.
- practice: inspect student code and give next-step guidance, not full solutions. After 2-3 turns of clear progress, ask a readiness check by setting nextStage to check_in.
- check_in: ask if the student feels they understand it. If they say yes, set nextStage to reflect. If they say no or ask for more help, set nextStage to practice.
- reflect: ask student to explain their understanding back; check conceptual clarity.
- challenge: propose one small challenge aligned with what they just learned.

Output must be valid JSON with this exact shape:
{
  "response": "string",
  "starterCode": "string optional",
  "nextStage": "idle|clarify|teach|practice|check_in|reflect|challenge",
  "messageType": "chat|clarifying_question|starter_code|feedback|evaluation|challenge",
  "learningGoal": "string optional"
}

Rules:
- If the student asks for unrelated content, refuse and ask them to stay focused on coding learning.
- If the user asks for unsafe or malicious content, refuse.
- Only provide starterCode in teach stage or when explicitly needed for learning progression.
- Prefer JavaScript/TypeScript syntax if language context is unclear.
- Never output Markdown fences around JSON.`;
}

function buildContextMessage(
  message: string,
  context: SessionContext,
  stage: SessionStage,
): string {
  const runSummary = context.recentRunResult
    ? `\nRecent Run Result:\n- status: ${context.recentRunResult.status.description}\n- stdout: ${context.recentRunResult.stdout || '(none)'}\n- stderr: ${context.recentRunResult.stderr || '(none)'}\n- compile_output: ${context.recentRunResult.compile_output || '(none)'}`
    : '\nRecent Run Result: none';

  return `Student message: ${message}

Session Context:
- sessionStage: ${stage}
- selectedLanguage: ${context.selectedLanguage.name} (${context.selectedLanguage.id})
- sessionIntent: ${context.sessionIntent || '(not set)'}
- lastAgentGoal: ${context.lastAgentGoal || '(not set)'}

Current Code:
${context.currentCode}
${runSummary}`;
}

function normalizeResponse(
  parsed: Partial<LearnMessageResponse>,
  stage: SessionStage,
): LearnMessageResponse {
  const response =
    typeof parsed.response === 'string' && parsed.response.trim()
      ? parsed.response.trim()
      : 'Let us continue by focusing on your coding goal. What do you want to build or understand next?';

  const nextStage =
    typeof parsed.nextStage === 'string' && isSessionStage(parsed.nextStage)
      ? parsed.nextStage
      : nextDefaultStage(stage);

  const messageType =
    typeof parsed.messageType === 'string'
      ? (parsed.messageType as MessageType)
      : defaultMessageType(nextStage);

  const learningGoal =
    typeof parsed.learningGoal === 'string' && parsed.learningGoal.trim()
      ? parsed.learningGoal.trim()
      : undefined;

  const starterCode =
    typeof parsed.starterCode === 'string' && parsed.starterCode.trim()
      ? parsed.starterCode
      : undefined;

  return {
    response,
    starterCode,
    nextStage,
    messageType,
    learningGoal,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const identity = getRequestIdentity(req.headers['x-forwarded-for']);
  const rate = checkRateLimit(`learn-message:${identity}`, 60, 60 * 60 * 1000);
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
    const body = req.body as LearnMessageRequest;
    if (!body || typeof body.message !== 'string' || !body.context) {
      return res.status(400).json({ error: 'message and context are required' });
    }

    const stage: SessionStage = isSessionStage(body.sessionStage)
      ? body.sessionStage
      : 'idle';

    const validation = validateChatMessage(body.message);
    if (!validation.valid) {
      return res.status(200).json({
        response: getSafeBlockMessage(validation.blockedReason || 'Blocked request'),
        nextStage: stage,
        messageType: 'refusal',
      } satisfies LearnMessageResponse);
    }

    const codeValidation = validateCode(body.context.currentCode || '// empty');
    if (!codeValidation.valid) {
      return res.status(200).json({
        response: 'Your current code could not be processed safely. Try shortening it or removing unsafe content and continue.',
        nextStage: stage,
        messageType: 'refusal',
      } satisfies LearnMessageResponse);
    }

    const classification = classifyDomain(validation.sanitized);
    if (classification !== 'coding') {
      return res.status(200).json({
        response: getDomainRefusalMessage(classification),
        nextStage: stage,
        messageType: 'refusal',
      } satisfies LearnMessageResponse);
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.35,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: buildSystemPrompt(stage) },
        {
          role: 'user',
          content: buildContextMessage(validation.sanitized, body.context, stage),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return res.status(500).json({ error: 'No response from AI service' });
    }

    let parsed: Partial<LearnMessageResponse>;
    try {
      parsed = JSON.parse(raw) as Partial<LearnMessageResponse>;
    } catch {
      parsed = {
        response: raw,
        nextStage: nextDefaultStage(stage),
        messageType: defaultMessageType(stage),
      };
    }

    return res.status(200).json(normalizeResponse(parsed, stage));
  } catch (error) {
    console.error('learn-session/message error:', error);

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
