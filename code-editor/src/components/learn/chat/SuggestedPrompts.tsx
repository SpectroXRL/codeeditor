interface SuggestedPromptsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ prompts, onSelect }: SuggestedPromptsProps) {
  return (
    <div className="learn-suggestions">
      <p className="learn-suggestions__label">Try one:</p>
      <div className="learn-suggestions__list">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            className="learn-suggestions__chip"
            onClick={() => onSelect(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
