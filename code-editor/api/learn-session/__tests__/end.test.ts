// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

import handler from '../end.js';

// ── helpers ──────────────────────────────────────────────────────────────────

const userMsg = (content: string) => ({
  id: '1',
  role: 'user' as const,
  content,
  messageType: 'chat' as const,
  timestamp: '2026-01-01T00:00:00Z',
});

const agentMsg = (content: string) => ({
  id: '2',
  role: 'agent' as const,
  content,
  messageType: 'chat' as const,
  timestamp: '2026-01-01T00:00:01Z',
});

const basePayload = {
  chatHistory: [userMsg('teach me closures'), agentMsg('Closures are...')],
  learningGoal: 'closures',
  struggledWith: {},
  selectedLanguage: { name: 'JavaScript' },
};

function makeReq(body: object, authHeader?: string): VercelRequest {
  return {
    method: 'POST',
    headers: authHeader ? { authorization: `Bearer ${authHeader}` } : {},
    body,
  } as unknown as VercelRequest;
}

function makeRes(): VercelResponse {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as VercelResponse;
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

  mockCreate.mockResolvedValue({
    choices: [{ message: { content: 'A concise summary of the session.' } }],
  });
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockResolvedValue({ error: null });
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/learn-session/end', () => {
  it('returns memoryWritten: false when no Authorization header is present', async () => {
    const res = makeRes();

    await handler(makeReq(basePayload), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ memoryWritten: false });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns memoryWritten: false when chatHistory has no user messages', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    const emptyPayload = {
      ...basePayload,
      chatHistory: [agentMsg('Tell me what you want to learn.')],
    };
    const res = makeRes();

    await handler(makeReq(emptyPayload, 'valid-token'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ memoryWritten: false });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('calls the AI for a summary and writes memory when session has user messages', async () => {
    const res = makeRes();

    await handler(makeReq(basePayload, 'valid-token'), res);

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ memoryWritten: true });
  });

  it('merges struggled_with additively with existing row values', async () => {
    mockSingle.mockResolvedValue({
      data: {
        struggled_with: { closures: 2, promises: 1 },
        topics_explored: ['closures'],
      },
      error: null,
    });

    const payload = {
      ...basePayload,
      struggledWith: { closures: 1, 'async/await': 3 },
    };
    const res = makeRes();

    await handler(makeReq(payload, 'valid-token'), res);

    const upsertArg = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(upsertArg['struggled_with']).toEqual({
      closures: 3,
      promises: 1,
      'async/await': 3,
    });
    expect(res.json).toHaveBeenCalledWith({ memoryWritten: true });
  });

  it('deduplicates topics_explored and caps at 20 most recent entries', async () => {
    const existingTopics = Array.from({ length: 19 }, (_, i) => `topic-${i}`);
    mockSingle.mockResolvedValue({
      data: {
        struggled_with: {},
        topics_explored: [...existingTopics, 'closures'], // closures already present
      },
      error: null,
    });

    // learningGoal is 'closures' (duplicate) — total unique should remain ≤ 20
    const res = makeRes();

    await handler(makeReq(basePayload, 'valid-token'), res);

    const upsertArg = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    const topics = upsertArg['topics_explored'] as string[];
    expect(topics).toHaveLength(20);
    expect(topics.filter((t) => t === 'closures')).toHaveLength(1);
    expect(topics[topics.length - 1]).toBe('closures'); // most recent last
  });

  it('caps topics_explored at 20 when goal is genuinely new', async () => {
    const existingTopics = Array.from({ length: 20 }, (_, i) => `topic-${i}`);
    mockSingle.mockResolvedValue({
      data: { struggled_with: {}, topics_explored: existingTopics },
      error: null,
    });

    const res = makeRes();

    await handler(makeReq(basePayload, 'valid-token'), res);

    const upsertArg = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    const topics = upsertArg['topics_explored'] as string[];
    expect(topics).toHaveLength(20);
    expect(topics[topics.length - 1]).toBe('closures');
    expect(topics).not.toContain('topic-0'); // oldest dropped
  });
});
