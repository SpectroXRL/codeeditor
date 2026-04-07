import { useState, memo } from "react";
import type { DetectedIssue } from "../../types";
import "./TutorIndicator.css";

interface TutorIndicatorProps {
  hasTip: boolean;
  primaryIssue: DetectedIssue | null;
  onClick: () => void;
  isNew?: boolean;
}

/**
 * Floating indicator that shows when AI tutor help is available
 * Positioned in the code editor area
 */
export const TutorIndicator = memo(function TutorIndicator({
  hasTip,
  primaryIssue,
  onClick,
  isNew = false,
}: TutorIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!hasTip) {
    return null;
  }

  return (
    <div className="tutor-indicator-container">
      <button
        className={`tutor-indicator ${isNew ? "tutor-indicator--new" : ""}`}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Get AI tutor help"
        title={primaryIssue?.message || "AI help available"}
      >
        <span className="tutor-indicator__icon">💡</span>
        {isNew && <span className="tutor-indicator__badge">New</span>}
      </button>

      {isHovered && primaryIssue && (
        <div className="tutor-indicator__tooltip">
          <span className="tooltip__message">{primaryIssue.message}</span>
          <span className="tooltip__cta">Click for help</span>
        </div>
      )}
    </div>
  );
});
