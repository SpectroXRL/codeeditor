import { Injectable } from '@nestjs/common';
import { ToolResponse } from '../types/chat.types';

@Injectable()
export class ChatService {
  handleMessage(message: string, conversationId?: string): ToolResponse {
    return {
      tool: 'chat',
      content: 'This is a stub response.',
      conversationId: conversationId ?? 'stub-conversation-id',
    };
  }
}
