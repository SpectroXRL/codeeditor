import { ChatInput } from './chat/ChatInput'
import { ChatMessage } from './chat/ChatMessage'
import { useChatState } from './chat/useChatState'
import { postChat } from './api/chat'

function App() {
  const { displayList, isLoading, error, send, reset } = useChatState(postChat)

  return (
    <div>
      <button type="button" onClick={reset}>
        New Conversation
      </button>
      {displayList.length > 0 && (
        <ul aria-label="Conversation">
          {displayList.map((message, index) => (
            <li key={index}>
              <ChatMessage message={message} />
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert">{error.message}</p>}
      <ChatInput onSubmit={send} isLoading={isLoading} />
    </div>
  )
}

export default App
