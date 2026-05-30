import type { ToolResponse } from '../types/chat.types';
import styles from './ChatMessage.module.css';

type UserEntry = { role: 'user'; content: string };

type Props = {
  message: UserEntry | ToolResponse;
};

export function ChatMessage({ message }: Props) {
  if ('role' in message) {
    return <p className={styles.userMessage}>{message.content}</p>;
  }

  switch (message.tool) {
    case 'chat':
      return <p className={styles.assistantMessage}>{message.content}</p>;

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
