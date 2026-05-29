import { serverMapper, ServerMapperError } from './server-mapper';
import { ToolResponse } from '../types/chat.types';

describe('serverMapper', () => {
  it('maps a valid chat response to ToolResponse', () => {
    const raw = {
      id: 'resp_abc123',
      output_text:
        '{"tool":"chat","content":"A closure captures its lexical scope."}',
    };

    const result = serverMapper(raw);

    expect(result).toEqual<ToolResponse>({
      tool: 'chat',
      content: 'A closure captures its lexical scope.',
      conversationId: 'resp_abc123',
    });
  });

  it('throws ServerMapperError when conversationId is missing', () => {
    const raw = {
      id: undefined,
      output_text:
        '{"tool":"chat","content":"A closure captures its lexical scope."}',
    };

    expect(() => serverMapper(raw)).toThrow(ServerMapperError);
  });

  it('throws ServerMapperError when tool is missing or not a valid discriminant', () => {
    const raw = {
      id: 'resp_abc123',
      output_text: '{"tool":"quiz","content":"some content"}',
    };

    expect(() => serverMapper(raw)).toThrow(ServerMapperError);
  });

  it('throws ServerMapperError when content is missing', () => {
    const raw = {
      id: 'resp_abc123',
      output_text: '{"tool":"chat"}',
    };

    expect(() => serverMapper(raw)).toThrow(ServerMapperError);
  });
});
