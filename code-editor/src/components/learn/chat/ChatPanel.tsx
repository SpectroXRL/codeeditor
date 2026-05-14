import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { FollowUpBubbles } from "./FollowUpBubbles";
import { SuggestedPrompts } from "./SuggestedPrompts";
import type { LearnChatMessage, SessionStage } from "../../../types/session";
import "./chat.css";

const FOLLOW_UP_STAGES: SessionStage[] = [
  "teach",
  "practice",
  "check_in",
  "challenge",
];

interface ChatPanelProps {
  messages: LearnChatMessage[];
  sessionStage: SessionStage;
  inputValue: string;
  isSending: boolean;
  isEvaluating: boolean;
  error: string | null;
  suggestedPrompts: string[];
  followUps: string[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  onUsePrompt: (prompt: string) => void;
  onSelectFollowUp: (prompt: string) => void;
  onReset: () => void;
}

export function ChatPanel({
  messages,
  sessionStage,
  inputValue,
  isSending,
  isEvaluating,
  error,
  suggestedPrompts,
  followUps,
  onInputChange,
  onSend,
  onUsePrompt,
  onSelectFollowUp,
  onReset,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasLinkInInput = /https:\/\/\S+/i.test(inputValue);

  return (
    <section className="learn-chat-panel">
      <header className="learn-chat-panel__header">
        <button
          type="button"
          className="learn-chat-panel__reset-btn"
          onClick={onReset}
          aria-label="Reset"
          title="Reset"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </header>

      <div className="learn-chat-panel__messages">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>

      {FOLLOW_UP_STAGES.includes(sessionStage) && (
        <FollowUpBubbles followUps={followUps} onSelect={onSelectFollowUp} />
      )}

      {sessionStage === "idle" && (
        <SuggestedPrompts prompts={suggestedPrompts} onSelect={onUsePrompt} />
      )}

      {error && <p className="learn-chat-panel__error">{error}</p>}

      <div className="learn-chat-panel__composer">
        <textarea
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask a coding-learning question..."
          rows={3}
          disabled={isSending || isEvaluating}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!inputValue.trim() || isSending || isEvaluating}
          aria-label={
            isSending ? "Sending" : isEvaluating ? "Evaluating" : "Send"
          }
          className="learn-chat-panel__send-btn"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M8 14V2M8 2L3 7M8 2L13 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {hasLinkInInput && (
        <p className="learn-chat-panel__link-hint">
          Link detected. Learn Agent will try to read it for context.
        </p>
      )}

      {(isSending || isEvaluating) && (
        <span className="learn-chat-panel__stage-status">
          Stage: {sessionStage}
        </span>
      )}
    </section>
  );
}
