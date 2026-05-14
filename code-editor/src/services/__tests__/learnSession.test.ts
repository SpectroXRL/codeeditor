import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendLearnSessionMessage, endLearnSession } from '../learnSession';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ response: 'ok', nextStage: 'idle', messageType: 'chat' }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const basePayload = {
  message: 'hello',
  context: {
    selectedLanguage: { id: 63, name: 'JavaScript', monacoLanguage: 'javascript' },
    currentCode: '',
    recentRunResult: null,
  },
  sessionStage: 'idle' as const,
};

describe('sendLearnSessionMessage', () => {
  it('always sends Content-Type: application/json', async () => {
    await sendLearnSessionMessage(basePayload);

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends Authorization header when token is provided', async () => {
    await sendLearnSessionMessage(basePayload, 'my-jwt-token');

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('omits Authorization header when no token is provided', async () => {
    await sendLearnSessionMessage(basePayload);

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

const endPayload = {
  chatHistory: [],
  learningGoal: 'closures',
  struggledWith: { closures: 1 },
  selectedLanguage: { id: 63, name: 'JavaScript', monacoLanguage: 'javascript' },
};

describe('endLearnSession', () => {
  it('posts to /api/learn-session/end with correct body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ memoryWritten: true }),
    });

    await endLearnSession(endPayload, 'my-token');

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/learn-session/end');
    expect(JSON.parse(init.body as string)).toMatchObject({
      learningGoal: 'closures',
      struggledWith: { closures: 1 },
    });
  });

  it('always sends Authorization header with bearer token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ memoryWritten: false }),
    });

    await endLearnSession(endPayload, 'end-session-token');

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer end-session-token');
  });
});
