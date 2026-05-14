import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useLearnSession } from '../useLearnSession';
import { sendLearnSessionMessage } from '../../../services/learnSession';
import type { SessionContext } from '../../../types/session';
import type { Session } from '@supabase/supabase-js';

vi.mock('../../../services/learnSession', () => ({
  sendLearnSessionMessage: vi.fn(),
  evaluateLearnSession: vi.fn(),
}));

vi.mock('../../../context/useAuth', () => ({
  useAuth: vi.fn(),
}));

const { useAuth } = await import('../../../context/useAuth');
const mockedUseAuth = vi.mocked(useAuth);
const mockedSendLearnSessionMessage = vi.mocked(sendLearnSessionMessage);

const context: SessionContext = {
  selectedLanguage: { id: 63, name: 'JavaScript', monacoLanguage: 'javascript' },
  currentCode: '',
  recentRunResult: null,
};

const fakeSession = {
  access_token: 'test-jwt-abc123',
} as unknown as Session;

beforeEach(() => {
  vi.clearAllMocks();
  mockedSendLearnSessionMessage.mockResolvedValue({
    response: 'ok',
    nextStage: 'idle',
    messageType: 'chat',
  });
});

describe('useLearnSession auth token forwarding', () => {
  it('passes the access token to sendLearnSessionMessage when authenticated', async () => {
    mockedUseAuth.mockReturnValue({
      session: fakeSession,
      user: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'hello', context });
    });

    expect(mockedSendLearnSessionMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'hello' }),
      'test-jwt-abc123',
    );
  });

  it('passes no token to sendLearnSessionMessage when unauthenticated', async () => {
    mockedUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'hello', context });
    });

    expect(mockedSendLearnSessionMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'hello' }),
      undefined,
    );
  });
});
