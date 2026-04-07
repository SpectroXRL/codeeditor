import { useState, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Content } from "../../types/database";
import type { DetectedIssue, AssistanceTier, TutorResponse } from "../../types";
import { getTutorHelp, getNextTier, getTierLabel } from "../../services/tutor";
import "./TutorPanel.css";

interface TutorPanelProps {
  content: Content | null;
  code: string;
  language: string;
  detectedIssues: DetectedIssue[];
  isAuthenticated: boolean;
  canCall: boolean;
  callsUsed: number;
  maxCalls: number;
  resetTime: Date | null;
  onAssistanceUsed: () => void;
  isVisible: boolean;
  onClose: () => void;
}

type PanelState = "idle" | "loading" | "showing_response" | "error";

/**
 * Main tutor interaction panel
 * Shows detected issues and provides tiered AI assistance
 */
export const TutorPanel = memo(function TutorPanel({
  content,
  code,
  language,
  detectedIssues,
  isAuthenticated,
  canCall,
  callsUsed,
  maxCalls,
  resetTime,
  onAssistanceUsed,
  isVisible,
  onClose,
}: TutorPanelProps) {
  const [state, setState] = useState<PanelState>("idle");
  const [currentTier, setCurrentTier] = useState<AssistanceTier>("tip");
  const [response, setResponse] = useState<TutorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const primaryIssue = detectedIssues.length > 0 ? detectedIssues[0] : null;

  const handleGetHelp = useCallback(
    async (tier: AssistanceTier) => {
      if (!content || !canCall) return;

      setState("loading");
      setError(null);
      setCurrentTier(tier);

      try {
        const result = await getTutorHelp({
          code,
          content,
          issue: primaryIssue || undefined,
          tier,
          language,
        });

        setResponse(result);
        setState("showing_response");
        onAssistanceUsed();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get help");
        setState("error");
      }
    },
    [content, code, language, primaryIssue, canCall, onAssistanceUsed],
  );

  const handleEscalate = useCallback(() => {
    const nextTier = getNextTier(currentTier);
    if (nextTier) {
      handleGetHelp(nextTier);
    }
  }, [currentTier, handleGetHelp]);

  const handleReset = useCallback(() => {
    setState("idle");
    setResponse(null);
    setError(null);
    setCurrentTier("tip");
  }, []);

  const formatResetTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!isVisible) {
    return null;
  }

  const renderContent = () => {
    // Not authenticated
    if (!isAuthenticated) {
      return (
        <div className="tutor-auth-prompt">
          <span className="auth-icon">🔒</span>
          <p>Sign in to get AI tutor help</p>
          <p className="auth-subtext">
            Get personalized guidance and hints as you learn
          </p>
        </div>
      );
    }

    // Rate limited
    if (!canCall && state !== "showing_response") {
      return (
        <div className="tutor-rate-limit">
          <span className="limit-icon">⏳</span>
          <p>
            You've used {callsUsed}/{maxCalls} tutor requests this hour
          </p>
          {resetTime && (
            <p className="limit-subtext">
              More available at {formatResetTime(resetTime)}
            </p>
          )}
        </div>
      );
    }

    // Loading
    if (state === "loading") {
      return (
        <div className="tutor-loading">
          <div className="tutor-spinner"></div>
          <span>Thinking...</span>
        </div>
      );
    }

    // Error
    if (state === "error") {
      return (
        <div className="tutor-error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button
            className="tutor-btn tutor-btn--secondary"
            onClick={handleReset}
          >
            Try Again
          </button>
        </div>
      );
    }

    // Showing response
    if (state === "showing_response" && response) {
      const nextTier = getNextTier(currentTier);

      return (
        <div className="tutor-response">
          <div className="response-tier">
            <span className={`tier-badge tier-badge--${currentTier}`}>
              {getTierLabel(currentTier)}
            </span>
          </div>
          <div className="response-content markdown-body">
            <ReactMarkdown>{response.response}</ReactMarkdown>
          </div>
          <div className="response-actions">
            {response.followUpAvailable && nextTier && canCall && (
              <button
                className="tutor-btn tutor-btn--primary"
                onClick={handleEscalate}
              >
                Need more help? ({getTierLabel(nextTier)})
              </button>
            )}
            <button
              className="tutor-btn tutor-btn--secondary"
              onClick={handleReset}
            >
              Got it
            </button>
          </div>
        </div>
      );
    }

    // Idle state - show detected issues and get help button
    return (
      <div className="tutor-idle">
        {primaryIssue ? (
          <div className="detected-issue">
            <span className="issue-icon">💡</span>
            <p className="issue-message">{primaryIssue.message}</p>
          </div>
        ) : (
          <div className="no-issues">
            <p>No specific issues detected, but I can still help!</p>
          </div>
        )}

        <div className="tutor-actions">
          <button
            className="tutor-btn tutor-btn--primary"
            onClick={() => handleGetHelp("tip")}
            disabled={!canCall}
          >
            💡 Get a Tip
          </button>
          <button
            className="tutor-btn tutor-btn--secondary"
            onClick={() => handleGetHelp("question")}
            disabled={!canCall}
          >
            🤔 Ask me a question
          </button>
        </div>

        <p className="tutor-usage">
          {callsUsed}/{maxCalls} tutor requests used this hour
        </p>
      </div>
    );
  };

  return (
    <div className="tutor-panel">
      <div className="tutor-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="tutor-header__left">
          <span className="tutor-header__icon">🤖</span>
          <h3 className="tutor-header__title">AI Tutor</h3>
        </div>
        <div className="tutor-header__right">
          <button
            className="tutor-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close tutor panel"
          >
            ✕
          </button>
          <button
            className="expand-btn"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        </div>
      </div>

      {isExpanded && <div className="tutor-body">{renderContent()}</div>}
    </div>
  );
});
