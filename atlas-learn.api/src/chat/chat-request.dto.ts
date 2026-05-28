import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'message must not be blank' })
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
