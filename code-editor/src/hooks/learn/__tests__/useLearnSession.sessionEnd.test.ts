import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useLearnSession } from '../useLearnSession';
import { endLearnSession, sendLearnSessionMessage } from '../../../services/learnSession';
import type { SessionContext } from '../../../types/session';
import type { Session } from '@supabase/supabase-js';

vi.mock('../../../services/learnSession', () => ({
  sendLearnSessionMessage: vi.fn(),
  evaluateLearnSession: vi.fn(),
  endLearnSession: vi.fn(),
}));

vi.mock('../../../context/useAuth', () => ({
  useAuth: vi.fn(),
}));

const { useAuth } = await import('../../../context/useAuth');
const mockedUseAuth = vi.mocked(useAuth);
const mockedEndLearnSession = vi.mocked(endLearnSession);
const mockedSendLearnSessionMessage = vi.mocked(sendLearnSessionMessage);

const defaultLanguage = { id: 63, name: 'JavaScript', monacoLanguage: 'javascript' };

const context: SessionContext = {
  selectedLanguage: defaultLanguage,
  currentCode: '',
  recentRunResult: null,
};

const fakeSession = {
  access_token: 'test-jwt-end123',
} as unknown as Session;

const authState = {
  session: fakeSession,
  user: null,
  loading: false,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

const unauthState = {
  session: null,
  user: null,
  loading: false,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedSendLearnSessionMessage.mockResolvedValue({
    response: 'ok',
    nextStage: 'idle',
    messageType: 'chat',
  });
  mockedEndLearnSession.mockResolvedValue({ memoryWritten: false });
});

describe('useLearnSession session end', () => {
  it('calls endLearnSession when authenticated and resetSession is called', () => {
    mockedUseAuth.mockReturnValue(authState);

    const { result } = renderHook(() => useLearnSession());

    act(() => {
      result.current.resetSession({ selectedLanguage: defaultLanguage });
    });

    expect(mockedEndLearnSession).toHaveBeenCalledTimes(1);
  });

  it('does not call endLearnSession when unauthenticated', () => {
    mockedUseAuth.mockReturnValue(unauthState);

    const { result } = renderHook(() => useLearnSession());

    act(() => {
      result.current.resetSession({ selectedLanguage: defaultLanguage });
    });

    expect(mockedEndLearnSession).not.toHaveBeenCalled();
  });

  it('resets state immediately even when endLearnSession throws', async () => {
    mockedUseAuth.mockReturnValue(authState);
    mockedEndLearnSession.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useLearnSession());

    // Put the session in a non-idle state first
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Teach you loops.',
      nextStage: 'teach',
      messageType: 'chat',
    });
    await act(async () => {
      await result.current.sendMessage({ message: 'teach me loops', context });
    });
    expect(result.current.sessionStage).toBe('teach');

    act(() => {
      result.current.resetSession({ selectedLanguage: defaultLanguage });
    });

    expect(result.current.sessionStage).toBe('idle');
    expect(result.current.chatHistory).toHaveLength(1); // only the initial agent message
  });

  it('passes chatHistory, learningGoal, struggledWith, and selectedLanguage to endLearnSession', async () => {
    mockedUseAuth.mockReturnValue(authState);

    mockedSendLearnSessionMessage
      .mockResolvedValueOnce({
        response: 'Let us start.',
        nextStage: 'teach',
        messageType: 'chat',
        learningGoal: 'closures',
      })
      // Second call triggers struggledWith increment (check_in → teach)
      .mockResolvedValueOnce({
        response: 'Check in time.',
        nextStage: 'check_in',
        messageType: 'chat',
      })
      .mockResolvedValueOnce({
        response: 'Teach again.',
        nextStage: 'teach',
        messageType: 'chat',
      });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'teach me closures', context });
    });

    act(() => {
      result.current.resetSession({ selectedLanguage: defaultLanguage });
    });

    expect(mockedEndLearnSession).toHaveBeenCalledWith(
      expect.objectContaining({
        learningGoal: 'closures',
        selectedLanguage: defaultLanguage,
        chatHistory: expect.any(Array),
        struggledWith: expect.any(Object),
      }),
      fakeSession.access_token,
    );
  });

  it('sets memoryWritten to true when endLearnSession resolves with memoryWritten: true', async () => {
    mockedUseAuth.mockReturnValue(authState);
    mockedEndLearnSession.mockResolvedValueOnce({ memoryWritten: true });

    const { result } = renderHook(() => useLearnSession());

    act(() => {
      result.current.resetSession({ selectedLanguage: defaultLanguage });
    });

    // Wait for the fire-and-forget promise to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.memoryWritten).toBe(true);
  });
});
