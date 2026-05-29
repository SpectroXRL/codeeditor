import { renderHook, act } from '@testing-library/react'
import { useChatState } from './useChatState'
import type { ToolResponse, ErrorResponse } from '../types/chat.types'

function makeResponse(overrides?: Partial<ToolResponse>): ToolResponse {
  return { tool: 'chat', content: 'ok', conversationId: 'conv-1', ...overrides }
}

function makeErrorResponse(overrides?: Partial<ErrorResponse>): ErrorResponse {
  return { error: 'transport', message: 'Network error', ...overrides }
}

function pendingFetch(): [Promise<ToolResponse>, (v: ToolResponse) => void] {
  let resolve!: (v: ToolResponse) => void
  const promise = new Promise<ToolResponse>((res) => { resolve = res })
  return [promise, resolve]
}

describe('useChatState', () => {
  it('starts with empty displayList, null conversationId, not loading, no error', () => {
    const { result } = renderHook(() => useChatState())

    expect(result.current.displayList).toEqual([])
    expect(result.current.conversationId).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('appends the user entry to displayList immediately when send() is called', async () => {
    const postChat = vi.fn(() => new Promise<ToolResponse>(() => {}))
    const { result } = renderHook(() => useChatState(postChat))

    act(() => { result.current.send('What is a closure?') })

    expect(result.current.displayList).toEqual([
      { role: 'user', content: 'What is a closure?' },
    ])
  })

  it('sets isLoading true while fetch is in-flight and false after it resolves', async () => {
    const [promise, resolve] = pendingFetch()
    const postChat = vi.fn(() => promise)
    const { result } = renderHook(() => useChatState(postChat))

    act(() => { result.current.send('hello') })
    expect(result.current.isLoading).toBe(true)

    await act(async () => { resolve(makeResponse()) })
    expect(result.current.isLoading).toBe(false)
  })

  it('appends the ToolResponse to displayList and updates conversationId on success', async () => {
    const response = makeResponse({ conversationId: 'conv-42' })
    const postChat = vi.fn(() => Promise.resolve(response))
    const { result } = renderHook(() => useChatState(postChat))

    await act(async () => { await result.current.send('hello') })

    expect(result.current.displayList).toEqual([
      { role: 'user', content: 'hello' },
      response,
    ])
    expect(result.current.conversationId).toBe('conv-42')
  })

  it('sets error on failure, keeps user entry in displayList, isLoading false', async () => {
    const errResponse = makeErrorResponse()
    const postChat = vi.fn(() => Promise.reject(errResponse))
    const { result } = renderHook(() => useChatState(postChat))

    await act(async () => { await result.current.send('hello') })

    expect(result.current.error).toEqual(errResponse)
    expect(result.current.displayList).toEqual([{ role: 'user', content: 'hello' }])
    expect(result.current.isLoading).toBe(false)
  })

  it('reset() clears displayList, conversationId, and error', async () => {
    const response = makeResponse({ conversationId: 'conv-1' })
    const postChat = vi.fn()
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(makeErrorResponse())
    const { result } = renderHook(() => useChatState(postChat))

    await act(async () => { await result.current.send('first') })
    await act(async () => { await result.current.send('second') })
    expect(result.current.displayList).toHaveLength(3) // user, assistant, user
    expect(result.current.conversationId).toBe('conv-1')
    expect(result.current.error).not.toBeNull()

    act(() => { result.current.reset() })

    expect(result.current.displayList).toEqual([])
    expect(result.current.conversationId).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
