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
  currentCode: 'console.log("hi")',
  recentRunResult: null,
};

describe('useLearnSession struggledWith', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty struggledWith', () => {
    const { result } = renderHook(() => useLearnSession());

    expect(result.current.struggledWith).toEqual({});
  });

  it('increments when stage transitions from check_in to teach', async () => {
    // First get into check_in stage
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Can you explain what you learned?',
      nextStage: 'check_in',
      messageType: 'chat',
      learningGoal: 'closures',
    });
    // Then transition back to teach (struggled)
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Let me re-explain.',
      nextStage: 'teach',
      messageType: 'chat',
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'teach me closures', context });
    });

    await act(async () => {
      await result.current.sendMessage({ message: 'I am confused', context });
    });

    expect(result.current.struggledWith).toEqual({ closures: 1 });
  });

  it('increments when stage transitions from check_in to practice', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Let us check in.',
      nextStage: 'check_in',
      messageType: 'chat',
      learningGoal: 'promises',
    });
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Try again.',
      nextStage: 'practice',
      messageType: 'chat',
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'teach me promises', context });
    });
    await act(async () => {
      await result.current.sendMessage({ message: 'not sure', context });
    });

    expect(result.current.struggledWith).toEqual({ promises: 1 });
  });

  it('does not increment on teach to practice transition', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Here is the lesson.',
      nextStage: 'teach',
      messageType: 'chat',
      learningGoal: 'closures',
    });
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Now practice.',
      nextStage: 'practice',
      messageType: 'chat',
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'teach me closures', context });
    });
    await act(async () => {
      await result.current.sendMessage({ message: 'got it', context });
    });

    expect(result.current.struggledWith).toEqual({});
  });

  it('accumulates across multiple check_in struggles on the same goal', async () => {
    // cycle 1: teach → check_in → teach (struggled once)
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Lesson.',
      nextStage: 'teach',
      messageType: 'chat',
      learningGoal: 'closures',
    });
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Check in.',
      nextStage: 'check_in',
      messageType: 'chat',
    });
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Re-teaching.',
      nextStage: 'teach',
      messageType: 'chat',
    });
    // cycle 2: check_in → teach (struggled again)
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Check in again.',
      nextStage: 'check_in',
      messageType: 'chat',
    });
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Re-teaching again.',
      nextStage: 'teach',
      messageType: 'chat',
    });

    const { result } = renderHook(() => useLearnSession());

    for (const msg of ['start', 'check in', 'confused', 'check in 2', 'still confused']) {
      await act(async () => {
        await result.current.sendMessage({ message: msg, context });
      });
    }

    expect(result.current.struggledWith).toEqual({ closures: 2 });
  });

  it('uses learningGoal as the key, tracking different goals separately', async () => {
    // struggle on 'closures'
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Check in on closures.',
      nextStage: 'check_in',
      messageType: 'chat',
      learningGoal: 'closures',
    });
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Re-teach closures.',
      nextStage: 'teach',
      messageType: 'chat',
    });
    // struggle on 'promises'
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Check in on promises.',
      nextStage: 'check_in',
      messageType: 'chat',
      learningGoal: 'promises',
    });
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Re-teach promises.',
      nextStage: 'teach',
      messageType: 'chat',
    });

    const { result } = renderHook(() => useLearnSession());

    for (const msg of ['closures q', 'confused', 'promises q', 'confused again']) {
      await act(async () => {
        await result.current.sendMessage({ message: msg, context });
      });
    }

    expect(result.current.struggledWith).toEqual({ closures: 1, promises: 1 });
  });

  it('resets struggledWith to {} when resetSession is called', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Check in.',
      nextStage: 'check_in',
      messageType: 'chat',
      learningGoal: 'closures',
    });
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Re-teaching.',
      nextStage: 'teach',
      messageType: 'chat',
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({ message: 'teach me', context });
    });
    await act(async () => {
      await result.current.sendMessage({ message: 'confused', context });
    });

    expect(result.current.struggledWith).toEqual({ closures: 1 });

    act(() => {
      result.current.resetSession();
    });

    expect(result.current.struggledWith).toEqual({});
  });
});
