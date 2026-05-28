export type ChatRequest = {
  message: string;
  conversationId?: string;
};

export type ToolResponse =
  | { tool: 'chat'; content: string; conversationId: string }
  | {
      tool: 'code';
      content: string;
      conversationId: string;
      payload: {
        snippets: Array<{ label: string; code: string; language: string }>;
      };
    }
  | {
      tool: 'challenge';
      content: string;
      conversationId: string;
      payload: { task: string; starterCode: string; language: string };
    }
  | {
      tool: 'diagram';
      content: string;
      conversationId: string;
      payload: { mermaid: string };
    };

export type ErrorResponse = {
  error: 'transport' | 'schema' | 'domain';
  message: string;
};
