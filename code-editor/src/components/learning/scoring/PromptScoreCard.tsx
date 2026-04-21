/**
 * Prompt Score Card
 * Displays the scoring breakdown and AI feedback after completing an agentic challenge
 */

import { useState } from "react";
import type { PromptTechnique, ApiPromptScores } from "../../../types/database";
import "./scoring.css";

interface PromptScoreCardProps {
  scores: ApiPromptScores;
  aiFeedback: string;
  referencePrompt: string | null;
  techniquesTags: PromptTechnique[];
  testsPassed: boolean;
  onClose?: () => void;
}

function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
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
        <span className="score-bar-label">{label}</span>
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
      <span className="score-bar-description">{getScoreLabel(score)}</span>
    </div>
  );
}

export function PromptScoreCard({
  scores,
  aiFeedback,
  referencePrompt,
  techniquesTags,
  testsPassed,
  onClose,
}: PromptScoreCardProps) {
  const [showReference, setShowReference] = useState(false);

  const getFinalScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e"; // green
    if (score >= 60) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  const getFinalScoreEmoji = (score: number) => {
    if (score >= 90) return "🏆";
    if (score >= 80) return "🌟";
    if (score >= 70) return "👍";
    if (score >= 60) return "📈";
    return "💪";
  };

  return (
    <div className="score-card-overlay">
      <div className="score-card">
        <div className="score-card-header">
          <div className="score-card-title">
            {testsPassed ? (
              <>
                <span className="success-icon">✅</span>
                <h2>Challenge Complete!</h2>
              </>
            ) : (
              <>
                <span className="attempt-icon">📊</span>
                <h2>Attempt Summary</h2>
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
            <span className="final-score-label">Prompt Score</span>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="score-breakdown">
          <h3>Score Breakdown</h3>
          <div className="score-bars">
            <ScoreBar label="Clarity" score={scores.clarity} color="#3b82f6" />
            <ScoreBar
              label="Efficiency"
              score={scores.efficiency}
              color="#22c55e"
            />
            <ScoreBar label="Context" score={scores.context} color="#a855f7" />
            <ScoreBar
              label="Technique"
              score={scores.technique}
              color="#f97316"
            />
          </div>
        </div>

        {/* AI Feedback */}
        <div className="feedback-section">
          <h3>💡 Feedback</h3>
          <p className="feedback-text">{aiFeedback}</p>
        </div>

        {/* Techniques Used */}
        {techniquesTags.length > 0 && (
          <div className="techniques-section">
            <h3>🏷️ Techniques Used</h3>
            <div className="technique-tags">
              {techniquesTags.map((tech) => (
                <span key={tech} className="technique-tag">
                  {tech
                    .split("-")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reference Prompt */}
        {referencePrompt && (
          <div className="reference-section">
            <button
              className="reference-toggle"
              onClick={() => setShowReference(!showReference)}
            >
              <span>📝 {showReference ? "Hide" : "Show"} Reference Prompt</span>
              <span className={`toggle-arrow ${showReference ? "open" : ""}`}>
                ▼
              </span>
            </button>

            {showReference && (
              <div className="reference-prompt">
                <p className="reference-intro">
                  Here's an example of an effective prompt for this challenge:
                </p>
                <blockquote className="reference-text">
                  {referencePrompt}
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
