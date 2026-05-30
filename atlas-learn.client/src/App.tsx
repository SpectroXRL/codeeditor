import { ChatInput } from './chat/ChatInput';
import { ChatMessage } from './chat/ChatMessage';
import { useChatState } from './chat/useChatState';
import { postChat } from './api/chat';
import styles from './App.module.css';

function App() {
  const { displayList, isLoading, error, send, reset } = useChatState(postChat);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button
          type="button"
          onClick={reset}
          className={styles.newConversationBtn}
        >
          New Conversation
        </button>
      </header>
      <main className={styles.main}>
        {displayList.length === 0 ? (
          <div className={styles.welcome}>
            <h1>Atlas Learn</h1>
            <p>Ask a question to get started.</p>
          </div>
        ) : (
          <ul aria-label="Conversation" className={styles.messages}>
            {displayList.map((message, index) => (
              <li key={index}>
                <ChatMessage message={message} />
              </li>
            ))}
          </ul>
        )}
      </main>
      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}
      <footer className={styles.footer}>
        <ChatInput onSubmit={send} isLoading={isLoading} />
      </footer>
    </div>
  );
}

export default App;
