/**
 * Agent Reasoning Panel
 * Displays the AI's thinking process for educational purposes
 */

import { Panel } from "../../shared";
import "./panels.css";

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
  if (!reasoning && !isLoading) {
    return null;
  }

  return (
    <Panel
      header={{
        title: "Agent's Reasoning",
        icon: "💭",
        action: iterationNumber ? (
          <span className="iteration-indicator">
            Iteration {iterationNumber}
          </span>
        ) : undefined,
      }}
      collapsible
      defaultExpanded
      className="reasoning-panel"
    >
      {isLoading ? (
        <div className="reasoning-loading">
          <div className="panel-thinking">
            <div className="panel-thinking__dots">
              <span className="panel-thinking__dot"></span>
              <span className="panel-thinking__dot"></span>
              <span className="panel-thinking__dot"></span>
            </div>
            <span>Thinking...</span>
          </div>
        </div>
      ) : (
        <p className="reasoning-text">{reasoning}</p>
      )}
    </Panel>
  );
}
