import type { TestResult } from "../components/learning/TestCasesPanel";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  code: string;
  lessonInfo: string;
  lessonTitle: string;
  testResults?: TestResult[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  context: ChatContext;
}

export interface ChatResponse {
  response: string;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  context: ChatContext
): Promise<string> {
  const response = await fetch("/api/chat-assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      context,
    } as ChatRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  const data: ChatResponse = await response.json();
  return data.response;
}
