import type { LearnChatMessage } from "../../../types/session";

interface MessageBubbleProps {
  message: LearnChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={`learn-message ${message.role}`}>
      <div className="learn-message__meta">
        <span className="learn-message__role">
          {message.role === "user" ? "You" : "Agent"}
        </span>
        <span className="learn-message__time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="learn-message__content">{message.content}</div>
      {message.starterCode && (
        <pre className="learn-message__code-preview">{message.starterCode}</pre>
      )}
    </div>
  );
}
