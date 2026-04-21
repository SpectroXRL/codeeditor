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
          {isRunning ? "Running..." : "Run Code"}
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
