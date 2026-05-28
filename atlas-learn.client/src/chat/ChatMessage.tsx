import type { ToolResponse } from '../types/chat.types';

type UserEntry = { role: 'user'; content: string };

type Props = {
  message: UserEntry | ToolResponse;
};

export function ChatMessage({ message }: Props) {
  if ('role' in message) {
    return <p>{message.content}</p>;
  }

  switch (message.tool) {
    case 'chat':
      return <p>{message.content}</p>;

    case 'code':
      // stub — not yet implemented
      return null;

    case 'challenge':
      // stub — not yet implemented
      return null;

    case 'diagram':
      // stub — not yet implemented
      return null;
  }
}
