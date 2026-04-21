/**
 * Agentic Challenge Page
 * Main page for prompt engineering (agentic) challenges
 * Students write prompts, AI generates code, tests validate output
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { CodeEditor } from "../components/CodeEditor";
import { TestCasesPanel } from "../components/learning/challenges/TestCasesPanel";
import { PromptInput } from "../components/learning/scoring/PromptInput";
import { AgentReasoningPanel } from "../components/learning/panels/AgentReasoningPanel";
import { ConversationHistory } from "../components/learning/chat/ConversationHistory";
import { TechniqueTagSelector } from "../components/learning/navigation/TechniqueTagSelector";
import { PromptScoreCard } from "../components/learning/scoring/PromptScoreCard";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/ThemeContext";
import { useAgenticChallenge } from "../hooks/useAgenticChallenge";
import { getChallengeById } from "../services/challenges";
import type { Challenge } from "../types/database";
import { LANGUAGES } from "../types";
import "./AgenticChallengePage.css";

export function AgenticChallengePage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { monacoTheme } = useTheme();

  // Challenge data (loaded separately)
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Score card visibility
  const [showScoreCard, setShowScoreCard] = useState(false);

  // Use the agentic challenge hook
  const {
    state,
    promptHistory,
    iterationsUsed,
    maxIterations,
    currentCode,
    currentReasoning,
    generationError,
    testResults,
    allTestsPassed,
    hintsUsed,
    hintsRemaining,
    revealedHints,
    evaluationResult,
    selectedTechniques,
    isGenerating,
    isRunning,
    isComplete,
    iterationsExhausted,
    error,
    submitPrompt,
    runTests,
    requestHint,
    setSelectedTechniques,
    completeAttempt,
    abandonAttempt,
  } = useAgenticChallenge({
    challenge,
    userId: user?.id,
    onComplete: () => setShowScoreCard(true),
    onAbandon: () => setShowScoreCard(true),
  });

  // Load challenge data
  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    async function loadChallenge() {
      if (!challengeId) return;

      setLoadingChallenge(true);
      setLoadError(null);

      try {
        const challengeData = await getChallengeById(challengeId);

        if (!challengeData) {
          setLoadError("Challenge not found");
          setLoadingChallenge(false);
          return;
        }

        // Verify this is an agentic challenge
        if (challengeData.challenge_mode !== "agentic") {
          navigate(`/challenge/${challengeId}`, { replace: true });
          return;
        }

        setChallenge(challengeData);
      } catch (err) {
        console.error("Error loading challenge:", err);
        setLoadError("Failed to load challenge");
      } finally {
        setLoadingChallenge(false);
      }
    }

    loadChallenge();
  }, [challengeId, user, navigate]);

  // Get language for editor
  const language = challenge
    ? LANGUAGES.find((l) => l.id === challenge.language_id)
    : LANGUAGES.find((l) => l.id === 93);

  // Loading state
  const isLoading =
    loadingChallenge || state === "loading" || state === "restoring";

  if (isLoading) {
    return (
      <PageLayout>
        <div className="agentic-challenge-page">
          <div className="challenge-loading">Loading challenge...</div>
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (loadError || error || !challenge) {
    return (
      <PageLayout>
        <div className="agentic-challenge-page">
          <div className="challenge-error">
            <h2>Challenge Not Available</h2>
            <p>{loadError || error || "Challenge not found"}</p>
            <button onClick={() => navigate(-1)}>Go Back</button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="agentic-challenge-page">
        {/* Header */}
        <header className="agentic-challenge-header">
          <div className="header-left">
            <button className="back-button" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <div className="challenge-info">
              <h1>{challenge.title}</h1>
              <span className="challenge-badge">Prompt Engineering</span>
            </div>
          </div>
          <div className="header-right">
            {/* Hints Status */}
            {challenge.hints && challenge.hints.length > 0 && (
              <div className="hints-status">
                <span className="hints-label">
                  💡 Hints: {hintsUsed}/{challenge.hints_allowed}
                </span>
                {hintsRemaining > 0 && !isComplete && (
                  <button className="hint-btn" onClick={requestHint}>
                    Use Hint (-{challenge.hint_penalty} pts)
                  </button>
                )}
              </div>
            )}
            <div className="iteration-counter">
              <span className="iteration-label">Iterations</span>
              <span
                className={`iteration-value ${iterationsExhausted ? "exhausted" : ""}`}
              >
                {iterationsUsed}/{maxIterations}
              </span>
            </div>
          </div>
        </header>

        {/* Revealed Hints Panel */}
        {revealedHints.length > 0 && (
          <div className="hints-panel">
            <div className="hints-panel-header">💡 Hints</div>
            <div className="hints-list">
              {revealedHints.map((hint, index) => (
                <div key={index} className="hint-item">
                  <span className="hint-number">{index + 1}.</span>
                  <p>{hint}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="agentic-challenge-content">
          {/* Left Panel - Prompt & Conversation */}
          <div className="prompt-panel">
            {/* Challenge Description */}
            <div className="challenge-description">
              <h3>Challenge</h3>
              <p>{challenge.description}</p>
            </div>

            {/* Prompt Input */}
            <PromptInput
              onSubmit={submitPrompt}
              isLoading={isGenerating}
              disabled={isComplete || iterationsExhausted}
              iterationsUsed={iterationsUsed}
              maxIterations={maxIterations}
              placeholder="Describe the code you want the AI to generate..."
            />

            {/* Error Display */}
            {generationError && (
              <div className="generation-error">
                <span className="error-icon">⚠️</span>
                <span>{generationError}</span>
              </div>
            )}

            {/* Agent Reasoning */}
            {(currentReasoning || isGenerating) && (
              <AgentReasoningPanel
                reasoning={currentReasoning}
                isLoading={isGenerating}
                iterationNumber={iterationsUsed}
              />
            )}

            {/* Conversation History */}
            <ConversationHistory
              history={promptHistory}
              currentIteration={iterationsUsed}
            />

            {/* Technique Tagging (shown when complete) */}
            {isComplete && (
              <TechniqueTagSelector
                selectedTechniques={selectedTechniques}
                onChange={setSelectedTechniques}
                detectedTechniques={
                  evaluationResult?.heuristics.techniquesDetected || []
                }
              />
            )}

            {/* Action Buttons */}
            <div className="action-buttons">
              {isComplete ? (
                <button
                  className="submit-button primary"
                  onClick={completeAttempt}
                >
                  Complete Challenge
                </button>
              ) : iterationsExhausted ? (
                <button
                  className="submit-button secondary"
                  onClick={abandonAttempt}
                >
                  View Results
                </button>
              ) : null}
            </div>
          </div>

          {/* Right Panel - Code & Tests */}
          <div className="code-panel">
            {/* Code Editor (Read-only) */}
            <div className="editor-container">
              <div className="editor-header">
                <span>Generated Code</span>
                <span className="editor-badge">Read Only</span>
              </div>
              <CodeEditor
                code={currentCode}
                language={language?.monacoLanguage || "javascript"}
                theme={monacoTheme}
                onChange={() => {}}
                readOnly={true}
              />
            </div>

            {/* Test Cases */}
            <div className="tests-container">
              <TestCasesPanel
                visibleTests={challenge.test_cases}
                visibleResults={testResults}
                hiddenPassed={0}
                hiddenTotal={0}
                isRunning={isRunning}
                allPassed={allTestsPassed}
              />
              <button
                className="run-tests-button"
                onClick={runTests}
                disabled={
                  isRunning ||
                  !currentCode ||
                  currentCode.includes("// Code will appear")
                }
              >
                {isRunning ? "Running..." : "Run Tests"}
              </button>
            </div>
          </div>
        </div>

        {/* Score Card Modal */}
        {showScoreCard && evaluationResult && (
          <PromptScoreCard
            scores={evaluationResult.scores}
            aiFeedback={evaluationResult.aiFeedback}
            referencePrompt={evaluationResult.referencePrompt}
            techniquesTags={selectedTechniques}
            testsPassed={allTestsPassed}
            onClose={() => {
              setShowScoreCard(false);
              navigate(-1);
            }}
          />
        )}
      </div>
    </PageLayout>
  );
}
