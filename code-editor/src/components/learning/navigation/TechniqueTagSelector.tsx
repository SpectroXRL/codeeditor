/**
 * Technique Tag Selector
 * Multi-select component for students to self-tag which prompt techniques they used
 */

import { useState } from "react";
import { PROMPT_TECHNIQUES, type PromptTechnique } from "../../../types/database";
import "./navigation.css";

interface TechniqueTagSelectorProps {
  selectedTechniques: PromptTechnique[];
  onChange: (techniques: PromptTechnique[]) => void;
  disabled?: boolean;
  detectedTechniques?: PromptTechnique[];
}

const TECHNIQUE_ORDER: PromptTechnique[] = [
  "zero-shot",
  "few-shot",
  "chain-of-thought",
  "system-prompt",
  "iterative-refinement",
  "context-management",
  "tool-calling",
];

export function TechniqueTagSelector({
  selectedTechniques,
  onChange,
  disabled = false,
  detectedTechniques = [],
}: TechniqueTagSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleTechnique = (technique: PromptTechnique) => {
    if (disabled) return;

    if (selectedTechniques.includes(technique)) {
      onChange(selectedTechniques.filter((t) => t !== technique));
    } else {
      onChange([...selectedTechniques, technique]);
    }
  };

  return (
    <div className="technique-selector">
      <button
        className="technique-selector-header"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className="technique-selector-title">
          <span className="technique-icon">🏷️</span>
          <span>Tag Your Techniques</span>
          {selectedTechniques.length > 0 && (
            <span className="selected-count">
              {selectedTechniques.length} selected
            </span>
          )}
        </div>
        <span className={`expand-chevron ${isExpanded ? "expanded" : ""}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="technique-selector-content">
          <p className="technique-selector-description">
            Which techniques did you use in your prompts? (This helps you
            reflect on your learning!)
          </p>

          <div className="technique-chips">
            {TECHNIQUE_ORDER.map((technique) => {
              const info = PROMPT_TECHNIQUES[technique];
              const isSelected = selectedTechniques.includes(technique);
              const isDetected = detectedTechniques.includes(technique);

              return (
                <button
                  key={technique}
                  className={`technique-chip ${isSelected ? "selected" : ""} ${isDetected ? "detected" : ""}`}
                  onClick={() => toggleTechnique(technique)}
                  disabled={disabled}
                  title={info.description}
                  type="button"
                >
                  <span className="chip-label">{info.label}</span>
                  {isDetected && !isSelected && (
                    <span
                      className="detected-badge"
                      title="Detected in your prompts"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {detectedTechniques.length > 0 && (
            <p className="detection-note">
              <span className="detection-icon">🔍</span>
              We detected some techniques in your prompts (marked with ✓). Add
              any others you intentionally used!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
