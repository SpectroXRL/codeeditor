export interface Language {
  id: number;
  name: string;
  monacoLanguage: string;
  template: string;
}

export interface SubmissionResult {
  token: string;
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

export interface SubmissionResponse {
  token: string;
}

export const LANGUAGES: Language[] = [
  {
    id: 93,
    name: 'JavaScript',
    monacoLanguage: 'javascript',
    template: `function main() {
  const message = "Hello, World!";
  console.log(message);
}

main();`,
  },
  {
    id: 62,
    name: 'Java',
    monacoLanguage: 'java',
    template: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
  },
  {
    id: 74,
    name: 'TypeScript',
    monacoLanguage: 'typescript',
    template: `const greeting: string = "Hello, World!";
console.log(greeting);`,
  },
  {
    id: 81,
    name: 'Scala',
    monacoLanguage: 'scala',
    template: `object Main extends App {
  println("Hello, World!")
}`,
  },
];

// Judge0 status codes
export const STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 7,
  RUNTIME_ERROR_SIGXFSZ: 8,
  RUNTIME_ERROR_SIGFPE: 9,
  RUNTIME_ERROR_SIGABRT: 10,
  RUNTIME_ERROR_NZEC: 11,
  RUNTIME_ERROR_OTHER: 12,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,
};

// AI Tutor Types
export type { AssistanceTier } from './database';

// Agentic Engineering Types
export type {
  ChallengeMode,
  PromptTechnique,
  AgenticChallenge,
  PromptTurn,
  AgenticAttempt,
  PromptScores,
  ApiPromptScores,
  PromptHeuristics,
  ApiHeuristicsData,
  PromptValidationLog,
  PromptRubric,
} from './database';

export { DEFAULT_PROMPT_RUBRIC, PROMPT_TECHNIQUES } from './database';

// Type transformation utilities
export {
  toApiPromptScores,
  toDbPromptScores,
  toApiHeuristics,
  toDbHeuristics,
} from './transforms';

export interface DetectedIssue {
  type: 'syntax' | 'logic' | 'incomplete' | 'style';
  severity: 'info' | 'warning';
  message: string;
  line?: number;
  suggestedTier: import('./database').AssistanceTier;
}

export interface TutorResponse {
  response: string;
  tier: import('./database').AssistanceTier;
  followUpAvailable: boolean;
}

export type {
  SessionStage,
  LearnMessageType,
  SessionContext,
  LearnChatMessage,
  LearnSessionState,
  LearnSessionMessageResponse,
  LearnSessionEvaluateResponse,
} from './session';
