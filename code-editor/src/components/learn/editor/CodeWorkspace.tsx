import { CodeEditor } from "../../CodeEditor";
import { LanguageSelector } from "../../LanguageSelector";
import type { Language, SubmissionResult } from "../../../types";
import { RunOutput } from "./RunOutput";
import "./editor.css";

interface CodeWorkspaceProps {
  selectedLanguage: Language;
  currentCode: string;
  runResult: SubmissionResult | null;
  runError: string | null;
  outputText: string | null;
  isRunning: boolean;
  theme: "vs-dark" | "light";
  onLanguageChange: (language: Language) => void;
  onCodeChange: (value: string) => void;
  onRun: () => void;
}

export function CodeWorkspace({
  selectedLanguage,
  currentCode,
  runResult,
  runError,
  outputText,
  isRunning,
  theme,
  onLanguageChange,
  onCodeChange,
  onRun,
}: CodeWorkspaceProps) {
  return (
    <section className="learn-editor">
      <div className="learn-editor__toolbar">
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onLanguageChange={onLanguageChange}
          disabled={isRunning}
        />
        <button
          className="learn-editor__run"
          type="button"
          onClick={onRun}
          disabled={isRunning || !currentCode.trim()}
        >
          {isRunning ? (
            <>
              <svg
                className="learn-editor__run-spinner"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              Running...
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
              Run Code
            </>
          )}
        </button>
      </div>

      <div className="learn-editor__workspace">
        <CodeEditor
          code={currentCode}
          language={selectedLanguage}
          theme={theme}
          onChange={onCodeChange}
        />
      </div>

      <RunOutput
        runResult={runResult}
        runError={runError}
        outputText={outputText}
      />
    </section>
  );
}
