import type { SessionStage } from "../../../types/session";
import "./session.css";

interface SessionStageBarProps {
  currentStage: SessionStage;
  learningGoal: string;
}

const STAGES: SessionStage[] = [
  "idle",
  "clarify",
  "teach",
  "practice",
  "check_in",
  "reflect",
  "challenge",
];

export function SessionStageBar({
  currentStage,
  learningGoal,
}: SessionStageBarProps) {
  const currentIndex = STAGES.indexOf(currentStage);

  return (
    <section className="learn-stage-bar">
      <div
        className="learn-stage-bar__stages"
        aria-label="Learning session stages"
      >
        {STAGES.map((stage, index) => (
          <div
            key={stage}
            className={`learn-stage-pill ${
              index < currentIndex
                ? "completed"
                : index === currentIndex
                  ? "active"
                  : "upcoming"
            }`}
          >
            {stage}
          </div>
        ))}
      </div>
      <p className="learn-stage-bar__goal">
        Goal:{" "}
        {learningGoal || "Not set yet. Start by saying what you want to learn."}
      </p>
    </section>
  );
}
