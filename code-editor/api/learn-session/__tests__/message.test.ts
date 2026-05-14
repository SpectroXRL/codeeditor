// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockUpsert, mockSingle, mockCreate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpsert: vi.fn(),
  mockSingle: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: { create: mockCreate },
      },
    };
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
      upsert: mockUpsert,
    })),
  })),
}));

import handler from '../message.js';

// ── helpers ──────────────────────────────────────────────────────────────────

let ipCounter = 0;

function makeReq(body: object, authHeader?: string): any {
  ipCounter += 1;
  return {
    method: 'POST',
    headers: {
      'x-forwarded-for': `10.0.${Math.floor(ipCounter / 255)}.${ipCounter % 255}`,
      ...(authHeader ? { authorization: `Bearer ${authHeader}` } : {}),
    },
    body,
  };
}

function makeRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const baseContext = {
  selectedLanguage: { id: 63, name: 'JavaScript', monacoLanguage: 'javascript' },
  currentCode: '// empty',
  recentRunResult: null,
};

const validAiResponse = JSON.stringify({
  response: 'Sure, let us explore closures.',
  nextStage: 'clarify',
  messageType: 'clarifying_question',
  followUps: [],
  detectedStyle: null,
});

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

  mockCreate.mockResolvedValue({
    choices: [{ message: { content: validAiResponse } }],
  });
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockResolvedValue({ error: null });
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/learn-session/message — memory injection', () => {
  it('prepends memory paragraph to system prompt when idle + auth + memory row exists', async () => {
    mockSingle.mockResolvedValue({
      data: {
        preferred_language: 'Python',
        explanation_style: 'concise',
        topics_explored: ['closures'],
        struggled_with: { recursion: 2 },
        last_session_summary: 'They wrote a recursive function.',
      },
      error: null,
    });

    const res = makeRes();
    await handler(
      makeReq({ message: 'teach me closures', context: baseContext, sessionStage: 'idle' }, 'valid-token'),
      res,
    );

    expect(mockCreate).toHaveBeenCalledOnce();
    const messages = mockCreate.mock.calls[0][0].messages as Array<{ role: string; content: string }>;
    const systemContent = messages[0].content;
    expect(systemContent).toContain('Python');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('leaves the system prompt unchanged when idle + auth + no memory row exists', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const res = makeRes();
    await handler(
      makeReq({ message: 'teach me closures', context: baseContext, sessionStage: 'idle' }, 'valid-token'),
      res,
    );

    expect(mockCreate).toHaveBeenCalledOnce();
    const messages = mockCreate.mock.calls[0][0].messages as Array<{ role: string; content: string }>;
    const systemContent = messages[0].content;
    expect(systemContent).not.toContain('Student context from previous sessions');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not fetch memory and does not call getUser when request is unauthenticated', async () => {
    const res = makeRes();
    await handler(
      makeReq({ message: 'teach me closures', context: baseContext, sessionStage: 'idle' }),
      res,
    );

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockSingle).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledOnce();
    const messages = mockCreate.mock.calls[0][0].messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).not.toContain('Student context from previous sessions');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not fetch memory when sessionStage is not idle, even with valid auth', async () => {
    mockSingle.mockResolvedValue({
      data: { preferred_language: 'Python' },
      error: null,
    });

    const res = makeRes();
    await handler(
      makeReq({ message: 'here is my code', context: baseContext, sessionStage: 'practice' }, 'valid-token'),
      res,
    );

    // getUser may be called for the style-write path, but single() (memory read) must not
    expect(mockSingle).not.toHaveBeenCalled();
    const messages = mockCreate.mock.calls[0][0].messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).not.toContain('Student context from previous sessions');
  });
});
