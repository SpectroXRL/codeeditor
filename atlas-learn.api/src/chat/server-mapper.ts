import { ToolResponse } from '../types/chat.types';

export interface RawOpenAIResponse {
  id?: string | null;
  output_text?: string | null;
}

export class ServerMapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerMapperError';
  }
}

export function serverMapper(raw: RawOpenAIResponse): ToolResponse {
  if (!raw.id) {
    throw new ServerMapperError('Missing conversationId');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.output_text ?? '');
  } catch {
    throw new ServerMapperError('output_text is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ServerMapperError('output_text must be a JSON object');
  }

  const obj = parsed as Record<string, unknown>;
  const validTools = ['chat', 'code', 'challenge', 'diagram'];

  if (typeof obj['tool'] !== 'string' || !validTools.includes(obj['tool'])) {
    throw new ServerMapperError(
      `Invalid or missing tool: ${String(obj['tool'])}`,
    );
  }

  if (typeof obj['content'] !== 'string' || obj['content'].length === 0) {
    throw new ServerMapperError('Missing or empty content');
  }

  const tool = obj['tool'] as 'chat' | 'code' | 'challenge' | 'diagram';
  const content = obj['content'];
  const conversationId = raw.id;

  if (tool === 'chat') {
    return { tool: 'chat', content, conversationId };
  }

  return {
    tool,
    content,
    conversationId,
    payload: obj['payload'],
  } as ToolResponse;
}
