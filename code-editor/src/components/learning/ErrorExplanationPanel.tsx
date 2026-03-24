import { useState } from "react";
import ReactMarkdown from "react-markdown";
import "./ErrorExplanationPanel.css";

export interface ErrorExplanationPanelProps {
  explanation: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  canCall: boolean;
  callsUsed: number;
  maxCalls: number;
  resetTime: Date | null;
  onRetry?: () => void;
  hasFailedTests: boolean;
}

export function ErrorExplanationPanel({
  explanation,
  isLoading,
  error,
  isAuthenticated,
  canCall,
  callsUsed,
  maxCalls,
  resetTime,
  onRetry,
  hasFailedTests,
}: ErrorExplanationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Don't show the panel if there are no failed tests and no explanation/loading
  if (!hasFailedTests && !explanation && !isLoading) {
    return null;
  }

  const formatResetTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderContent = () => {
    // Loading state
    if (isLoading) {
      return (
        <div className="explanation-loading">
          <div className="ai-spinner"></div>
          <span>Analyzing your code...</span>
        </div>
      );
    }

    // Not authenticated
    if (!isAuthenticated) {
      return (
        <div className="explanation-auth-prompt">
          <span className="auth-icon">🔒</span>
          <p>Sign in to get AI-powered feedback on your code</p>
          <p className="auth-subtext">
            Our AI tutor can help explain what went wrong and guide you to the
            solution
          </p>
        </div>
      );
    }

    // Rate limited
    if (!canCall && !explanation) {
      return (
        <div className="explanation-rate-limit">
          <span className="limit-icon">⏳</span>
          <p>
            You've used {callsUsed}/{maxCalls} AI explanations this hour
          </p>
          {resetTime && (
            <p className="limit-subtext">
              More available at {formatResetTime(resetTime)}
            </p>
          )}
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div className="explanation-error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          {onRetry && canCall && (
            <button className="retry-btn" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      );
    }

    // Success - show explanation
    if (explanation) {
      return (
        <div className="explanation-content">
          <ReactMarkdown>{explanation}</ReactMarkdown>
          {onRetry && canCall && (
            <div className="explanation-footer">
              <span className="calls-remaining">
                {callsUsed}/{maxCalls} explanations used
              </span>
              <button className="regenerate-btn" onClick={onRetry}>
                🔄 Regenerate
              </button>
            </div>
          )}
        </div>
      );
    }

    // Waiting for test failure
    return null;
  };

  const content = renderContent();
  if (!content) return null;

  return (
    <div className="error-explanation-panel">
      <div
        className="explanation-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="header-left">
          <span className="ai-badge">✨ AI Tutor</span>
          <h3>Error Explanation</h3>
        </div>
        <button className="expand-btn">{isExpanded ? "▼" : "▶"}</button>
      </div>

      {isExpanded && <div className="explanation-body">{content}</div>}
    </div>
  );
}
