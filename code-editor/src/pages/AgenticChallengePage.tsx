/**
 * Agentic Challenge Page
 * Main page for prompt engineering (agentic) challenges
 * Students write prompts, AI generates code, tests validate output
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { CodeEditor } from "../components/CodeEditor";
import {
  TestCasesPanel,
  type TestResult,
} from "../components/learning/TestCasesPanel";
import { PromptInput } from "../components/learning/PromptInput";
import { AgentReasoningPanel } from "../components/learning/AgentReasoningPanel";
import { ConversationHistory } from "../components/learning/ConversationHistory";
import { TechniqueTagSelector } from "../components/learning/TechniqueTagSelector";
import { PromptScoreCard } from "../components/learning/PromptScoreCard";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/ThemeContext";
import { getChallengeById } from "../services/challenges";
import { runTestCases } from "../services/judge0";
import {
  startAgenticAttempt,
  getInProgressAgenticAttempt,
  submitPrompt,
  addPromptTurn,
  tagTechniques,
  completeAgenticAttempt,
  abandonAgenticAttempt,
  evaluatePrompts,
  savePromptScores,
  logPromptValidation,
} from "../services/agenticChallenges";
import {
  validatePrompt,
  getSafeBlockMessage,
} from "../services/inputSanitizer";
import type { Challenge, PromptTurn, PromptTechnique } from "../types/database";
import { LANGUAGES } from "../types";
import "./AgenticChallengePage.css";

export function AgenticChallengePage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { monacoTheme } = useTheme();

  // Challenge data
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Attempt state
  const [challengeAttemptId, setChallengeAttemptId] = useState<string | null>(
    null,
  );
  const [agenticAttemptId, setAgenticAttemptId] = useState<string | null>(null);
  const [promptHistory, setPromptHistory] = useState<PromptTurn[]>([]);
  const [iterationsUsed, setIterationsUsed] = useState(0);
  const maxIterations = challenge?.max_iterations || 5;

  // Current generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [currentReasoning, setCurrentReasoning] = useState("");
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Test state
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [allPassed, setAllPassed] = useState(false);

  // Completion state
  const [isComplete, setIsComplete] = useState(false);
  const [selectedTechniques, setSelectedTechniques] = useState<
    PromptTechnique[]
  >([]);
  const [showScoreCard, setShowScoreCard] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    scores: {
      clarity: number;
      efficiency: number;
      context: number;
      technique: number;
      final: number;
    };
    aiFeedback: string;
    heuristics: { techniquesDetected: PromptTechnique[] };
    referencePrompt: string | null;
  } | null>(null);

  // Load challenge
  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    async function loadChallenge() {
      if (!challengeId || !user) return;

      setLoading(true);
      setError(null);

      try {
        const challengeData = await getChallengeById(challengeId);

        if (!challengeData) {
          setError("Challenge not found");
          setLoading(false);
          return;
        }

        // Verify this is an agentic challenge
        if (challengeData.challenge_mode !== "agentic") {
          // Redirect to regular challenge page
          navigate(`/challenge/${challengeId}`, { replace: true });
          return;
        }

        setChallenge(challengeData);
        setCurrentCode(
          challengeData.starter_code ||
            "// Code will appear here after you submit a prompt",
        );

        // Check for existing in-progress attempt
        const existingAttempt = await getInProgressAgenticAttempt(
          challengeId,
          user.id,
        );

        if (existingAttempt) {
          setAgenticAttemptId(existingAttempt.id);
          setChallengeAttemptId(existingAttempt.challenge_attempt_id);
          setPromptHistory(existingAttempt.prompt_history as PromptTurn[]);
          setIterationsUsed(existingAttempt.iterations_used);

          // Restore last generated code
          const lastTurn = existingAttempt.prompt_history[
            existingAttempt.prompt_history.length - 1
          ] as PromptTurn | undefined;
          if (lastTurn) {
            setCurrentCode(lastTurn.generatedCode);
            setCurrentReasoning(lastTurn.agentReasoning);
          }
        } else {
          // Start a new attempt
          const newAttempt = await startAgenticAttempt(challengeId, user.id);
          if (newAttempt) {
            setChallengeAttemptId(newAttempt.challengeAttemptId);
            setAgenticAttemptId(newAttempt.agenticAttemptId);
          } else {
            setError("Failed to start challenge attempt");
          }
        }
      } catch (err) {
        console.error("Error loading challenge:", err);
        setError("Failed to load challenge");
      } finally {
        setLoading(false);
      }
    }

    loadChallenge();
  }, [challengeId, user, navigate]);

  // Handle prompt submission
  const handlePromptSubmit = useCallback(
    async (prompt: string) => {
      if (!challenge || !agenticAttemptId || !user || isGenerating) return;

      // Client-side validation
      const validation = validatePrompt(prompt);

      // Log validation
      logPromptValidation(
        user.id,
        agenticAttemptId,
        prompt,
        validation.valid ? "passed" : "blocked",
        validation.blockedReason || null,
        validation.riskLevel || "low",
      );

      if (!validation.valid) {
        setGenerationError(getSafeBlockMessage(validation.blockedReason || ""));
        return;
      }

      setIsGenerating(true);
      setGenerationError(null);
      setCurrentReasoning("");

      try {
        const result = await submitPrompt({
          attemptId: agenticAttemptId,
          prompt: validation.sanitized,
          conversationHistory: promptHistory,
          challengeContext: {
            title: challenge.title,
            description: challenge.description,
            testCases: challenge.test_cases,
            language:
              challenge.language_id === 93 ? "javascript" : "typescript",
            starterCode: challenge.starter_code,
          },
        });

        if (!result.success) {
          if (result.error.blockedReason) {
            setGenerationError(result.error.blockedReason);
          } else {
            setGenerationError(result.error.error);
          }
          return;
        }

        const {
          turnId,
          generatedCode,
          agentReasoning,
          iterationNumber,
          timestamp,
        } = result.data;

        // Create the turn record
        const newTurn: PromptTurn = {
          id: turnId,
          prompt: validation.sanitized,
          generatedCode,
          agentReasoning,
          timestamp,
          iterationNumber,
        };

        // Update local state
        setCurrentCode(generatedCode);
        setCurrentReasoning(agentReasoning);
        setPromptHistory((prev) => [...prev, newTurn]);
        setIterationsUsed(iterationNumber);
        setTestResults([]); // Clear previous test results

        // Persist to database
        await addPromptTurn(agenticAttemptId, newTurn);
      } catch (err) {
        console.error("Generation error:", err);
        setGenerationError("Failed to generate code. Please try again.");
      } finally {
        setIsGenerating(false);
      }
    },
    [challenge, agenticAttemptId, user, isGenerating, promptHistory],
  );

  // Run tests
  const handleRunTests = useCallback(async () => {
    if (!challenge || !currentCode) return;

    setIsRunning(true);
    setTestResults([]);

    try {
      const results = await runTestCases(
        currentCode,
        challenge.language_id,
        challenge.test_cases,
      );
      setTestResults(results);

      const passed = results.every((r) => r.passed);
      setAllPassed(passed);

      if (passed) {
        setIsComplete(true);
      }
    } catch (err) {
      console.error("Error running tests:", err);
    } finally {
      setIsRunning(false);
    }
  }, [challenge, currentCode]);

  // Handle final submission (after tests pass)
  const handleFinalSubmit = useCallback(async () => {
    if (!challengeAttemptId || !agenticAttemptId || !challenge) return;

    // Save tagged techniques
    await tagTechniques(agenticAttemptId, selectedTechniques);

    // Evaluate prompts
    const evaluation = await evaluatePrompts(
      promptHistory,
      selectedTechniques,
      allPassed,
      maxIterations,
      challenge.reference_prompt || undefined,
    );

    if (evaluation) {
      setEvaluationResult({
        scores: evaluation.scores,
        aiFeedback: evaluation.aiFeedback,
        heuristics: {
          techniquesDetected: evaluation.heuristics.techniquesDetected,
        },
        referencePrompt: evaluation.referencePrompt,
      });

      // Save scores
      await savePromptScores(agenticAttemptId, evaluation);
    }

    // Complete the attempt
    const passed = testResults.filter((r) => r.passed).length;
    const total = testResults.length;
    await completeAgenticAttempt(
      challengeAttemptId,
      agenticAttemptId,
      passed,
      total,
      currentCode,
    );

    setShowScoreCard(true);
  }, [
    challengeAttemptId,
    agenticAttemptId,
    challenge,
    selectedTechniques,
    promptHistory,
    allPassed,
    maxIterations,
    testResults,
    currentCode,
  ]);

  // Handle giving up / exhausted iterations
  const handleAbandon = useCallback(async () => {
    if (!challengeAttemptId || !agenticAttemptId || !challenge) return;

    // Still evaluate the prompts for learning
    const evaluation = await evaluatePrompts(
      promptHistory,
      selectedTechniques,
      false, // tests didn't pass
      maxIterations,
      challenge.reference_prompt || undefined,
    );

    if (evaluation) {
      setEvaluationResult({
        scores: evaluation.scores,
        aiFeedback: evaluation.aiFeedback,
        heuristics: {
          techniquesDetected: evaluation.heuristics.techniquesDetected,
        },
        referencePrompt: evaluation.referencePrompt,
      });

      await savePromptScores(agenticAttemptId, evaluation);
    }

    await abandonAgenticAttempt(challengeAttemptId, currentCode);
    setShowScoreCard(true);
  }, [
    challengeAttemptId,
    agenticAttemptId,
    challenge,
    promptHistory,
    selectedTechniques,
    maxIterations,
    currentCode,
  ]);

  // Check if iterations exhausted
  const iterationsExhausted = iterationsUsed >= maxIterations;

  // Get language for editor
  const language = challenge
    ? LANGUAGES.find((l) => l.id === challenge.language_id)
    : LANGUAGES.find((l) => l.id === 93); // Default to JavaScript

  // Loading state
  if (loading) {
    return (
      <PageLayout>
        <div className="agentic-challenge-page">
          <div className="challenge-loading">Loading challenge...</div>
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (error || !challenge) {
    return (
      <PageLayout>
        <div className="agentic-challenge-page">
          <div className="challenge-error">
            <h2>Challenge Not Available</h2>
            <p>{error || "Challenge not found"}</p>
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
              onSubmit={handlePromptSubmit}
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
                  onClick={handleFinalSubmit}
                >
                  Complete Challenge
                </button>
              ) : iterationsExhausted ? (
                <button
                  className="submit-button secondary"
                  onClick={handleAbandon}
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
                onChange={() => {}} // Read-only, but need onChange prop
                readOnly={true}
              />
            </div>

            {/* Test Cases */}
            <div className="tests-container">
              <TestCasesPanel
                testCases={challenge.test_cases}
                results={testResults}
                isRunning={isRunning}
              />
              <button
                className="run-tests-button"
                onClick={handleRunTests}
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
            testsPassed={allPassed}
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
