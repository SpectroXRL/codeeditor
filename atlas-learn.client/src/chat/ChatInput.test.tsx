import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './ChatInput.tsx';

describe('ChatInput', () => {
  it('disables the send button when the input is empty', () => {
    render(<ChatInput onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('enables the send button when the input has non-whitespace content', async () => {
    render(<ChatInput onSubmit={() => {}} />);
    await userEvent.type(screen.getByRole('textbox'), 'hello');
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  it('calls onSubmit with trimmed value and clears the field', async () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '  hello world  ');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSubmit).toHaveBeenCalledWith('hello world');
    expect(input).toHaveValue('');
  });
});
