import { useState } from 'react';
import styles from './ChatInput.module.css';

type Props = {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
};

export function ChatInput({ onSubmit, isLoading }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <div className={styles.wrapper}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Message"
        placeholder="Ask a question…"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={value.trim() === '' || isLoading}
        aria-label="Send"
      >
        Send
      </button>
    </div>
  );
}
