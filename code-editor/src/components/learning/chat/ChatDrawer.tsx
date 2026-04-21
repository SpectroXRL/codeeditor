import { useState, useRef, useEffect, useCallback } from "react";
import {
  sendChatMessage,
  type ChatContext,
  type ChatMessage,
} from "../../../services/chatAssistant";
import type { TestResult } from "../challenges/TestCasesPanel";
import "./chat.css";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  lessonInfo: string;
  lessonTitle: string;
  testResults: TestResult[];
  isAuthenticated: boolean;
  canCall: boolean;
  callsUsed: number;
  maxCalls: number;
  resetTime: Date | null;
  onMessageSent: () => void;
}

export function ChatDrawer({
  isOpen,
  onClose,
  code,
  lessonInfo,
  lessonTitle,
  testResults,
  isAuthenticated,
  canCall,
  callsUsed,
  maxCalls,
  resetTime,
  onMessageSent,
}: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset chat when lesson changes
  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [lessonTitle]);

  const handleSendMessage = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading || !canCall) return;

    const userMessage: ChatMessage = { role: "user", content: trimmedInput };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const context: ChatContext = {
        code,
        lessonInfo,
        lessonTitle,
        testResults: testResults.length > 0 ? testResults : undefined,
      };

      const response = await sendChatMessage(newMessages, context);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      onMessageSent();
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  }, [
    input,
    isLoading,
    canCall,
    messages,
    code,
    lessonInfo,
    lessonTitle,
    testResults,
    onMessageSent,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatResetTime = (time: Date) => {
    const minutes = Math.ceil((time.getTime() - Date.now()) / 60000);
    return minutes > 0 ? `${minutes}m` : "soon";
  };

  return (
    <div className="chat-drawer">
      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header__left">
            <span className="chat-header__icon">🤖</span>
            <span className="chat-header__title">AI Assistant</span>
          </div>
          <button
            className="chat-close-btn"
            onClick={onClose}
            title="Close chat"
          >
            ✕
          </button>
        </div>

        {/* Messages Area */}
        <div className="chat-messages">
          {!isAuthenticated ? (
            <div className="chat-auth-prompt">
              <span className="auth-icon">🔒</span>
              <p>Sign in to chat with the AI assistant</p>
              <p className="auth-subtext">
                Get help understanding concepts and debugging your code
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              <span className="empty-icon">👋</span>
              <p>Hi! I'm here to help you learn.</p>
              <p className="empty-subtext">
                Ask me about the lesson, your code, or any programming
                questions.
              </p>
              <div className="chat-suggestions">
                <button
                  onClick={() =>
                    setInput("I'm stuck, can you help me understand this?")
                  }
                >
                  I'm stuck
                </button>
                <button
                  onClick={() =>
                    setInput("Can you explain what I'm doing wrong?")
                  }
                >
                  What's wrong?
                </button>
                <button
                  onClick={() =>
                    setInput("How should I approach this problem?")
                  }
                >
                  How to approach?
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
              {isLoading && (
                <div className="chat-message assistant">
                  <div className="message-content thinking">
                    <span className="thinking-dots">Thinking</span>
                  </div>
                </div>
              )}
              {error && (
                <div className="chat-error">
                  <span>⚠️ {error}</span>
                  <button onClick={handleSendMessage}>Retry</button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        {isAuthenticated && (
          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={canCall ? "Ask a question..." : "Rate limit reached"}
              disabled={!canCall || isLoading}
              rows={2}
            />
            <button
              className="chat-send-btn"
              onClick={handleSendMessage}
              disabled={!input.trim() || !canCall || isLoading}
            >
              {isLoading ? "..." : "→"}
            </button>
          </div>
        )}

        {/* Footer with rate limit */}
        {isAuthenticated && (
          <div className="chat-footer">
            <span className="rate-info">
              {callsUsed}/{maxCalls} messages used
              {!canCall && resetTime && (
                <span className="reset-time">
                  {" "}
                  · Resets in {formatResetTime(resetTime)}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
