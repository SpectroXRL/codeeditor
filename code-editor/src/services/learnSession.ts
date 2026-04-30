import type {
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
): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
): Promise<LearnSessionMessageResponse> {
  return postJson<LearnSessionMessageResponse>('/api/learn-session/message', payload);
}

export function evaluateLearnSession(
  payload: EvaluateRequest,
): Promise<LearnSessionEvaluateResponse> {
  return postJson<LearnSessionEvaluateResponse>('/api/learn-session/evaluate', payload);
}
