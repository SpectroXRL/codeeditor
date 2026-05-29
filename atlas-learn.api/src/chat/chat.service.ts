import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import OpenAI, {
  RateLimitError,
  APIConnectionError,
  InternalServerError,
} from 'openai';
import { ToolResponse } from '../types/chat.types';
import { serverMapper, ServerMapperError } from './server-mapper';

const SYSTEM_PROMPT =
  'You are a software engineering instructor. Your role is to teach software engineering concepts clearly and practically. ' +
  'Only respond to questions about software engineering topics such as programming languages, algorithms, data structures, design patterns, ' +
  'software architecture, debugging, testing, and related subjects. ' +
  'Respond exclusively in valid JSON matching this schema: {"tool":"chat","content":"<your response>"} ' +
  'If asked about anything outside software engineering, politely decline via the same JSON structure.';

@Injectable()
export class ChatService {
  constructor(@Inject('OPENAI_CLIENT') private readonly openai: OpenAI) {}

  async handleMessage(
    message: string,
    conversationId?: string,
  ): Promise<ToolResponse> {
    try {
      const response = await this.openai.responses.create({
        model: 'gpt-4o-mini',
        instructions: SYSTEM_PROMPT,
        input: message,
        text: {
          format: {
            type: 'json_schema',
            name: 'tool_response',
            schema: {
              type: 'object',
              properties: {
                tool: {
                  type: 'string',
                  enum: ['chat', 'code', 'challenge', 'diagram'],
                },
                content: { type: 'string' },
              },
              required: ['tool', 'content'],
              additionalProperties: false,
            },
            strict: true,
          },
        },
        ...(conversationId ? { previous_response_id: conversationId } : {}),
      });

      return serverMapper(response);
    } catch (err) {
      if (err instanceof ServerMapperError) {
        throw new HttpException(
          { error: 'schema' },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (
        err instanceof RateLimitError ||
        err instanceof APIConnectionError ||
        err instanceof InternalServerError
      ) {
        throw new HttpException({ error: 'transport' }, HttpStatus.BAD_GATEWAY);
      }
      throw err;
    }
  }
}
