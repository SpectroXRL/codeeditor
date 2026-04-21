import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getChallengeForTopic,
  getChallengeForSubject,
  isSubjectChallengeUnlocked,
  getUserBestAttempt,
} from "../../../services/challenges";
import {
  useCompletedCount,
  useIsTopicComplete,
} from "../../../stores/progressSelectors";
import type { Challenge, ChallengeAttempt } from "../../../types/database";
import "./challenges.css";

interface ChallengeCardProps {
  type: "mini_boss" | "final_boss";
  topicId?: string;
  subjectId?: string;
  userId: string;
  topicName?: string;
  subjectName?: string;
  subtopicIds?: string[]; // For reactive progress updates
}

export function ChallengeCard({
  type,
  topicId,
  subjectId,
  userId,
  topicName,
  subjectName,
  subtopicIds = [],
}: ChallengeCardProps) {
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [bestAttempt, setBestAttempt] = useState<ChallengeAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  // For final_boss, we track unlock status from DB
  const [finalBossUnlocked, setFinalBossUnlocked] = useState(false);

  // Use store selectors for mini_boss progress (reactive updates)
  const completedCount = useCompletedCount(subtopicIds);
  const storeIsComplete = useIsTopicComplete(subtopicIds);

  // Determine progress and unlock based on type
  // Build progress object locally from primitives
  const progress =
    type === "mini_boss" && subtopicIds.length > 0
      ? { completed: completedCount, total: subtopicIds.length }
      : null;
  const isUnlocked = type === "mini_boss" ? storeIsComplete : finalBossUnlocked;

  useEffect(() => {
    async function loadChallengeData() {
      setLoading(true);

      try {
        // Load challenge
        let challengeData: Challenge | null = null;
        if (type === "mini_boss" && topicId) {
          challengeData = await getChallengeForTopic(topicId);
          // Progress and unlock come from store selectors (reactive)
        } else if (type === "final_boss" && subjectId) {
          challengeData = await getChallengeForSubject(subjectId);

          // Check unlock status from DB for final_boss
          const unlocked = await isSubjectChallengeUnlocked(userId, subjectId);
          setFinalBossUnlocked(unlocked);
        }

        setChallenge(challengeData);

        // Get best attempt if challenge exists
        if (challengeData) {
          const best = await getUserBestAttempt(userId, challengeData.id);
          setBestAttempt(best);
        }
      } catch (err) {
        console.error("Error loading challenge card:", err);
      } finally {
        setLoading(false);
      }
    }

    loadChallengeData();
  }, [type, topicId, subjectId, userId]);

  const handleClick = () => {
    if (!challenge || !isUnlocked) return;

    if (topicId) {
      navigate(`/challenge/topic/${topicId}`);
    } else if (subjectId) {
      navigate(`/challenge/subject/${subjectId}`);
    }
  };

  if (loading) {
    return (
      <div className={`challenge-card ${type} loading`}>
        <div className="challenge-card-skeleton"></div>
      </div>
    );
  }

  if (!challenge) {
    return null; // No challenge configured for this topic/subject
  }

  const displayName =
    type === "mini_boss" ? topicName || "Topic" : subjectName || "Subject";

  return (
    <div
      className={`challenge-card ${type} ${isUnlocked ? "unlocked" : "locked"} ${bestAttempt ? "completed" : ""}`}
      onClick={handleClick}
    >
      <div className="challenge-card-icon">
        {isUnlocked ? (type === "mini_boss" ? "⚔️" : "👑") : "🔒"}
      </div>

      <div className="challenge-card-content">
        <div className="challenge-card-badge">
          {type === "mini_boss" ? "Mini Boss" : "Final Boss"}
        </div>
        <h3 className="challenge-card-title">{challenge.title}</h3>
        <p className="challenge-card-subtitle">{displayName}</p>
      </div>

      {!isUnlocked && progress && (
        <div className="challenge-card-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(progress.completed / progress.total) * 100}%`,
              }}
            />
          </div>
          <span className="progress-text">
            {progress.completed}/{progress.total} complete
          </span>
        </div>
      )}

      {isUnlocked && bestAttempt && (
        <div className="challenge-card-score">
          <span className="score-label">Best Score</span>
          <span className="score-value">{bestAttempt.final_score}</span>
        </div>
      )}

      {isUnlocked && !bestAttempt && (
        <div className="challenge-card-cta">
          <span>Not attempted</span>
          <span className="arrow">→</span>
        </div>
      )}
    </div>
  );
}
