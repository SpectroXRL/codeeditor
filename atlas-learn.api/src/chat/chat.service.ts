import { Injectable, Inject } from '@nestjs/common';
import OpenAI from 'openai';
import { ToolResponse } from '../types/chat.types';

const SYSTEM_PROMPT =
  'You are a software engineering instructor. Your role is to teach software engineering concepts clearly and practically. ' +
  'Only respond to questions about software engineering topics such as programming languages, algorithms, data structures, design patterns, ' +
  'software architecture, debugging, testing, and related subjects. ' +
  'If asked about anything outside software engineering, politely decline and redirect the conversation back to software engineering.';

@Injectable()
export class ChatService {
  constructor(@Inject('OPENAI_CLIENT') private readonly openai: OpenAI) {}

  async handleMessage(
    message: string,
    conversationId?: string,
  ): Promise<ToolResponse> {
    const response = await this.openai.responses.create({
      model: 'gpt-4o-mini',
      instructions: SYSTEM_PROMPT,
      input: message,
      ...(conversationId ? { previous_response_id: conversationId } : {}),
    });

    return {
      tool: 'chat',
      content: response.output_text,
      conversationId: response.id,
    };
  }
}
