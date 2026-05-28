import { ChatRequest, ToolResponse, ErrorResponse } from './chat.types';

describe('ChatRequest', () => {
  it('accepts a message-only request', () => {
    const req: ChatRequest = { message: 'hello' };
    expect(req.message).toBe('hello');
    expect(req.conversationId).toBeUndefined();
  });
});

describe('ToolResponse — chat variant', () => {
  it('holds content and conversationId with no payload', () => {
    const res: ToolResponse = { tool: 'chat', content: 'hi', conversationId: 'abc' };
    expect(res.tool).toBe('chat');
    if (res.tool === 'chat') {
      expect(res.content).toBe('hi');
      expect(res.conversationId).toBe('abc');
      expect('payload' in res).toBe(false);
    }
  });
});

describe('ToolResponse — scaffolded variants', () => {
  it('code variant is assignable with payload.snippets', () => {
    const res: ToolResponse = {
      tool: 'code',
      content: 'here is some code',
      conversationId: 'abc',
      payload: { snippets: [{ label: 'Ex', code: 'const x = 1', language: 'typescript' }] },
    };
    expect(res.tool).toBe('code');
  });

  it('challenge variant is assignable with payload task fields', () => {
    const res: ToolResponse = {
      tool: 'challenge',
      content: 'try this',
      conversationId: 'abc',
      payload: { task: 'write a loop', starterCode: 'for (', language: 'javascript' },
    };
    expect(res.tool).toBe('challenge');
  });

  it('diagram variant is assignable with payload.mermaid', () => {
    const res: ToolResponse = {
      tool: 'diagram',
      content: 'here is a diagram',
      conversationId: 'abc',
      payload: { mermaid: 'graph TD; A-->B' },
    };
    expect(res.tool).toBe('diagram');
  });
});

describe('ErrorResponse', () => {
  it('accepts each of the three error kinds', () => {
    const t: ErrorResponse = { error: 'transport', message: 'network failure' };
    const s: ErrorResponse = { error: 'schema', message: 'bad shape' };
    const d: ErrorResponse = { error: 'domain', message: 'business rule violated' };
    expect(t.error).toBe('transport');
    expect(s.error).toBe('schema');
    expect(d.error).toBe('domain');
  });

  it('rejects an unlisted error kind', () => {
    // @ts-expect-error — "unknown" is not assignable to "transport" | "schema" | "domain"
    const bad: ErrorResponse = { error: 'unknown', message: 'oops' };
    expect(bad).toBeDefined(); // unreachable at compile time; silences unused-var warning
  });
});
