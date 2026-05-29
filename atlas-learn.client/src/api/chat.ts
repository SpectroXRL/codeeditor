import type { ChatRequest, ToolResponse, ErrorResponse } from '../types/chat.types'

export async function postChat(request: ChatRequest): Promise<ToolResponse> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  const body = await res.json()

  if (!res.ok) {
    throw body as ErrorResponse
  }

  return body as ToolResponse
}
