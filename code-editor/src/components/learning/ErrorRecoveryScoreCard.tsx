/**
 * Error Recovery Score Card
 * Displays scoring breakdown for error recovery lessons
 * Shows 4 dimensions: Diagnosis, Fix Precision, Iteration Economy, No Regression
 */

import { useState } from "react";
import type {
  ApiErrorRecoveryScores,
  TestDiffData,
  ErrorType,
} from "../../types/database";
import { ERROR_TYPES } from "../../types/database";
import { TestDiffPanel } from "./TestDiffPanel";
import "./ErrorRecoveryScoreCard.css";

interface ErrorRecoveryScoreCardProps {
  scores: ApiErrorRecoveryScores;
  aiFeedback: string;
  expectedFixPrompt?: string | null;
  testDiff: TestDiffData;
  errorTypeDetected: ErrorType | null;
  actualErrorType: ErrorType;
  testsPassed: boolean;
  onClose?: () => void;
}

function ScoreBar({
  label,
  description,
  score,
  color,
}: {
  label: string;
  description: string;
  score: number;
  color: string;
}) {
  const getScoreLabel = (s: number) => {
    if (s >= 90) return "Excellent";
    if (s >= 75) return "Good";
    if (s >= 60) return "Fair";
    if (s >= 40) return "Needs Work";
    return "Poor";
  };

  return (
    <div className="score-bar-container">
      <div className="score-bar-header">
        <div className="score-bar-info">
          <span className="score-bar-label">{label}</span>
          <span className="score-bar-description">{description}</span>
        </div>
        <span className="score-bar-value">{score}</span>
      </div>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="score-bar-rating">{getScoreLabel(score)}</span>
    </div>
  );
}

export function ErrorRecoveryScoreCard({
  scores,
  aiFeedback,
  expectedFixPrompt,
  testDiff,
  errorTypeDetected,
  actualErrorType,
  testsPassed,
  onClose,
}: ErrorRecoveryScoreCardProps) {
  const [showReference, setShowReference] = useState(false);
  const [showTestDiff, setShowTestDiff] = useState(false);

  const getFinalScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e"; // green
    if (score >= 60) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  const getFinalScoreEmoji = (score: number) => {
    if (score >= 90) return "🏆";
    if (score >= 80) return "🔧";
    if (score >= 70) return "👍";
    if (score >= 60) return "📈";
    return "💪";
  };

  const actualErrorInfo = ERROR_TYPES[actualErrorType];
  const detectedErrorInfo = errorTypeDetected
    ? ERROR_TYPES[errorTypeDetected]
    : null;
  const correctDiagnosis = errorTypeDetected === actualErrorType;

  return (
    <div className="score-card-overlay">
      <div className="score-card error-recovery">
        <div className="score-card-header">
          <div className="score-card-title">
            {testsPassed ? (
              <>
                <span className="success-icon">🔧</span>
                <h2>Bug Fixed!</h2>
              </>
            ) : (
              <>
                <span className="attempt-icon">🐛</span>
                <h2>Debug Attempt Summary</h2>
              </>
            )}
          </div>
          {onClose && (
            <button className="close-button" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {/* Final Score Circle */}
        <div className="final-score-section">
          <div
            className="final-score-circle"
            style={{ borderColor: getFinalScoreColor(scores.final) }}
          >
            <span className="final-score-emoji">
              {getFinalScoreEmoji(scores.final)}
            </span>
            <span className="final-score-number">{scores.final}</span>
            <span className="final-score-label">Debug Score</span>
          </div>
        </div>

        {/* Error Type Detection */}
        <div className="error-detection-section">
          <h3>🔍 Error Analysis</h3>
          <div className="error-type-comparison">
            <div className="error-type-item">
              <span className="error-type-label">Actual Error</span>
              <span className={`error-type-badge ${actualErrorType}`}>
                {actualErrorInfo.label}
              </span>
            </div>
            {errorTypeDetected && (
              <>
                <span className="comparison-arrow">→</span>
                <div className="error-type-item">
                  <span className="error-type-label">Your Diagnosis</span>
                  <span
                    className={`error-type-badge ${errorTypeDetected} ${correctDiagnosis ? "correct" : "incorrect"}`}
                  >
                    {detectedErrorInfo?.label || "Unknown"}
                    {correctDiagnosis ? " ✓" : " ✗"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="score-breakdown">
          <h3>📊 Score Breakdown</h3>
          <div className="score-bars">
            <ScoreBar
              label="Diagnosis"
              description="Understanding the error"
              score={scores.diagnosis}
              color="#3b82f6"
            />
            <ScoreBar
              label="Fix Precision"
              description="Targeted vs. full rewrite"
              score={scores.fixPrecision}
              color="#a855f7"
            />
            <ScoreBar
              label="Iteration Economy"
              description="Fixed quickly"
              score={scores.iterationEconomy}
              color="#22c55e"
            />
            <ScoreBar
              label="No Regression"
              description="Didn't break working code"
              score={scores.noRegression}
              color="#f97316"
            />
          </div>
        </div>

        {/* AI Feedback */}
        <div className="feedback-section">
          <h3>💡 Debugging Feedback</h3>
          <p className="feedback-text">{aiFeedback}</p>
        </div>

        {/* Test Diff Toggle */}
        <div className="test-diff-section">
          <button
            className="test-diff-toggle"
            onClick={() => setShowTestDiff(!showTestDiff)}
          >
            <span>📋 {showTestDiff ? "Hide" : "Show"} Test Comparison</span>
            <span className={`toggle-arrow ${showTestDiff ? "open" : ""}`}>
              ▼
            </span>
          </button>

          {showTestDiff && (
            <div className="test-diff-wrapper">
              <TestDiffPanel testDiff={testDiff} collapsible={false} />
            </div>
          )}
        </div>

        {/* Reference Fix Prompt */}
        {expectedFixPrompt && (
          <div className="reference-section">
            <button
              className="reference-toggle"
              onClick={() => setShowReference(!showReference)}
            >
              <span>
                📝 {showReference ? "Hide" : "Show"} Reference Fix Approach
              </span>
              <span className={`toggle-arrow ${showReference ? "open" : ""}`}>
                ▼
              </span>
            </button>

            {showReference && (
              <div className="reference-prompt">
                <p className="reference-intro">
                  Here's an effective approach for fixing this bug:
                </p>
                <blockquote className="reference-text">
                  {expectedFixPrompt}
                </blockquote>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="score-card-actions">
          {!testsPassed && (
            <button className="action-button secondary">Try Again</button>
          )}
          <button className="action-button primary" onClick={onClose}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
