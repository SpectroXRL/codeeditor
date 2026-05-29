import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [
    {
      provide: 'OPENAI_CLIENT',
      useFactory: () => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error(
            'OPENAI_API_KEY environment variable is not set. The application cannot start without it.',
          );
        }
        return new OpenAI({ apiKey });
      },
    },
    ChatService,
  ],
})
export class ChatModule {}
