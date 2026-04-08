import { useNavigate } from "react-router-dom";
import { useCompletedCount } from "../../stores/progressSelectors";
import type { Topic } from "../../types/database";
import "./Dropdowns.css";

interface TopicDropdownProps {
  topics: Topic[];
  selectedTopic: Topic | null;
  onSelect: (topic: Topic) => void;
  disabled?: boolean;
  subtopicIds?: string[];
  userId?: string;
}

export function TopicDropdown({
  topics,
  selectedTopic,
  onSelect,
  disabled = false,
  subtopicIds = [],
  userId,
}: TopicDropdownProps) {
  const navigate = useNavigate();
  const completedCount = useCompletedCount(subtopicIds);
  const totalLessons = subtopicIds.length;
  const allComplete = totalLessons > 0 && completedCount === totalLessons;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const topic = topics.find((t) => t.id === e.target.value);
    if (topic) {
      onSelect(topic);
    }
  };

  const handleChallengeClick = () => {
    if (selectedTopic && allComplete) {
      navigate(`/challenge/topic/${selectedTopic.id}`);
    }
  };

  return (
    <div className="dropdown-wrapper">
      <div className="dropdown-container">
        <label htmlFor="topic-select">Topic</label>
        <select
          id="topic-select"
          value={selectedTopic?.id || ""}
          onChange={handleChange}
          disabled={disabled || topics.length === 0}
          className="dropdown-select"
        >
          {topics.length === 0 ? (
            <option value="">No topics available</option>
          ) : (
            topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))
          )}
        </select>
      </div>

      {userId && selectedTopic && totalLessons > 0 && (
        <div className="challenge-progress">
          <div className="challenge-progress-bar">
            <div
              className="challenge-progress-fill"
              style={{ width: `${(completedCount / totalLessons) * 100}%` }}
            />
          </div>
          <span className="challenge-progress-text">
            {completedCount}/{totalLessons}
          </span>
          {allComplete && (
            <button
              className="challenge-link"
              onClick={handleChallengeClick}
              title="Take the challenge!"
            >
              ⚔️
            </button>
          )}
        </div>
      )}
    </div>
  );
}
