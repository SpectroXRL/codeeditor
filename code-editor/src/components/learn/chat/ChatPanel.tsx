import { MessageBubble } from "./MessageBubble";
import { ModeSwitcher } from "./ModeSwitcher";
import { SuggestedPrompts } from "./SuggestedPrompts";
import type {
  LearnChatMessage,
  LearnMode,
  SessionStage,
} from "../../../types/session";
import "./chat.css";

interface ChatPanelProps {
  messages: LearnChatMessage[];
  mode: LearnMode;
  sessionStage: SessionStage;
  learningGoal: string;
  inputValue: string;
  isSending: boolean;
  isEvaluating: boolean;
  error: string | null;
  suggestedPrompts: string[];
  onModeChange: (mode: LearnMode) => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onUsePrompt: (prompt: string) => void;
}

function getStageHint(stage: SessionStage, mode: LearnMode): string {
  if (mode === "copilot") {
    return "Describe the code you want built or refactored. Co-pilot mode responds directly.";
  }

  switch (stage) {
    case "idle":
      return "Describe what you want to learn in code.";
    case "clarify":
      return "Answer the clarifying question so we can generate focused starter code.";
    case "teach":
      return "Read the explanation, then modify and run the starter code.";
    case "practice":
      return "Keep iterating on your code and ask for targeted guidance.";
    case "check_in":
      return "The agent is checking your readiness. Reply whether you feel you understand it yet.";
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
  mode,
  sessionStage,
  learningGoal,
  inputValue,
  isSending,
  isEvaluating,
  error,
  suggestedPrompts,
  onModeChange,
  onInputChange,
  onSend,
  onUsePrompt,
}: ChatPanelProps) {
  const hasLinkInInput = /https:\/\/\S+/i.test(inputValue);

  return (
    <section className="learn-chat-panel">
      <header className="learn-chat-panel__header">
        <h2>Learn Agent</h2>
        <ModeSwitcher
          mode={mode}
          onChange={onModeChange}
          disabled={isSending || isEvaluating}
        />
      </header>

      {learningGoal && (
        <p className="learn-chat-panel__goal">Goal: {learningGoal}</p>
      )}

      <p className="learn-chat-panel__hint">
        {getStageHint(sessionStage, mode)}
      </p>

      <div className="learn-chat-panel__messages">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

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
        >
          {isSending ? "Sending..." : isEvaluating ? "Evaluating..." : "Send"}
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
