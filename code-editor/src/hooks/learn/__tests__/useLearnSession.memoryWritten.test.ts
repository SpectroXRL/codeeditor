import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useLearnSession } from '../useLearnSession';
import { sendLearnSessionMessage } from '../../../services/learnSession';
import type { SessionContext } from '../../../types/session';

vi.mock('../../../services/learnSession', () => ({
  sendLearnSessionMessage: vi.fn(),
  evaluateLearnSession: vi.fn(),
}));

vi.mock('../../../context/useAuth', () => ({
  useAuth: vi.fn(() => ({
    session: null,
    user: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

const mockedSendLearnSessionMessage = vi.mocked(sendLearnSessionMessage);

const context: SessionContext = {
  selectedLanguage: { id: 63, name: 'JavaScript', monacoLanguage: 'javascript' },
  currentCode: '',
  recentRunResult: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useLearnSession memoryWritten', () => {
  it('is false on initial render', () => {
    const { result } = renderHook(() => useLearnSession());

    expect(result.current.memoryWritten).toBe(false);
  });

  it('becomes true when the response contains memoryWritten: true', async () => {
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

    expect(result.current.memoryWritten).toBe(true);
  });

  it('stays false when the response omits memoryWritten', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Sure.',
      nextStage: 'teach',
      messageType: 'chat',
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'hello', context });
    });

    expect(result.current.memoryWritten).toBe(false);
  });

  it('resets to false when the next message is sent', async () => {
    mockedSendLearnSessionMessage
      .mockResolvedValueOnce({
        response: 'Got it.',
        nextStage: 'teach',
        messageType: 'chat',
        memoryWritten: true,
      })
      .mockResolvedValueOnce({
        response: 'Next.',
        nextStage: 'practice',
        messageType: 'feedback',
      });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'keep it brief', context });
    });

    expect(result.current.memoryWritten).toBe(true);

    await act(async () => {
      await result.current.sendMessage({ message: 'next question', context });
    });

    expect(result.current.memoryWritten).toBe(false);
  });
});
