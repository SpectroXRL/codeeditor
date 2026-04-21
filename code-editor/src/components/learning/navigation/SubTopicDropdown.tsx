import type { SubTopic } from "../../../types/database";
import "./navigation.css";

interface SubTopicDropdownProps {
  subtopics: SubTopic[];
  selectedSubTopic: SubTopic | null;
  onSelect: (subtopic: SubTopic) => void;
  disabled?: boolean;
}

export function SubTopicDropdown({
  subtopics,
  selectedSubTopic,
  onSelect,
  disabled = false,
}: SubTopicDropdownProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subtopic = subtopics.find((s) => s.id === e.target.value);
    if (subtopic) {
      onSelect(subtopic);
    }
  };

  return (
    <div className="dropdown-container">
      <label htmlFor="subtopic-select">Lesson</label>
      <select
        id="subtopic-select"
        value={selectedSubTopic?.id || ""}
        onChange={handleChange}
        disabled={disabled || subtopics.length === 0}
        className="dropdown-select"
      >
        {subtopics.length === 0 ? (
          <option value="">No lessons available</option>
        ) : (
          subtopics.map((subtopic) => (
            <option key={subtopic.id} value={subtopic.id}>
              {subtopic.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
