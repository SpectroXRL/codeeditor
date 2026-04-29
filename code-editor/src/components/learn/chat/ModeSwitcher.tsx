import type { LearnMode } from "../../../types/session";

interface ModeOption {
  key: LearnMode;
  label: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { key: "guided", label: "Guided" },
  { key: "explain", label: "Explain" },
  { key: "copilot", label: "Co-pilot" },
];

interface ModeSwitcherProps {
  mode: LearnMode;
  onChange: (mode: LearnMode) => void;
  disabled?: boolean;
}

export function ModeSwitcher({
  mode,
  onChange,
  disabled = false,
}: ModeSwitcherProps) {
  return (
    <div className="learn-mode-switcher" role="tablist" aria-label="Learn mode">
      {MODE_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={mode === option.key}
          className={`learn-mode-switcher__button ${mode === option.key ? "is-active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
