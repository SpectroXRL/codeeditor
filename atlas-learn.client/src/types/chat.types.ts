export type ToolResponse = {
  tool: 'chat' | 'code' | 'challenge' | 'diagram'
  content: string
  conversationId: string
}

export type ChatRequest = {
  message: string
  conversationId?: string
}

export type ErrorResponse = {
  error: 'transport' | 'schema' | 'domain'
  message: string
}
