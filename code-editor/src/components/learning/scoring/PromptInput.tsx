/**
 * Prompt Input Component
 * Multi-line text input for agentic challenge prompts with character count and iteration tracking
 */

import { useState, useRef, useEffect, useCallback } from "react";
import "./scoring.css";

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  disabled: boolean;
  iterationsUsed: number;
  maxIterations: number;
  placeholder?: string;
}

const MAX_CHARS = 4000;

export function PromptInput({
  onSubmit,
  isLoading,
  disabled,
  iterationsUsed,
  maxIterations,
  placeholder = "Describe the code you need the AI to generate...",
}: PromptInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const iterationsRemaining = maxIterations - iterationsUsed;
  const isOverLimit = value.length > MAX_CHARS;
  const canSubmit =
    !disabled &&
    !isLoading &&
    value.trim().length > 0 &&
    !isOverLimit &&
    iterationsRemaining > 0;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(value.trim());
    setValue("");
  }, [canSubmit, value, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="prompt-input-container">
      <div className="prompt-input-header">
        <span className="prompt-input-label">Your Prompt</span>
        <div className="prompt-input-badges">
          <span
            className={`iteration-badge ${iterationsRemaining <= 1 ? "low" : ""}`}
          >
            {iterationsUsed}/{maxIterations} used
          </span>
          <span className={`char-count ${isOverLimit ? "over-limit" : ""}`}>
            {value.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      <div className="prompt-input-wrapper">
        <textarea
          ref={textareaRef}
          className="prompt-input-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading || iterationsRemaining === 0}
          rows={3}
        />

        {iterationsRemaining === 0 && (
          <div className="iterations-exhausted-overlay">
            <span>No iterations remaining</span>
          </div>
        )}
      </div>

      <div className="prompt-input-footer">
        <span className="prompt-input-hint">
          {canSubmit ? "Press Ctrl+Enter to submit" : ""}
        </span>

        <button
          className="prompt-submit-button"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <>
              <span className="spinner" />
              Generating...
            </>
          ) : (
            <>
              Generate Code
              {iterationsRemaining > 0 && (
                <span className="remaining-badge">
                  {iterationsRemaining} left
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
