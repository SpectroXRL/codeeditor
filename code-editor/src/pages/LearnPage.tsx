import { useCallback, useMemo, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { PageLayout } from "../components/layout/PageLayout";
import { ChatPanel } from "../components/learn/chat/ChatPanel";
import { CodeWorkspace } from "../components/learn/editor/CodeWorkspace";
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
    followUps,
    sessionStage,
    learningGoal,
    totalUserMessages,
    isSending,
    isEvaluating,
    error,
    sendMessage,
    triggerEvaluate,
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

  const handleSelectFollowUp = useCallback(
    (prompt: string) => {
      setInputValue("");
      void sendMessage({
        message: prompt,
        context: buildContext(prompt),
      });
    },
    [buildContext, sendMessage],
  );

  const headerCopy = useMemo(
    () =>
      totalUserMessages === 0
        ? "Ask your first coding-learning question to start the session."
        : `${totalUserMessages} prompt${totalUserMessages === 1 ? "" : "s"} sent in this session.`,
    [totalUserMessages],
  );

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "learn-page-split",
  });

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

        <Group
          className="learn-page__grid"
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel id="chat" defaultSize="40" minSize="25">
            <ChatPanel
              messages={chatHistory}
              sessionStage={sessionStage}
              learningGoal={learningGoal}
              inputValue={inputValue}
              isSending={isSending}
              isEvaluating={isEvaluating}
              error={error}
              suggestedPrompts={SUGGESTED_PROMPTS}
              followUps={followUps}
              onInputChange={setInputValue}
              onSend={() => {
                void handleSend();
              }}
              onUsePrompt={handleUsePrompt}
              onSelectFollowUp={handleSelectFollowUp}
            />
          </Panel>

          <Separator className="learn-page__resize-handle" />

          <Panel id="code" defaultSize="60" minSize="35">
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
          </Panel>
        </Group>
      </div>
    </PageLayout>
  );
}
