import { MessageBubble } from "./MessageBubble";
import { SuggestedPrompts } from "./SuggestedPrompts";
import type { LearnChatMessage, SessionStage } from "../../../types/session";
import "./chat.css";

interface ChatPanelProps {
  messages: LearnChatMessage[];
  sessionStage: SessionStage;
  learningGoal: string;
  inputValue: string;
  isSending: boolean;
  isEvaluating: boolean;
  error: string | null;
  suggestedPrompts: string[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  onUsePrompt: (prompt: string) => void;
  onEnterReflectMode: () => void;
}

function getStageHint(stage: SessionStage): string {
  switch (stage) {
    case "idle":
      return "Describe what you want to learn in code.";
    case "clarify":
      return "Answer the clarifying question so we can generate focused starter code.";
    case "teach":
      return "Read the explanation, then modify and run the starter code.";
    case "practice":
      return "Keep iterating on your code and ask for targeted guidance.";
    case "reflect":
      return "Explain back what changed and why it works.";
    case "challenge":
      return "Try the mini challenge and ask for feedback if you get stuck.";
    default:
      return "";
  }
}

export function ChatPanel({
  messages,
  sessionStage,
  learningGoal,
  inputValue,
  isSending,
  isEvaluating,
  error,
  suggestedPrompts,
  onInputChange,
  onSend,
  onUsePrompt,
  onEnterReflectMode,
}: ChatPanelProps) {
  return (
    <section className="learn-chat-panel">
      <header className="learn-chat-panel__header">
        <h2>Learn Agent</h2>
      </header>

      {learningGoal && (
        <p className="learn-chat-panel__goal">Goal: {learningGoal}</p>
      )}

      <p className="learn-chat-panel__hint">{getStageHint(sessionStage)}</p>

      <div className="learn-chat-panel__messages">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {sessionStage === "idle" && (
        <SuggestedPrompts prompts={suggestedPrompts} onSelect={onUsePrompt} />
      )}

      {sessionStage === "practice" && (
        <button
          className="learn-chat-panel__reflect-btn"
          type="button"
          onClick={onEnterReflectMode}
          disabled={isSending || isEvaluating}
        >
          I think I get it now
        </button>
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
        >
          {isSending ? "Sending..." : isEvaluating ? "Evaluating..." : "Send"}
        </button>
      </div>

      {(isSending || isEvaluating) && (
        <span className="learn-chat-panel__stage-status">
          Stage: {sessionStage}
        </span>
      )}
    </section>
  );
}
