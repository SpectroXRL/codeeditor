import { useState } from "react";
import "./App.css";
import { CodeEditor } from "./components/CodeEditor";
import { LanguageSelector } from "./components/LanguageSelector";
import { StdinInput } from "./components/StdinInput";
import { OutputPanel } from "./components/OutputPanel";
import { executeCode } from "./services/judge0";
import { type Language, LANGUAGES, type SubmissionResult } from "./types";

function App() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    LANGUAGES[0],
  );
  const [code, setCode] = useState<string>(LANGUAGES[0].template);
  const [stdin, setStdin] = useState<string>("");
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");

  const handleLanguageChange = (language: Language) => {
    setSelectedLanguage(language);
    setCode(language.template);
    setResult(null);
    setError(null);
  };

  const handleRun = async () => {
    if (!code.trim()) {
      setError("Please enter some code to run");
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const submissionResult = await executeCode(
        code,
        selectedLanguage.id,
        stdin,
      );
      setResult(submissionResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"));
  };

  return (
    <div className={`app ${theme}`}>
      <header className="app-header">
        <h1>Code Editor</h1>
        <div className="header-controls">
          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
            disabled={isRunning}
          />
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === "vs-dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          <button
            className="run-button"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? "Running..." : "▶ Run"}
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="editor-section">
          <CodeEditor
            code={code}
            language={selectedLanguage}
            theme={theme}
            onChange={setCode}
            disabled={isRunning}
          />
          <StdinInput value={stdin} onChange={setStdin} disabled={isRunning} />
        </div>

        <div className="output-section">
          <OutputPanel result={result} isRunning={isRunning} error={error} />
        </div>
      </main>
    </div>
  );
}

export default App;
