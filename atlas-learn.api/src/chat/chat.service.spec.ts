import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import {
  RateLimitError,
  APIConnectionError,
  APIConnectionTimeoutError,
  InternalServerError,
} from 'openai';
import { ChatService } from './chat.service';

describe('ChatService error classification', () => {
  let service: ChatService;
  const mockCreate = jest.fn();

  beforeEach(async () => {
    mockCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: 'OPENAI_CLIENT',
          useValue: { responses: { create: mockCreate } },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it.each([
    [
      'RateLimitError',
      new RateLimitError(429, undefined, 'rate limit', new Headers()),
    ],
    [
      'APIConnectionError',
      new APIConnectionError({ message: 'connection failed' }),
    ],
    ['APIConnectionTimeoutError', new APIConnectionTimeoutError()],
    [
      'InternalServerError',
      new InternalServerError(500, undefined, 'internal error', new Headers()),
    ],
  ])('maps %s to HTTP 502 with error: transport', async (_name, sdkError) => {
    mockCreate.mockRejectedValue(sdkError);

    const thrown = await service
      .handleMessage('hello')
      .catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(502);
    expect((thrown as HttpException).getResponse()).toEqual({
      error: 'transport',
    });
  });

  it('maps ServerMapperError to HTTP 422 with error: schema', async () => {
    mockCreate.mockResolvedValue({
      id: 'resp_123',
      output_text: '{"tool":"unknown","content":"x"}',
    });

    const thrown = await service
      .handleMessage('hello')
      .catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(422);
    expect((thrown as HttpException).getResponse()).toEqual({
      error: 'schema',
    });
  });
});
