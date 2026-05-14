import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useLearnSession } from '../useLearnSession';
import { sendLearnSessionMessage } from '../../../services/learnSession';
import type { SessionContext } from '../../../types/session';

vi.mock('../../../services/learnSession', () => ({
  sendLearnSessionMessage: vi.fn(),
  evaluateLearnSession: vi.fn(),
}));

vi.mock('../../../context/useAuth', () => ({
  useAuth: vi.fn(() => ({ session: null, user: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));

const mockedSendLearnSessionMessage = vi.mocked(sendLearnSessionMessage);

const context: SessionContext = {
  selectedLanguage: {
    id: 63,
    name: 'JavaScript',
    monacoLanguage: 'javascript',
  },
  currentCode: 'console.log("hi")',
  recentRunResult: null,
};

describe('useLearnSession followUps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with no follow-ups', () => {
    const { result } = renderHook(() => useLearnSession());

    expect(result.current.followUps).toEqual([]);
  });

  it('sets follow-ups from API response after sendMessage', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Try these next.',
      nextStage: 'practice',
      messageType: 'feedback',
      followUps: [
        'What edge case should I try?',
        'How can I simplify this?',
        'Can we compare two approaches?',
      ],
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({
        message: 'Help me with loops',
        context,
      });
    });

    expect(result.current.followUps).toEqual([
      'What edge case should I try?',
      'How can I simplify this?',
      'Can we compare two approaches?',
    ]);
  });

  it('keeps follow-ups empty when API does not provide them', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'Let us continue.',
      nextStage: 'practice',
      messageType: 'feedback',
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({
        message: 'next step',
        context,
      });
    });

    expect(result.current.followUps).toEqual([]);
  });

  it('clears previous follow-ups immediately when a new user message is sent', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'first response',
      nextStage: 'practice',
      messageType: 'feedback',
      followUps: [
        'What if the array is empty?',
        'How do I test odd numbers?',
        'Could this use map instead?',
      ],
    });

    let resolveSecondCall: ((value: Awaited<ReturnType<typeof sendLearnSessionMessage>>) => void) | undefined;
    const secondCallPromise = new Promise<Awaited<ReturnType<typeof sendLearnSessionMessage>>>((resolve) => {
      resolveSecondCall = resolve;
    });

    mockedSendLearnSessionMessage.mockReturnValueOnce(secondCallPromise);

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({
        message: 'first',
        context,
      });
    });

    expect(result.current.followUps).toEqual([
      'What if the array is empty?',
      'How do I test odd numbers?',
      'Could this use map instead?',
    ]);

    act(() => {
      void result.current.sendMessage({
        message: 'second',
        context,
      });
    });

    expect(result.current.followUps).toEqual([]);

    act(() => {
      resolveSecondCall?.({
        response: 'second response',
        nextStage: 'practice',
        messageType: 'feedback',
        followUps: ['A', 'B', 'C'],
      });
    });

    await waitFor(() => {
      expect(result.current.followUps).toEqual(['A', 'B', 'C']);
    });
  });

  it('clears follow-ups when resetSession is called', async () => {
    mockedSendLearnSessionMessage.mockResolvedValueOnce({
      response: 'first response',
      nextStage: 'practice',
      messageType: 'feedback',
      followUps: ['A', 'B', 'C'],
    });

    const { result } = renderHook(() => useLearnSession());

    await act(async () => {
      await result.current.sendMessage({
        message: 'first',
        context,
      });
    });

    expect(result.current.followUps).toEqual(['A', 'B', 'C']);

    act(() => {
      result.current.resetSession();
    });

    expect(result.current.followUps).toEqual([]);
  });
});
