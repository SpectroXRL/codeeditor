import { useCallback, useMemo, useState } from "react";
import { PageLayout } from "../components/layout/PageLayout";
import { ChatPanel } from "../components/learn/chat/ChatPanel";
import { CodeWorkspace } from "../components/learn/editor/CodeWorkspace";
import { SessionStageBar } from "../components/learn/session";
import { useTheme } from "../context/ThemeContext";
import { useCodeExecution } from "../hooks/learn/useCodeExecution";
import { useLearnSession } from "../hooks/learn/useLearnSession";
import type { SessionContext } from "../types/session";
import "./LearnPage.css";

const SUGGESTED_PROMPTS = [
  "How do variables work in JavaScript?",
  "Teach me loops with a tiny example I can edit.",
  "I want to understand functions with parameters.",
];

export function LearnPage() {
  const { monacoTheme } = useTheme();
  const [inputValue, setInputValue] = useState("");

  const {
    selectedLanguage,
    currentCode,
    runResult,
    runError,
    outputText,
    isRunning,
    setCurrentCode,
    setRunResult,
    changeLanguage,
    runCurrentCode,
  } = useCodeExecution();

  const {
    chatHistory,
    sessionStage,
    learningGoal,
    totalUserMessages,
    isSending,
    isEvaluating,
    error,
    sendMessage,
    triggerEvaluate,
    enterReflectMode,
    resetSession,
  } = useLearnSession({
    onStarterCode: (starterCode) => {
      setCurrentCode(starterCode);
      setRunResult(null);
    },
  });

  const buildContext = useCallback(
    (sessionIntent?: string): SessionContext => ({
      selectedLanguage: {
        id: selectedLanguage.id,
        name: selectedLanguage.name,
        monacoLanguage: selectedLanguage.monacoLanguage,
      },
      currentCode,
      recentRunResult: runResult,
      lastAgentGoal: learningGoal || undefined,
      sessionIntent: sessionIntent || learningGoal || undefined,
    }),
    [currentCode, learningGoal, runResult, selectedLanguage],
  );

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }

    setInputValue("");

    if (sessionStage === "reflect") {
      await triggerEvaluate({
        context: buildContext(trimmed),
        currentCode,
        studentExplanation: trimmed,
      });
      return;
    }

    await sendMessage({
      message: trimmed,
      context: buildContext(trimmed),
    });
  }, [
    buildContext,
    currentCode,
    inputValue,
    sendMessage,
    sessionStage,
    triggerEvaluate,
  ]);

  const handleUsePrompt = useCallback(
    (prompt: string) => {
      setInputValue(prompt);
    },
    [setInputValue],
  );

  const handleEnterReflectMode = useCallback(() => {
    enterReflectMode();
  }, [enterReflectMode]);

  const headerCopy = useMemo(
    () =>
      totalUserMessages === 0
        ? "Ask your first coding-learning question to start the session."
        : `${totalUserMessages} prompt${totalUserMessages === 1 ? "" : "s"} sent in this session.`,
    [totalUserMessages],
  );

  return (
    <PageLayout>
      <div className="learn-page">
        <header className="learn-page__header">
          <div>
            <h1>Learn Mode</h1>
            <p>{headerCopy}</p>
          </div>
          <button
            type="button"
            className="learn-page__reset"
            onClick={() => {
              resetSession();
              setCurrentCode(selectedLanguage.template);
              setRunResult(null);
            }}
          >
            Reset Session
          </button>
        </header>

        <SessionStageBar
          currentStage={sessionStage}
          learningGoal={learningGoal}
        />

        <div className="learn-page__grid">
          <ChatPanel
            messages={chatHistory}
            sessionStage={sessionStage}
            inputValue={inputValue}
            isSending={isSending}
            isEvaluating={isEvaluating}
            error={error}
            suggestedPrompts={SUGGESTED_PROMPTS}
            onInputChange={setInputValue}
            onSend={() => {
              void handleSend();
            }}
            onUsePrompt={handleUsePrompt}
            onEnterReflectMode={handleEnterReflectMode}
          />

          <CodeWorkspace
            selectedLanguage={selectedLanguage}
            currentCode={currentCode}
            runResult={runResult}
            runError={runError}
            outputText={outputText}
            isRunning={isRunning}
            theme={monacoTheme}
            onLanguageChange={changeLanguage}
            onCodeChange={setCurrentCode}
            onRun={() => {
              void runCurrentCode();
            }}
          />
        </div>
      </div>
    </PageLayout>
  );
}
