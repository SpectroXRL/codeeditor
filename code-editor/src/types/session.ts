export type SessionStage =
  | 'idle'
  | 'clarify'
  | 'teach'
  | 'practice'
  | 'reflect'
  | 'challenge';

export type LearnMessageType =
  | 'chat'
  | 'clarifying_question'
  | 'starter_code'
  | 'feedback'
  | 'evaluation'
  | 'challenge'
  | 'refusal';

export interface SessionLanguage {
  id: number;
  name: string;
  monacoLanguage: string;
}

export interface SessionRunResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
}

export interface SessionContext {
  selectedLanguage: SessionLanguage;
  currentCode: string;
  recentRunResult?: SessionRunResult | null;
  lastAgentGoal?: string;
  sessionIntent?: string;
}

export interface LearnChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  messageType: LearnMessageType;
  starterCode?: string;
  timestamp: string;
}

export interface LearnSessionState {
  selectedLanguage: SessionLanguage;
  currentCode: string;
  runResult: SessionRunResult | null;
  chatHistory: LearnChatMessage[];
  learningGoal: string;
  sessionStage: SessionStage;
}

export interface LearnSessionMessageResponse {
  response: string;
  starterCode?: string;
  nextStage: SessionStage;
  messageType: LearnMessageType;
  learningGoal?: string;
}

export interface LearnSessionEvaluateResponse {
  understood: boolean;
  feedback: string;
  suggestChallenge: boolean;
  challengePrompt?: string;
  nextStage: SessionStage;
}
