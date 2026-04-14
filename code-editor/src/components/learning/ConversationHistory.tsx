/**
 * Conversation History Component
 * Displays the chat-style history of prompts and generated code
 */

import type { PromptTurn } from "../../types/database";
import "./ConversationHistory.css";

interface ConversationHistoryProps {
  history: PromptTurn[];
  currentIteration?: number;
}

export function ConversationHistory({
  history,
  currentIteration,
}: ConversationHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="conversation-history-empty">
        <div className="empty-icon">💬</div>
        <p>Your conversation with the AI will appear here.</p>
        <p className="empty-hint">Write a prompt above to get started!</p>
      </div>
    );
  }

  return (
    <div className="conversation-history">
      <div className="conversation-header">
        <span>Conversation History</span>
        <span className="turn-count">
          {history.length} turn{history.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="conversation-turns">
        {history.map((turn, index) => (
          <div
            key={turn.id}
            className={`conversation-turn ${currentIteration === turn.iterationNumber ? "current" : ""}`}
          >
            {/* User prompt */}
            <div className="turn-message user">
              <div className="message-header">
                <span className="message-role">You</span>
                <span className="message-iteration">
                  #{turn.iterationNumber}
                </span>
              </div>
              <div className="message-content">{turn.prompt}</div>
            </div>

            {/* AI response */}
            <div className="turn-message assistant">
              <div className="message-header">
                <span className="message-role">AI Agent</span>
                <span className="message-status">✓ Code generated</span>
              </div>

              {turn.agentReasoning && (
                <div className="message-reasoning">
                  <strong>Reasoning:</strong> {turn.agentReasoning}
                </div>
              )}

              <div className="message-code-preview">
                <pre>
                  <code>
                    {turn.generatedCode.slice(0, 200)}
                    {turn.generatedCode.length > 200 && "..."}
                  </code>
                </pre>
              </div>
            </div>

            {index < history.length - 1 && <div className="turn-divider" />}
          </div>
        ))}
      </div>
    </div>
  );
}
