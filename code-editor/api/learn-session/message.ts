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
  validateExecutionRequest,
} from '../shared/validator.js';
import {
  checkUrlSafety,
  extractFirstUrl,
  fetchAndExtract,
  validateUrl,
} from '../shared/urlFetcher.js';
import { isJudge0Configured, pollForResult, submitCode } from '../shared/judge0.js';

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

type LearnMode = 'guided' | 'explain' | 'copilot';

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
  mode?: LearnMode;
}

interface LearnMessageResponse {
  response: string;
  starterCode?: string;
  nextStage: SessionStage;
  messageType: MessageType;
  learningGoal?: string;
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

const MODES: LearnMode[] = ['guided', 'explain', 'copilot'];

const COPILOT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'execute_code',
      description:
        'Executes code in Judge0 using a language ID and returns stdout/stderr/compile output.',
      parameters: {
        type: 'object',
        properties: {
          sourceCode: {
            type: 'string',
            description: 'The source code to execute.',
          },
          languageId: {
            type: 'number',
            description: 'Judge0 language ID (62, 71, 74, 81, or 93).',
          },
          stdin: {
            type: 'string',
            description: 'Optional stdin input for the program.',
          },
        },
        required: ['sourceCode', 'languageId'],
      },
    },
  },
];

interface ExecuteCodeToolArgs {
  sourceCode: string;
  languageId: number;
  stdin?: string;
}

function isSessionStage(value: string): value is SessionStage {
  return STAGES.includes(value as SessionStage);
}

function isLearnMode(value: string): value is LearnMode {
  return MODES.includes(value as LearnMode);
}

function normalizeStageForMode(stage: SessionStage, mode: LearnMode): SessionStage {
  if (mode === 'copilot') {
    return 'practice';
  }

  return stage;
}

