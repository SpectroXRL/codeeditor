import { Panel } from "../shared";
import "./HintsPanel.css";

interface HintsPanelProps {
  hints: string[];
  hintsRevealed: number;
  onRevealNext: () => void;
  isAuthenticated: boolean;
}

export function HintsPanel({
  hints,
  hintsRevealed,
  onRevealNext,
  isAuthenticated,
}: HintsPanelProps) {
  // Don't render if no hints available
  if (!hints || hints.length === 0) {
    return null;
  }

  const hasMoreHints = hintsRevealed < hints.length;
  const visibleHints = hints.slice(0, hintsRevealed);

  return (
    <Panel
      header={{
        title: "Hints",
        icon: "💡",
        variant: "gradient-amber",
        action: (
          <span className="hints-header__count">
            {hintsRevealed} of {hints.length} revealed
          </span>
        ),
      }}
      className="hints-panel"
    >
      {!isAuthenticated ? (
        <div className="hints-auth-prompt">
          <p>Sign in to access hints for this lesson</p>
        </div>
      ) : hintsRevealed === 0 ? (
        <div className="hints-empty">
          <p>Need a nudge in the right direction?</p>
          <button className="reveal-btn" onClick={onRevealNext}>
            Show first hint
          </button>
        </div>
      ) : (
        <>
          <div className="hints-list">
            {visibleHints.map((hint, idx) => (
              <div key={idx} className="hint-item">
                <span className="hint-number">{idx + 1}</span>
                <span className="hint-text">{hint}</span>
              </div>
            ))}
          </div>

          {hasMoreHints && (
            <button className="reveal-btn" onClick={onRevealNext}>
              Show hint {hintsRevealed + 1} of {hints.length}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
