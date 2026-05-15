import { useState, useRef, useEffect, useCallback } from "react";
import type { Language } from "../types";
import { LANGUAGES } from "../types";

interface LanguageSelectorProps {
  selectedLanguage: Language;
  onLanguageChange: (language: Language) => void;
  disabled?: boolean;
}

export function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  disabled = false,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, close]);

  const handleContainerBlur = (e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex(
          LANGUAGES.findIndex((l) => l.id === selectedLanguage.id),
        );
        setIsOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, LANGUAGES.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          onLanguageChange(LANGUAGES[highlightedIndex]);
          close();
        }
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className="lang-selector"
      onKeyDown={handleKeyDown}
      onBlur={handleContainerBlur}
    >
      <button
        type="button"
        className={`lang-selector__trigger${
          isOpen ? " lang-selector__trigger--open" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select language"
        disabled={disabled}
        onClick={() => {
          if (!isOpen) {
            setHighlightedIndex(
              LANGUAGES.findIndex((l) => l.id === selectedLanguage.id),
            );
          }
          setIsOpen((o) => !o);
        }}
      >
        {selectedLanguage.name}
        <svg
          className="lang-selector__chevron"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <ul
          className="lang-selector__panel"
          role="listbox"
          aria-label="Language"
        >
          {LANGUAGES.map((lang, index) => {
            const isSelected = lang.id === selectedLanguage.id;
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={lang.id}
                role="option"
                aria-selected={isSelected}
                className={[
                  "lang-selector__item",
                  isSelected ? "lang-selector__item--selected" : "",
                  isHighlighted ? "lang-selector__item--highlighted" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onLanguageChange(lang);
                  close();
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {lang.name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