function nextDefaultStage(stage: SessionStage, mode: LearnMode): SessionStage {
  if (mode === 'copilot') {
    return 'practice';
  }

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

function defaultMessageType(stage: SessionStage, mode: LearnMode): MessageType {
  if (mode === 'copilot') {
    return 'feedback';
  }

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

function buildSystemPrompt(stage: SessionStage, mode: LearnMode): string {
  if (mode === 'guided') {
    return `You are the learning agent for a code editor "Learn Mode".

Current stage: ${stage}
Current mode: guided

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
- Prefer hints and guiding questions over full answers.
- If the student asks for unrelated content, refuse and ask them to stay focused on coding learning.
- If the user asks for unsafe or malicious content, refuse.
- Only provide starterCode in teach stage or when explicitly needed for learning progression.
- If a Provided Resource section is present, use it as the primary basis for the lesson and extract the most relevant coding concepts.
- If the Provided Resource says content could not be fetched, ask the student to paste the relevant excerpt before continuing.
- Prefer JavaScript/TypeScript syntax if language context is unclear.
- Never output Markdown fences around JSON.`;
  }

  if (mode === 'explain') {
    return `You are the learning agent for a code editor "Learn Mode".

Current stage: ${stage}
Current mode: explain

Mission:
- Teach coding concepts with clear explanations and concrete examples.
- Be practical and concise while still concept-first.

Stage behavior:
- idle/clarify: ask one clarifying question unless the goal is already specific.
- teach: explain the concept in simple steps and include runnable starterCode the student can edit.
- practice: explain why the student's code is behaving this way, then suggest the next change.
- check_in: ask if they feel confident and what part still feels unclear.
- reflect: validate their explanation and close any conceptual gaps.
- challenge: propose one small challenge aligned with the concept.

Output must be valid JSON with this exact shape:
{
  "response": "string",
  "starterCode": "string optional",
  "nextStage": "idle|clarify|teach|practice|check_in|reflect|challenge",
  "messageType": "chat|clarifying_question|starter_code|feedback|evaluation|challenge",
  "learningGoal": "string optional"
}

Rules:
- In teach stage, always include starterCode unless code already exists and only minor feedback is needed.
- Explain tradeoffs and mental models briefly when relevant.
- If the student asks for unrelated content, refuse and ask them to stay focused on coding learning.
- If the user asks for unsafe or malicious content, refuse.
- If a Provided Resource section is present, use it as primary lesson context.
- If the Provided Resource says content could not be fetched, ask the student to paste the relevant excerpt.
- Prefer JavaScript/TypeScript syntax if language context is unclear.
- Never output Markdown fences around JSON.`;
  }

  return `You are the learning agent for a code editor "Learn Mode".

Current stage: ${stage}
Current mode: copilot

Mission:
- Act as a direct coding copilot that can generate and refactor working code.
- Keep responses concise and technical.

Stage behavior:
- Always treat this as practice stage: respond directly to build/refactor/debug requests.
- Generate complete code when asked.
- If useful, call execute_code to validate behavior before answering.
- Set nextStage to practice for all responses in this mode.
- Use messageType feedback unless a refusal is required.

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
- starterCode is optional; include it when delivering generated or refactored code.
- If a Provided Resource section is present, use it as the primary basis for the lesson and extract the most relevant coding concepts.
- If the Provided Resource says content could not be fetched, ask the student to paste the relevant excerpt before continuing.
- Prefer JavaScript/TypeScript syntax if language context is unclear.
- Never output Markdown fences around JSON.`;
}

function buildContextMessage(
  message: string,
  context: SessionContext,
  stage: SessionStage,
  mode: LearnMode,
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
- mode: ${mode}
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
  mode: LearnMode,
): LearnMessageResponse {
  const response =
    typeof parsed.response === 'string' && parsed.response.trim()
      ? parsed.response.trim()
      : 'Let us continue by focusing on your coding goal. What do you want to build or understand next?';

  const parsedStage =
    typeof parsed.nextStage === 'string' && isSessionStage(parsed.nextStage)
      ? parsed.nextStage
      : nextDefaultStage(stage, mode);

  const nextStage = normalizeStageForMode(parsedStage, mode);

  const messageType =
    typeof parsed.messageType === 'string'
      ? (parsed.messageType as MessageType)
      : defaultMessageType(nextStage, mode);

  const normalizedMessageType: MessageType =
    mode === 'copilot' && messageType !== 'refusal' ? 'feedback' : messageType;

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
    messageType: normalizedMessageType,
    learningGoal,
  };
}

function parseExecuteCodeToolArgs(rawArgs: string): ExecuteCodeToolArgs | null {
  try {
    const parsed = JSON.parse(rawArgs) as Partial<ExecuteCodeToolArgs>;
    if (
      typeof parsed.sourceCode !== 'string' ||
      typeof parsed.languageId !== 'number'
    ) {
      return null;
    }

    return {
      sourceCode: parsed.sourceCode,
      languageId: parsed.languageId,
      stdin: typeof parsed.stdin === 'string' ? parsed.stdin : '',
    };
  } catch {
    return null;
  }
}

async function runExecuteCodeTool(rawArgs: string): Promise<string> {
  const args = parseExecuteCodeToolArgs(rawArgs);
  if (!args) {
    return JSON.stringify({
      ok: false,
      error: 'Invalid execute_code arguments',
    });
  }

  if (!isJudge0Configured()) {
    return JSON.stringify({
      ok: false,
      error: 'JUDGE0_API_KEY is not configured on the server',
    });
  }

  const executionValidation = validateExecutionRequest(
    args.sourceCode,
    args.languageId,
  );
  if (!executionValidation.valid) {
    return JSON.stringify({
      ok: false,
      error: executionValidation.blockedReason || 'Execution request blocked',
    });
  }

  try {
    const token = await submitCode(
      executionValidation.sanitized,
      args.languageId,
      args.stdin || '',
    );
    const result = await pollForResult(token);
    return JSON.stringify({
      ok: true,
      status: result.status.description,
      stdout: result.stdout,
      stderr: result.stderr,
      compile_output: result.compile_output,
      message: result.message,
      time: result.time,
      memory: result.memory,
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    });
  }
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

    const mode: LearnMode =
      typeof body.mode === 'string' && isLearnMode(body.mode)
        ? body.mode
        : 'guided';

    const requestedStage: SessionStage = isSessionStage(body.sessionStage)
      ? body.sessionStage
      : 'idle';
    const stage = normalizeStageForMode(requestedStage, mode);

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

    const openai = new OpenAI({ apiKey });
    const baseMessages = [
      { role: 'system', content: buildSystemPrompt(stage, mode) },
      {
        role: 'user',
        content: buildContextMessage(
          validation.sanitized,
          body.context,
          stage,
          mode,
          resourceContext,
        ),
      },
    ];

    const completionParams: Record<string, unknown> = {
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: mode === 'copilot' ? 0.25 : 0.35,
      max_tokens: 1200,
      messages: baseMessages,
    };

    if (mode === 'copilot') {
      completionParams.tools = COPILOT_TOOLS;
      completionParams.tool_choice = 'auto';
    }

    const completion = await openai.chat.completions.create(completionParams as any);
    let raw = completion.choices[0]?.message?.content;
    const firstMessage = completion.choices[0]?.message;

    if (mode === 'copilot' && firstMessage?.tool_calls?.length) {
      const executeCodeToolCall = firstMessage.tool_calls.find(
        (toolCall) =>
          toolCall.type === 'function' && toolCall.function.name === 'execute_code',
      );

      if (executeCodeToolCall) {
        const toolResultContent = await runExecuteCodeTool(
          executeCodeToolCall.type === 'function'
            ? executeCodeToolCall.function.arguments
            : '{}',
        );

        const followupCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          temperature: 0.25,
          max_tokens: 1200,
          messages: [
            ...baseMessages,
            {
              role: 'assistant',
              content: firstMessage.content ?? '',
              tool_calls: firstMessage.tool_calls,
            },
            {
              role: 'tool',
              tool_call_id: executeCodeToolCall.id,
              content: toolResultContent,
            },
          ] as any,
        });

        raw = followupCompletion.choices[0]?.message?.content || raw;
      }
    }

    if (!raw) {
      return res.status(500).json({ error: 'No response from AI service' });
    }

    let parsed: Partial<LearnMessageResponse>;
    try {
      parsed = JSON.parse(raw) as Partial<LearnMessageResponse>;
    } catch {
      parsed = {
        response: raw,
        nextStage: nextDefaultStage(stage, mode),
        messageType: defaultMessageType(stage, mode),
      };
    }

    return res.status(200).json(normalizeResponse(parsed, stage, mode));
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
