/**
 * Error Context Panel
 * Displays the broken code and error message for error recovery lessons
 */

import { useState } from "react";
import Editor from "@monaco-editor/react";
import type { ErrorType } from "../../types/database";
import { ERROR_TYPES } from "../../types/database";
import "./ErrorContextPanel.css";

interface ErrorContextPanelProps {
  brokenCode: string;
  errorMessage: string;
  errorType?: ErrorType;
  showErrorType?: boolean; // For guided mode, show the error type badge
  language?: string;
  theme?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function ErrorContextPanel({
  brokenCode,
  errorMessage,
  errorType,
  showErrorType = false,
  language = "javascript",
  theme = "vs-dark",
  collapsible = true,
  defaultExpanded = true,
}: ErrorContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const errorTypeInfo = errorType ? ERROR_TYPES[errorType] : null;

  return (
    <div
      className={`error-context-panel ${isExpanded ? "expanded" : "collapsed"}`}
    >
      {collapsible && (
        <button
          className="error-context-header"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <div className="header-content">
            <span className="header-icon">🐛</span>
            <span className="header-title">Debug This Code</span>
            {showErrorType && errorTypeInfo && (
              <span className={`error-type-badge ${errorType}`}>
                {errorTypeInfo.label}
              </span>
            )}
          </div>
          <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>
            ▼
          </span>
        </button>
      )}

      {(!collapsible || isExpanded) && (
        <div className="error-context-content">
          {/* Broken Code Section */}
          <div className="broken-code-section">
            <div className="section-label">
              <span className="label-icon">📄</span>
              <span>Broken Code</span>
            </div>
            <div className="code-editor-wrapper">
              <Editor
                height="200px"
                language={language}
                value={brokenCode}
                theme={theme}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: "on",
                  folding: false,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

          {/* Error Message Section */}
          <div className="error-message-section">
            <div className="section-label">
              <span className="label-icon">⚠️</span>
              <span>Error Output</span>
            </div>
            <div className="error-message-box">
              <pre className="error-message-text">{errorMessage}</pre>
            </div>
          </div>

          {/* Instructions */}
          <div className="instructions-section">
            <p className="instructions-text">
              <strong>Your task:</strong> Write a prompt that instructs the AI
              to fix this bug. Try to identify the root cause and request a
              targeted fix.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
