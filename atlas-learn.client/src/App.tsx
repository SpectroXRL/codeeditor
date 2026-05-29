import { useState } from 'react'
import { ChatInput } from './chat/ChatInput'
import { ChatMessage } from './chat/ChatMessage'
import type { ToolResponse } from './types/chat.types'

type UserEntry = { role: 'user'; content: string }
type Message = UserEntry | ToolResponse

function App() {
  const [messages, setMessages] = useState<Message[]>([])

  const handleSubmit = (content: string) => {
    const userEntry: UserEntry = { role: 'user', content }
    const assistantReply: ToolResponse = {
      tool: 'chat',
      content: "I'm still learning!",
      conversationId: crypto.randomUUID(),
    }
    setMessages((prev) => [...prev, userEntry, assistantReply])
  }

  const handleNewConversation = () => {
    setMessages([])
  }

  return (
    <div>
      <button type="button" onClick={handleNewConversation}>
        New Conversation
      </button>
      {messages.length > 0 && (
        <ul aria-label="Conversation">
          {messages.map((message, index) => (
            <li key={index}>
              <ChatMessage message={message} />
            </li>
          ))}
        </ul>
      )}
      <ChatInput onSubmit={handleSubmit} />
    </div>
  )
}

export default App
