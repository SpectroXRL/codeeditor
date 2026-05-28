import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './chat-request.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(200)
  handleMessage(@Body() body: ChatRequestDto) {
    return this.chatService.handleMessage(body.message, body.conversationId);
  }
}
