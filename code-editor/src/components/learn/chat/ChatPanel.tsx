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
  learningGoal: string;
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
  sessionStage,
  learningGoal,
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
        <h2>Learn Agent</h2>
        <button type="button" className="learn-page__reset" onClick={onReset}>
          Reset
        </button>
      </header>

      {learningGoal && (
        <p className="learn-chat-panel__goal">Goal: {learningGoal}</p>
      )}

      <p className="learn-chat-panel__hint">{getStageHint(sessionStage)}</p>

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
