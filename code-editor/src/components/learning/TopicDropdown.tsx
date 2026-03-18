import type { Topic } from "../../types/database";
import "./Dropdowns.css";

interface TopicDropdownProps {
  topics: Topic[];
  selectedTopic: Topic | null;
  onSelect: (topic: Topic) => void;
  disabled?: boolean;
}

export function TopicDropdown({
  topics,
  selectedTopic,
  onSelect,
  disabled = false,
}: TopicDropdownProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const topic = topics.find((t) => t.id === e.target.value);
    if (topic) {
      onSelect(topic);
    }
  };

  return (
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
  );
}
