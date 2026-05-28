import { useState } from 'react'

type Props = {
  onSubmit: (message: string) => void
}

export function ChatInput({ onSubmit }: Props) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
  }

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Message"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={value.trim() === ''}
        aria-label="Send"
      >
        Send
      </button>
    </div>
  )
}
