import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage.tsx';
import type { ToolResponse } from '../types/chat.types';

type UserEntry = { role: 'user'; content: string };

describe('ChatMessage', () => {
  it('renders user entry content', () => {
    const message: UserEntry = { role: 'user', content: 'What is a closure?' };
    render(<ChatMessage message={message} />);
    expect(screen.getByText('What is a closure?')).toBeInTheDocument();
  });

  it('renders chat-tool assistant content', () => {
    const message: ToolResponse = {
      tool: 'chat',
      content: 'A closure captures its surrounding scope.',
      conversationId: 'abc123',
    };
    render(<ChatMessage message={message} />);
    expect(
      screen.getByText('A closure captures its surrounding scope.'),
    ).toBeInTheDocument();
  });

  it('renders no widget below chat-tool content', () => {
    const message: ToolResponse = {
      tool: 'chat',
      content: 'Plain response.',
      conversationId: 'abc123',
    };
    const { container } = render(<ChatMessage message={message} />);
    expect(container.querySelectorAll('[data-widget]')).toHaveLength(0);
  });
});
