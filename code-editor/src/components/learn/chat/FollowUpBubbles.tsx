interface FollowUpBubblesProps {
  followUps: string[];
  onSelect: (prompt: string) => void;
}

export function FollowUpBubbles({ followUps, onSelect }: FollowUpBubblesProps) {
  if (followUps.length === 0) {
    return null;
  }

  return (
    <div className="learn-follow-ups">
      <p className="learn-follow-ups__label">Follow-up ideas</p>
      <div className="learn-follow-ups__list">
        {followUps.map((prompt) => (
          <button
            key={prompt}
            className="learn-follow-ups__chip"
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
