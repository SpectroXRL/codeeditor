import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useLearnSession } from '../useLearnSession';
import { sendLearnSessionMessage, endLearnSession } from '../../../services/learnSession';
import type { SessionContext } from '../../../types/session';
import type { Session } from '@supabase/supabase-js';

vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
  toast: vi.fn(),
}));

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
const mockedSendLearnSessionMessage = vi.mocked(sendLearnSessionMessage);
const mockedEndLearnSession = vi.mocked(endLearnSession);

import toast from 'react-hot-toast';
const mockedToast = vi.mocked(toast);

const context: SessionContext = {
  selectedLanguage: { id: 63, name: 'JavaScript', monacoLanguage: 'javascript' },
  currentCode: '',
  recentRunResult: null,
};

const unauthState = {
  session: null,
  user: null,
  loading: false,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

const fakeSession = { access_token: 'test-jwt-toast' } as unknown as Session;
const authState = {
  session: fakeSession,
  user: null,
  loading: false,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue(unauthState);
  mockedEndLearnSession.mockResolvedValue({ memoryWritten: false });
});

describe('useLearnSession toast', () => {
  it('fires a "Memory updated" toast when sendMessage returns memoryWritten: true', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Got it, keeping things brief.',
      nextStage: 'teach',
      messageType: 'chat',
      memoryWritten: true,
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'keep it brief', context });
    });

    expect(mockedToast).toHaveBeenCalledWith('Memory updated');
  });

  it('fires the toast only once per session when sendMessage returns memoryWritten: true twice', async () => {
    mockedSendLearnSessionMessage
      .mockResolvedValueOnce({
        response: 'Got it.',
        nextStage: 'teach',
        messageType: 'chat',
        memoryWritten: true,
      })
      .mockResolvedValueOnce({
        response: 'Still brief.',
        nextStage: 'teach',
        messageType: 'chat',
        memoryWritten: true,
      });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'keep it brief', context });
    });
    await act(async () => {
      await result.current.sendMessage({ message: 'even briefer', context });
    });

    expect(mockedToast).toHaveBeenCalledTimes(1);
  });

  it('does not fire a toast when memoryWritten is false', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Sure.',
      nextStage: 'teach',
      messageType: 'chat',
      memoryWritten: false,
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'hello', context });
    });

    expect(mockedToast).not.toHaveBeenCalled();
  });

  it('fires a "Memory updated" toast when resetSession resolves with memoryWritten: true', async () => {
    mockedUseAuth.mockReturnValue(authState);
    mockedEndLearnSession.mockResolvedValueOnce({ memoryWritten: true });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      result.current.resetSession();
      // flush the microtask queue so the .then() runs
      await Promise.resolve();
    });

    expect(mockedToast).toHaveBeenCalledWith('Memory updated');
  });

  it('does not fire a toast on session end when the user is unauthenticated', async () => {
    mockedUseAuth.mockReturnValue(unauthState);

    const { result } = renderHook(() => useLearnSession());

    act(() => {
      result.current.resetSession();
    });

    expect(mockedEndLearnSession).not.toHaveBeenCalled();
    expect(mockedToast).not.toHaveBeenCalled();
  });
});
