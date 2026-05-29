import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ChatModule } from './chat.module';
import { ToolResponse } from '../types/chat.types';

const mockOpenAiClient = {
  responses: {
    create: jest.fn(),
  },
};

describe('ChatController (POST /chat)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    mockOpenAiClient.responses.create.mockResolvedValue({
      id: 'resp_abc123',
      output_text: 'A closure is a function that captures its lexical scope.',
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ChatModule],
    })
      .overrideProvider('OPENAI_CLIENT')
      .useValue(mockOpenAiClient)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns AI-generated content for a valid message', async () => {
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: 'what is a closure?' })
      .expect(200)
      .expect((res) => {
        const body = res.body as ToolResponse;
        expect(body.tool).toBe('chat');
        expect(body.content).toBe(
          'A closure is a function that captures its lexical scope.',
        );
        expect(body.conversationId).toBeTruthy();
      });
  });

  it('returns the OpenAI response id as conversationId', async () => {
    return request(app.getHttpServer())
      .post('/chat')
      .send({ message: 'what is a closure?' })
      .expect(200)
      .expect((res) => {
        const body = res.body as ToolResponse;
        expect(body.conversationId).toBe('resp_abc123');
      });
  });

  it('forwards conversationId as previous_response_id for multi-turn', async () => {
    await request(app.getHttpServer())
      .post('/chat')
      .send({ message: 'tell me more', conversationId: 'resp_abc123' })
      .expect(200);

    expect(mockOpenAiClient.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({ previous_response_id: 'resp_abc123' }),
    );
  });

  describe('when OPENAI_API_KEY is absent', () => {
    it('throws during module compilation', async () => {
      const original = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await expect(
        Test.createTestingModule({ imports: [ChatModule] }).compile(),
      ).rejects.toThrow('OPENAI_API_KEY');

      process.env.OPENAI_API_KEY = original;
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
