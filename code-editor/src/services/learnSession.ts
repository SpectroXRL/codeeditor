import type {
  LearnSessionEndResponse,
  LearnSessionEvaluateResponse,
  LearnSessionMessageResponse,
  SessionContext,
  SessionStage,
} from '../types/session';

interface MessageRequest {
  message: string;
  context: SessionContext;
  sessionStage: SessionStage;
}

interface EvaluateRequest {
  originalCode: string;
  currentCode: string;
  studentExplanation?: string;
  context: SessionContext;
}

async function postJson<TResponse>(
  url: string,
  body: object,
  headers?: Record<string, string>,
): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data as TResponse;
}

export function sendLearnSessionMessage(
  payload: MessageRequest,
  token?: string,
): Promise<LearnSessionMessageResponse> {
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  return postJson<LearnSessionMessageResponse>('/api/learn-session/message', payload, authHeaders);
}

export function evaluateLearnSession(
  payload: EvaluateRequest,
): Promise<LearnSessionEvaluateResponse> {
  return postJson<LearnSessionEvaluateResponse>('/api/learn-session/evaluate', payload);
}

interface EndRequest {
  chatHistory: import('../types/session').LearnChatMessage[];
  learningGoal: string;
  struggledWith: Record<string, number>;
  selectedLanguage?: import('../types/session').SessionLanguage;
}

export function endLearnSession(
  payload: EndRequest,
  token: string,
): Promise<LearnSessionEndResponse> {
  return postJson<LearnSessionEndResponse>(
    '/api/learn-session/end',
    payload,
    { Authorization: `Bearer ${token}` },
  );
}
