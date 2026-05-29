import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

vi.mock('../api/chat', () => ({
  postChat: vi.fn(() =>
    Promise.resolve({ tool: 'chat', content: 'reply', conversationId: 'c1' }),
  ),
}))

describe('App conversation list', () => {
  it('appends a user entry to the list on submit', async () => {
    render(<App />)
    await userEvent.type(screen.getByRole('textbox'), 'What is a closure?')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(screen.getByText('What is a closure?')).toBeInTheDocument()
  })

  it('appends an assistant reply after each user entry', async () => {
    render(<App />)
    await userEvent.type(screen.getByRole('textbox'), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    const list = screen.getByRole('list', { name: /conversation/i })
    await waitFor(() =>
      expect(within(list).getAllByRole('listitem')).toHaveLength(2),
    )
  })

  it('clears the conversation list when "New Conversation" is clicked', async () => {
    render(<App />)
    await userEvent.type(screen.getByRole('textbox'), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => screen.getByRole('list', { name: /conversation/i }))
    await userEvent.click(screen.getByRole('button', { name: /new conversation/i }))
    expect(screen.queryByRole('list', { name: /conversation/i })).not.toBeInTheDocument()
  })
})
