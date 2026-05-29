import { useState } from 'react'
import type { ToolResponse, ErrorResponse, ChatRequest } from '../types/chat.types'

type UserEntry = { role: 'user'; content: string }
type PostChat = (request: ChatRequest) => Promise<ToolResponse>

export function useChatState(postChat?: PostChat) {
  const [displayList, setDisplayList] = useState<Array<UserEntry | ToolResponse>>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ErrorResponse | null>(null)

  async function send(message: string) {
    setDisplayList((prev) => [...prev, { role: 'user' as const, content: message }])
    if (!postChat) return
    setIsLoading(true)
    try {
      const response = await postChat({ message, conversationId: conversationId ?? undefined })
      setDisplayList((prev) => [...prev, response])
      setConversationId(response.conversationId)
    } catch (err) {
      setError(err as ErrorResponse)
    } finally {
      setIsLoading(false)
    }
  }

  function reset() {
    setDisplayList([])
    setConversationId(null)
    setError(null)
  }

  return { displayList, conversationId, isLoading, error, send, reset }
}
