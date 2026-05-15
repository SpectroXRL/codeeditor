import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import {
  classifyDomain,
  getDomainRefusalMessage,
} from '../../lib/domainClassifier.js';
import { getRequestIdentity, checkRateLimit } from '../../lib/rateLimit.js';
import {
  getSafeBlockMessage,
  validateChatMessage,
  validateCode,
} from '../../lib/validator.js';
import {
  checkUrlSafety,
  extractFirstUrl,
  fetchAndExtract,
  validateUrl,
} from '../../lib/urlFetcher.js';
import { normalizeFollowUps } from '../../lib/normalizeFollowUps.js';
import { normalizeDetectedStyle } from '../../lib/normalizeDetectedStyle.js';
import { buildMemoryParagraph } from '../../lib/buildMemoryParagraph.js';
import { createClient } from '@supabase/supabase-js';

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
  followUps?: string[];
  detectedStyle?: string | null;
}

interface LearnMessageApiResponse extends LearnMessageResponse {
  memoryWritten: boolean;
}

interface ResourceContextPayload {
  url: string;
  content?: string;
  note?: string;
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

const FOLLOW_UP_STAGES: SessionStage[] = [
  'teach',
  'practice',
  'check_in',
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
- idle/clarify: ask one short clarifying question to narrow the goal. After the student gives any substantive answer — even a partial one — set nextStage to "teach" and move on. Never ask more than one clarifying question per exchange.
- teach: explain quickly and provide tiny starter code the student can edit.
- practice: inspect student code and give next-step guidance, not full solutions. After 2-3 turns of clear progress, ask a readiness check by setting nextStage to check_in.
- check_in: ask if the student feels they understand it. If they say yes, set nextStage to reflect. If they say no or ask for more help, set nextStage to practice.
- reflect: ask student to explain their understanding back; check conceptual clarity.
- challenge: propose one small challenge aligned with what they just learned.

Follow-up questions:
- For teach/practice/check_in/challenge stages, generate 2 concise follow-up questions in followUps.
- Balance breadth and depth across the followUps list.
- Keep followUps tightly relevant to the current student message and code context.
- For idle/clarify/reflect stages, return followUps as an empty array.

Output must be valid JSON with this exact shape:
{
  "response": "string",
  "starterCode": "string optional",
  "nextStage": "idle|clarify|teach|practice|check_in|reflect|challenge",
  "messageType": "chat|clarifying_question|starter_code|feedback|evaluation|challenge",
  "learningGoal": "string optional",
  "followUps": ["string", "string"],
  "detectedStyle": "ELI5|concise|detailed|analogy-heavy|null"
}

Style detection:
- Emit detectedStyle only when the student explicitly states a preference for how explanations should be delivered (e.g. "explain like I'm 5", "keep it brief", "give me lots of detail", "use analogies").
- Valid values: "ELI5", "concise", "detailed", "analogy-heavy".
- Set detectedStyle to null when no such explicit preference is stated.

Rules:
- Prefer hints and guiding questions over full answers.
- If the student asks for unrelated content, refuse and ask them to stay focused on coding learning.
- If the user asks for unsafe or malicious content, refuse.
- Only provide starterCode in teach stage or when explicitly needed for learning progression.
- If a Provided Resource section is present, use it as the primary basis for the lesson and extract the most relevant coding concepts.
- If the Provided Resource says content could not be fetched, ask the student to paste the relevant excerpt before continuing.
- Prefer JavaScript/TypeScript syntax if language context is unclear.
- followUps must contain 2 questions only in teach/practice/check_in/challenge. Otherwise use an empty array.
- Never output Markdown fences around JSON.`;
}

function buildContextMessage(
  message: string,
  context: SessionContext,
  stage: SessionStage,
  resourceContext?: ResourceContextPayload,
): string {
  const runSummary = context.recentRunResult
    ? `\nRecent Run Result:\n- status: ${context.recentRunResult.status.description}\n- stdout: ${context.recentRunResult.stdout || '(none)'}\n- stderr: ${context.recentRunResult.stderr || '(none)'}\n- compile_output: ${context.recentRunResult.compile_output || '(none)'}`
    : '\nRecent Run Result: none';

  const resourceSection = resourceContext
    ? resourceContext.content
      ? `\n\nProvided Resource (from ${resourceContext.url}):\n${resourceContext.content}`
      : `\n\nProvided Resource (from ${resourceContext.url}):\n${resourceContext.note || 'Resource content could not be fetched automatically. Ask the student to paste the relevant section manually.'}`
    : '';

  return `Student message: ${message}

Session Context:
- sessionStage: ${stage}
- selectedLanguage: ${context.selectedLanguage.name} (${context.selectedLanguage.id})
- sessionIntent: ${context.sessionIntent || '(not set)'}
- lastAgentGoal: ${context.lastAgentGoal || '(not set)'}

Current Code:
${context.currentCode}
${runSummary}${resourceSection}`;
}

function normalizeResponse(
  parsed: Partial<LearnMessageResponse>,
  stage: SessionStage,
): LearnMessageResponse {
  const response =
    typeof parsed.response === 'string' && parsed.response.trim()
      ? parsed.response.trim()
      : 'Let us continue by focusing on your coding goal. What do you want to build or understand next?';

  const parsedStage =
    typeof parsed.nextStage === 'string' && isSessionStage(parsed.nextStage)
      ? parsed.nextStage
      : nextDefaultStage(stage);

  const messageType =
    typeof parsed.messageType === 'string'
      ? (parsed.messageType as MessageType)
      : defaultMessageType(parsedStage);

  const learningGoal =
    typeof parsed.learningGoal === 'string' && parsed.learningGoal.trim()
      ? parsed.learningGoal.trim()
      : undefined;

  const starterCode =
    typeof parsed.starterCode === 'string' && parsed.starterCode.trim()
      ? parsed.starterCode
      : undefined;

  const followUps = FOLLOW_UP_STAGES.includes(parsedStage)
    ? normalizeFollowUps(parsed.followUps).slice(0, 5)
    : [];

  const validFollowUps = followUps.length >= 2 ? followUps : [];

  const detectedStyle = normalizeDetectedStyle(parsed.detectedStyle);

  return {
    response,
    starterCode,
    nextStage: parsedStage,
    messageType,
    learningGoal,
    followUps: validFollowUps,
    detectedStyle,
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

    const requestedStage: SessionStage = isSessionStage(body.sessionStage)
      ? body.sessionStage
      : 'idle';
    const stage = requestedStage;

    const validation = validateChatMessage(body.message);
    if (!validation.valid) {
      return res.status(200).json({
        response: getSafeBlockMessage(validation.blockedReason || 'Blocked request'),
        nextStage: stage,
        messageType: 'refusal',
        followUps: [],
      } satisfies LearnMessageResponse);
    }

    const codeValidation = validateCode(body.context.currentCode || '// empty');
    if (!codeValidation.valid) {
      return res.status(200).json({
        response: 'Your current code could not be processed safely. Try shortening it or removing unsafe content and continue.',
        nextStage: stage,
        messageType: 'refusal',
        followUps: [],
      } satisfies LearnMessageResponse);
    }

    const classification = classifyDomain(validation.sanitized);
    if (classification !== 'coding') {
      return res.status(200).json({
        response: getDomainRefusalMessage(),
        nextStage: stage,
        messageType: 'refusal',
        followUps: [],
      } satisfies LearnMessageResponse);
    }

    let resourceContext: ResourceContextPayload | undefined;
    const urlInMessage = extractFirstUrl(validation.sanitized);

    if (urlInMessage) {
      const urlRate = checkRateLimit(`learn-url-fetch:${identity}`, 10, 60 * 60 * 1000);
      if (!urlRate.allowed) {
        resourceContext = {
          url: urlInMessage,
          note: 'Resource fetch skipped because link-reading rate limits were reached. Ask the student to paste the relevant section manually.',
        };
      } else {
        const validatedUrl = await validateUrl(urlInMessage);
        if (!validatedUrl.valid || !validatedUrl.normalizedUrl) {
          resourceContext = {
            url: urlInMessage,
            note:
              'The provided link did not pass URL safety validation. Ask the student to paste the relevant docs excerpt manually.',
          };
        } else {
          const safetyCheck = await checkUrlSafety(validatedUrl.normalizedUrl);
          if (!safetyCheck.safe) {
            return res.status(200).json({
              response:
                'I cannot open that link because it appears unsafe. Please share a trusted docs URL or paste the relevant excerpt.',
              nextStage: stage,
              messageType: 'refusal',
              followUps: [],
            } satisfies LearnMessageResponse);
          }

          if (safetyCheck.skipped && safetyCheck.reason) {
            console.warn('Safe Browsing check skipped:', safetyCheck.reason);
          }

          try {
            const fetchedResource = await fetchAndExtract(validatedUrl.normalizedUrl);
            if (fetchedResource.content) {
              resourceContext = {
                url: fetchedResource.sourceUrl,
                content: fetchedResource.content,
              };
            } else {
              resourceContext = {
                url: fetchedResource.sourceUrl,
                note:
                  fetchedResource.failureReason ||
                  'Resource content could not be fetched automatically. Ask the student to paste the relevant section manually.',
              };
            }
          } catch (resourceError) {
            console.warn('Resource fetch pipeline failed:', resourceError);
            resourceContext = {
              url: validatedUrl.normalizedUrl,
              note:
                'Resource content could not be fetched automatically. Ask the student to paste the relevant section manually.',
            };
          }
        }
      }
    }

    let systemPromptContent = buildSystemPrompt(stage);

    if (stage === 'idle') {
      const authHeader = req.headers['authorization'];
      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

      if (token) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
          });

          const { data: { user } } = await supabase.auth.getUser(token);

          if (user) {
            const { data: memoryRow } = await supabase
              .from('user_memory')
              .select('preferred_language, explanation_style, topics_explored, struggled_with, last_session_summary')
              .eq('user_id', user.id)
              .single();

            if (memoryRow) {
              const paragraph = buildMemoryParagraph(memoryRow);
              if (paragraph) {
                systemPromptContent = `Student context from previous sessions:\n${paragraph}\n\n${systemPromptContent}`;
              }
            }
          }
        }
      }
    }

    const openai = new OpenAI({ apiKey });
    const baseMessages = [
      { role: 'system' as const, content: systemPromptContent },
      {
        role: 'user' as const,
        content: buildContextMessage(
          validation.sanitized,
          body.context,
          stage,
          resourceContext,
        ),
      },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.35,
      max_tokens: 1200,
      messages: baseMessages,
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

    const normalized = normalizeResponse(parsed, stage);
    let memoryWritten = false;

    if (normalized.detectedStyle) {
      const authHeader = req.headers['authorization'];
      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

      if (token) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
          });

          const { data: { user } } = await supabase.auth.getUser(token);

          if (user) {
            const { error: upsertError } = await supabase
              .from('user_memory')
              .upsert(
                { user_id: user.id, explanation_style: normalized.detectedStyle },
                { onConflict: 'user_id' },
              );

            if (!upsertError) {
              memoryWritten = true;
            }
          }
        }
      }
    }

    const apiResponse: LearnMessageApiResponse = { ...normalized, memoryWritten };
    return res.status(200).json(apiResponse);
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
