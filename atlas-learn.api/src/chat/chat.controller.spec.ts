import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ChatModule } from './chat.module';
import { ToolResponse } from '../types/chat.types';

describe('ChatController (POST /chat)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ChatModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with a chat ToolResponse for a valid message', async () => {
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: 'what is a closure?' })
      .expect(200)
      .expect((res) => {
        const body = res.body as ToolResponse;
        expect(body.tool).toBe('chat');
        expect(body.content).toBeTruthy();
        expect(body.conversationId).toBeTruthy();
      });
  });

  it('returns 400 when message is an empty string', async () => {
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: '' })
      .expect(400);
  });

  it('returns 400 when message is whitespace only', async () => {
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: '   ' })
      .expect(400);
  });

  it('returns 400 when message field is absent', async () => {
    return request(app.getHttpServer()).post('/chat').send({}).expect(400);
  });
});
