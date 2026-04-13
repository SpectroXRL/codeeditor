/**
 * Agent Reasoning Panel
 * Displays the AI's thinking process for educational purposes
 */

import { useState } from "react";
import "./AgentReasoningPanel.css";

interface AgentReasoningPanelProps {
  reasoning: string;
  isLoading?: boolean;
  iterationNumber?: number;
}

export function AgentReasoningPanel({
  reasoning,
  isLoading = false,
  iterationNumber,
}: AgentReasoningPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!reasoning && !isLoading) {
    return null;
  }

  return (
    <div className="reasoning-panel">
      <button
        className="reasoning-panel-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="reasoning-panel-title">
          <span className="reasoning-icon">💭</span>
          <span>Agent's Reasoning</span>
          {iterationNumber && (
            <span className="iteration-indicator">
              Iteration {iterationNumber}
            </span>
          )}
        </div>
        <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>▼</span>
      </button>

      {isExpanded && (
        <div className="reasoning-panel-content">
          {isLoading ? (
            <div className="reasoning-loading">
              <div className="thinking-animation">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
              <span>Thinking...</span>
            </div>
          ) : (
            <p className="reasoning-text">{reasoning}</p>
          )}
        </div>
      )}
    </div>
  );
}
