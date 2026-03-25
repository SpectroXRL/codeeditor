import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getChallengeForTopic,
  getChallengeForSubject,
  isTopicChallengeUnlocked,
  isSubjectChallengeUnlocked,
  getUserBestAttempt,
  getTopicProgress,
} from "../../services/challenges";
import type { Challenge, ChallengeAttempt } from "../../types/database";
import "./ChallengeCard.css";

interface ChallengeCardProps {
  type: "mini_boss" | "final_boss";
  topicId?: string;
  subjectId?: string;
  userId: string;
  topicName?: string;
  subjectName?: string;
}

export function ChallengeCard({
  type,
  topicId,
  subjectId,
  userId,
  topicName,
  subjectName,
}: ChallengeCardProps) {
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [bestAttempt, setBestAttempt] = useState<ChallengeAttempt | null>(null);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChallengeData() {
      setLoading(true);

      try {
        // Load challenge
        let challengeData: Challenge | null = null;
        if (type === "mini_boss" && topicId) {
          challengeData = await getChallengeForTopic(topicId);

          // Check unlock status
          const unlocked = await isTopicChallengeUnlocked(userId, topicId);
          setIsUnlocked(unlocked);

          // Get progress
          const prog = await getTopicProgress(userId, topicId);
          setProgress(prog);
        } else if (type === "final_boss" && subjectId) {
          challengeData = await getChallengeForSubject(subjectId);

          // Check unlock status
          const unlocked = await isSubjectChallengeUnlocked(userId, subjectId);
          setIsUnlocked(unlocked);
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
