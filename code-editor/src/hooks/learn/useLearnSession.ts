import { useCallback, useMemo, useState } from 'react';
import {
  evaluateLearnSession,
  sendLearnSessionMessage,
} from '../../services/learnSession';
import { useAuth } from '../../context/useAuth';
import type {
  LearnChatMessage,
  SessionContext,
  SessionStage,
} from '../../types/session';

interface UseLearnSessionOptions {
  onStarterCode?: (code: string) => void;
}

interface SendMessageArgs {
  message: string;
  context: SessionContext;
}

interface EvaluateArgs {
  context: SessionContext;
  currentCode: string;
  studentExplanation?: string;
}

function createMessage(
  role: LearnChatMessage['role'],
  content: string,
  messageType: LearnChatMessage['messageType'],
  starterCode?: string,
): LearnChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role,
    content,
    messageType,
    starterCode,
    timestamp: new Date().toISOString(),
  };
}

const INITIAL_AGENT_MESSAGE = createMessage(
  'agent',
  'Tell me what you want to learn, and I will guide you with code you can modify and run.',
  'chat',
);

export function useLearnSession(options: UseLearnSessionOptions = {}) {
  const { session } = useAuth();
  const [chatHistory, setChatHistory] = useState<LearnChatMessage[]>([
    INITIAL_AGENT_MESSAGE,
  ]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [sessionStage, setSessionStage] = useState<SessionStage>('idle');
  const [learningGoal, setLearningGoal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryWritten, setMemoryWritten] = useState(false);
  const [starterBaselineCode, setStarterBaselineCode] = useState<string>('');
  const [struggledWith, setStruggledWith] = useState<Record<string, number>>({});

  const appendAgentMessage = useCallback(
    (
      content: string,
      messageType: LearnChatMessage['messageType'],
      starterCode?: string,
    ) => {
      setChatHistory((prev) => [
        ...prev,
        createMessage('agent', content, messageType, starterCode),
      ]);
    },
    [],
  );

  const appendUserMessage = useCallback((content: string) => {
    setChatHistory((prev) => [...prev, createMessage('user', content, 'chat')]);
  }, []);

  const sendMessage = useCallback(
    async ({ message, context }: SendMessageArgs) => {
      const trimmed = message.trim();
      if (!trimmed || isSending) {
        return;
      }

      setError(null);
      setFollowUps([]);
      setMemoryWritten(false);
      appendUserMessage(trimmed);
      setIsSending(true);

      try {
        const response = await sendLearnSessionMessage(
          {
            message: trimmed,
            context,
            sessionStage,
          },
          session?.access_token ?? undefined,
        );

        appendAgentMessage(response.response, response.messageType, response.starterCode);
        setFollowUps(response.followUps ?? []);
        setMemoryWritten(response.memoryWritten === true);

        if (
          sessionStage === 'check_in' &&
          (response.nextStage === 'teach' || response.nextStage === 'practice')
        ) {
          const key = learningGoal || trimmed;
          setStruggledWith((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
        }

        setSessionStage(response.nextStage);

        if (response.learningGoal) {
          setLearningGoal(response.learningGoal);
        } else if (!learningGoal) {
          setLearningGoal(trimmed);
        }

        if (response.starterCode) {
          setStarterBaselineCode(response.starterCode);
          options.onStarterCode?.(response.starterCode);
        }
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : 'Failed to send message';
        setError(messageText);
        appendAgentMessage(
          'I ran into an error while processing that. Please try again.',
          'chat',
        );
      } finally {
        setIsSending(false);
      }
    },
    [
      appendAgentMessage,
      appendUserMessage,
      isSending,
      learningGoal,
      options,
      session,
      sessionStage,
      struggledWith,
    ],
  );

  const triggerEvaluate = useCallback(
    async ({ context, currentCode, studentExplanation }: EvaluateArgs) => {
      if (isEvaluating) {
        return;
      }

      const explanation = studentExplanation?.trim();
      if (explanation) {
        appendUserMessage(explanation);
      }

      setFollowUps([]);
      setIsEvaluating(true);
      setError(null);

      try {
        const response = await evaluateLearnSession({
          originalCode: starterBaselineCode || context.currentCode,
          currentCode,
          studentExplanation: explanation,
          context,
        });

        appendAgentMessage(response.feedback, 'evaluation');

        if (response.challengePrompt) {
          appendAgentMessage(response.challengePrompt, 'challenge');
        }

        setSessionStage(response.nextStage);
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : 'Failed to evaluate understanding';
        setError(messageText);
        appendAgentMessage(
          'I could not evaluate this turn. Please try again.',
          'chat',
        );
      } finally {
        setIsEvaluating(false);
      }
    },
    [
      appendAgentMessage,
      appendUserMessage,
      isEvaluating,
      starterBaselineCode,
    ],
  );

  const resetSession = useCallback(() => {
    setChatHistory([INITIAL_AGENT_MESSAGE]);
    setFollowUps([]);
    setSessionStage('idle');
    setLearningGoal('');
    setStarterBaselineCode('');
    setError(null);
    setStruggledWith({});
  }, []);

  const totalUserMessages = useMemo(
    () => chatHistory.filter((message) => message.role === 'user').length,
    [chatHistory],
  );

  return {
    chatHistory,
    followUps,
    sessionStage,
    learningGoal,
    struggledWith,
    totalUserMessages,
    isSending,
    isEvaluating,
    error,
    memoryWritten,
    sendMessage,
    triggerEvaluate,
    resetSession,
  };
}
