import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { CodeEditor } from "../components/CodeEditor";
import {
  TestCasesPanel,
  type TestResult,
} from "../components/learning/TestCasesPanel";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/ThemeContext";
import { useChallenge, formatTime } from "../hooks/useChallenge";
import {
  getChallengeById,
  getChallengeForTopic,
  getChallengeForSubject,
  canAttemptChallenge,
  getUserBestAttempt,
  isTopicChallengeUnlocked,
  isSubjectChallengeUnlocked,
} from "../services/challenges";
import { runTestCases } from "../services/judge0";
import type { Challenge, ChallengeAttempt } from "../types/database";
import { LANGUAGES } from "../types";
import "./ChallengePage.css";

// Placeholder challenge for initial hook call
const EMPTY_CHALLENGE: Challenge = {
  id: "",
  topic_id: null,
  subject_id: null,
  challenge_type: "mini_boss",
  title: "",
  description: "",
  starter_code: "",
  test_cases: [],
  language_id: 71, // Python
  time_limit_seconds: 300,
  cooldown_seconds: 3600,
  max_score: 1000,
  hints_allowed: 2,
  hint_penalty: 50,
  hints: [],
  created_at: "",
};

export function ChallengePage() {
  const { challengeId, topicId, subjectId } = useParams<{
    challengeId?: string;
    topicId?: string;
    subjectId?: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { monacoTheme } = useTheme();

  // Challenge data
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [bestAttempt, setBestAttempt] = useState<ChallengeAttempt | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockChecked, setUnlockChecked] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<Date | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [code, setCode] = useState<string>("");

  // Test state
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [allPassed, setAllPassed] = useState(false);

  // Modal state
  const [showResults, setShowResults] = useState(false);
  const [completedAttempt, setCompletedAttempt] =
    useState<ChallengeAttempt | null>(null);

  // Handle challenge completion
  const handleComplete = useCallback(
    (attempt: ChallengeAttempt) => {
      setCompletedAttempt(attempt);
      setShowResults(true);
      // Update best if this is better
      const attemptScore = attempt.final_score ?? 0;
      const bestScore = bestAttempt?.final_score ?? 0;
      if (!bestAttempt || attemptScore > bestScore) {
        setBestAttempt(attempt);
      }
    },
    [bestAttempt],
  );

  const handleAbandon = useCallback(() => {
    setCooldownEnd(new Date(Date.now() + 60 * 60 * 1000)); // 1 hour cooldown
  }, []);

  // Use the challenge hook - called unconditionally with placeholder when not ready
  const challengeHook = useChallenge({
    challenge: challenge || EMPTY_CHALLENGE,
    userId: user?.id || "",
    onComplete: handleComplete,
    onAbandon: handleAbandon,
  });

  // Load challenge data
  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    async function loadChallenge() {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        let challengeData: Challenge | null = null;

        if (challengeId) {
          challengeData = await getChallengeById(challengeId);
        } else if (topicId) {
          challengeData = await getChallengeForTopic(topicId);
        } else if (subjectId) {
          challengeData = await getChallengeForSubject(subjectId);
        }

        if (!challengeData) {
          setError("Challenge not found");
          setLoading(false);
          return;
        }

        // Redirect to agentic challenge page if this is an agentic challenge
        if (challengeData.challenge_mode === "agentic") {
          navigate(`/agentic-challenge/${challengeData.id}`, { replace: true });
          return;
        }

        setChallenge(challengeData);
        setCode(challengeData.starter_code);

        // Check if unlocked
        let unlocked = false;
        if (challengeData.topic_id) {
          unlocked = await isTopicChallengeUnlocked(
            user.id,
            challengeData.topic_id,
          );
        } else if (challengeData.subject_id) {
          unlocked = await isSubjectChallengeUnlocked(
            user.id,
            challengeData.subject_id,
          );
        }
        setIsUnlocked(unlocked);
        setUnlockChecked(true);

        // Check cooldown
        const attemptability = await canAttemptChallenge(
          user.id,
          challengeData.id,
        );
        if (!attemptability.can_attempt && attemptability.cooldown_ends) {
          setCooldownEnd(new Date(attemptability.cooldown_ends));
        }

        // Get best attempt
        const best = await getUserBestAttempt(user.id, challengeData.id);
        setBestAttempt(best);
      } catch (err) {
        console.error("Error loading challenge:", err);
        setError("Failed to load challenge");
      } finally {
        setLoading(false);
      }
    }

    loadChallenge();
  }, [challengeId, topicId, subjectId, user, navigate]);

  // Run tests
  const handleRunTests = async () => {
    if (!challenge) return;

    setIsRunning(true);
    setTestResults([]);
    setAllPassed(false);

    try {
      const results = await runTestCases(
        code,
        challenge.language_id,
        challenge.test_cases,
      );
      setTestResults(results);
      setAllPassed(results.every((r) => r.passed));
    } catch (err) {
      console.error("Error running tests:", err);
    } finally {
      setIsRunning(false);
    }
  };

  // Handle challenge submission
  const handleSubmit = async () => {
    if (!challenge) return;

    // Run tests first if not done
    let currentResults = testResults;
    if (testResults.length === 0) {
      setIsRunning(true);
      try {
        currentResults = await runTestCases(
          code,
          challenge.language_id,
          challenge.test_cases,
        );
        setTestResults(currentResults);
        setAllPassed(currentResults.every((r) => r.passed));
      } finally {
        setIsRunning(false);
      }
    }

    const passed = currentResults.filter((r) => r.passed).length;
    const total = currentResults.length;

    await challengeHook.submitChallenge(code, passed, total);
  };

  // Get the language for the editor
  const language = challenge
    ? LANGUAGES.find((l) => l.id === challenge.language_id)
    : LANGUAGES.find((l) => l.id === 71); // Default to Python

  // Guard for loading/error states
  if (loading || !unlockChecked) {
    return (
      <PageLayout>
        <div className="challenge-page">
          <div className="challenge-loading">Loading challenge...</div>
        </div>
      </PageLayout>
    );
  }

  if (error || !challenge) {
    return (
      <PageLayout>
        <div className="challenge-page">
          <div className="challenge-error">
            <h2>Challenge Not Available</h2>
            <p>{error || "Challenge not found"}</p>
            <button onClick={() => navigate(-1)}>Go Back</button>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isUnlocked) {
    return (
      <PageLayout>
        <div className="challenge-page">
          <div className="challenge-locked">
            <div className="lock-icon">🔒</div>
            <h2>{challenge.title}</h2>
            <p>
              Complete all{" "}
              {challenge.challenge_type === "mini_boss"
                ? "subtopics"
                : "mini-bosses"}{" "}
              to unlock this challenge.
            </p>
            <button onClick={() => navigate(-1)}>Go Back</button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Check cooldown
  if (
    cooldownEnd &&
    new Date() < cooldownEnd &&
    challengeHook.state !== "active"
  ) {
    const timeLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000);
    return (
      <PageLayout>
        <div className="challenge-page">
          <div className="challenge-cooldown">
            <div className="cooldown-icon">⏳</div>
            <h2>{challenge.title}</h2>
            <p>
              You can attempt this challenge again in {timeLeft} minute
              {timeLeft !== 1 ? "s" : ""}.
            </p>
            {bestAttempt && (
              <div className="best-score">
                <p>
                  Your best score: <strong>{bestAttempt.final_score}</strong>
                </p>
              </div>
            )}
            <button onClick={() => navigate(-1)}>Go Back</button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="challenge-page">
        {/* Challenge Header */}
        <div className="challenge-header">
          <div className="challenge-info">
            <span className={`challenge-badge ${challenge.challenge_type}`}>
              {challenge.challenge_type === "mini_boss"
                ? "⚔️ Mini Boss"
                : "👑 Final Boss"}
            </span>
            <h1>{challenge.title}</h1>
          </div>

          {challengeHook.state === "active" && (
            <div className="challenge-status">
              <div
                className={`timer ${challengeHook.isOverTime ? "overtime" : ""}`}
              >
                <span className="timer-icon">⏱️</span>
                <span className="timer-value">
                  {formatTime(challengeHook.elapsedSeconds)}
                  {challengeHook.isOverTime && (
                    <span className="overtime-label"> (overtime)</span>
                  )}
                </span>
                <span className="timer-limit">
                  / {formatTime(challenge.time_limit_seconds)}
                </span>
              </div>

              <div className="hints-status">
                <span>
                  💡 Hints: {challengeHook.hintsRemaining}/
                  {challenge.hints_allowed}
                </span>
                {challengeHook.hintsRemaining > 0 && (
                  <button
                    className="hint-btn"
                    onClick={challengeHook.requestHint}
                  >
                    Use Hint (-{challenge.hint_penalty} pts)
                  </button>
                )}
              </div>
            </div>
          )}

          {bestAttempt && challengeHook.state !== "active" && (
            <div className="best-score-badge">
              🏆 Best: {bestAttempt.final_score}
            </div>
          )}
        </div>

        {/* Current Hint Display */}
        {challengeHook.currentHint && (
          <div className="hint-panel">
            <div className="hint-header">💡 Hint</div>
            <p>{challengeHook.currentHint}</p>
          </div>
        )}

        {/* Pre-challenge state */}
        {challengeHook.state === "ready" && (
          <div className="challenge-start-section">
            <div className="challenge-description">
              <h2>Challenge Description</h2>
              <p>{challenge.description}</p>
            </div>

            <div className="challenge-rules">
              <h3>Rules</h3>
              <ul>
                <li>
                  ⏱️ Time limit: {formatTime(challenge.time_limit_seconds)}{" "}
                  (soft limit - no bonus after)
                </li>
                <li>
                  💡 Hints available: {challenge.hints_allowed} (each costs{" "}
                  {challenge.hint_penalty} points)
                </li>
                <li>🔄 Cooldown: 1 hour between attempts</li>
                <li>⚠️ Abandoning counts as a failed attempt</li>
              </ul>
            </div>

            <button
              className="start-challenge-btn"
              onClick={challengeHook.startChallenge}
            >
              Start Challenge
            </button>
          </div>
        )}

        {/* Active challenge state */}
        {(challengeHook.state === "active" ||
          challengeHook.state === "submitting") && (
          <div className="challenge-workspace">
            <div className="workspace-left">
              <div className="problem-panel">
                <h3>Problem</h3>
                <p>{challenge.description}</p>
              </div>

              <TestCasesPanel
                visibleTests={challenge.test_cases}
                visibleResults={testResults}
                hiddenPassed={0}
                hiddenTotal={0}
                isRunning={isRunning}
                allPassed={allPassed}
              />

              <button
                className="run-tests-btn"
                onClick={handleRunTests}
                disabled={isRunning}
              >
                {isRunning ? "Running..." : "Run Tests"}
              </button>
            </div>

            <div className="workspace-right">
              <CodeEditor
                code={code}
                onChange={setCode}
                language={language || LANGUAGES[0]}
                theme={monacoTheme}
              />

              <div className="challenge-actions">
                <button
                  className="abandon-btn"
                  onClick={() => {
                    if (
                      confirm(
                        "Are you sure? This will count as a failed attempt.",
                      )
                    ) {
                      challengeHook.abandonChallenge();
                    }
                  }}
                  disabled={challengeHook.state === "submitting"}
                >
                  Abandon Challenge
                </button>

                <button
                  className="submit-btn"
                  onClick={handleSubmit}
                  disabled={challengeHook.state === "submitting"}
                >
                  {challengeHook.state === "submitting"
                    ? "Submitting..."
                    : "Submit Solution"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Modal */}
        {showResults && completedAttempt && (
          <div
            className="results-overlay"
            onClick={() => setShowResults(false)}
          >
            <div className="results-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Challenge Complete!</h2>

              <div className="score-breakdown">
                <div className="score-row">
                  <span>Tests Passed:</span>
                  <span>
                    {completedAttempt.tests_passed}/
                    {completedAttempt.tests_total}
                  </span>
                </div>
                <div className="score-row">
                  <span>Base Score:</span>
                  <span>{completedAttempt.base_score}</span>
                </div>
                <div className="score-row bonus">
                  <span>Time Bonus:</span>
                  <span>+{completedAttempt.time_bonus}</span>
                </div>
                {(completedAttempt.hint_penalty ?? 0) > 0 && (
                  <div className="score-row penalty">
                    <span>
                      Hint Penalty ({completedAttempt.hints_used} used):
                    </span>
                    <span>-{completedAttempt.hint_penalty}</span>
                  </div>
                )}
                <div className="score-row total">
                  <span>Final Score:</span>
                  <span>{completedAttempt.final_score}</span>
                </div>
              </div>

              <div className="results-actions">
                <button onClick={() => setShowResults(false)}>
                  View Solution
                </button>
                <button onClick={() => navigate(-1)}>Back to Learning</button>
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {challengeHook.error && (
          <div className="challenge-error-toast">{challengeHook.error}</div>
        )}
      </div>
    </PageLayout>
  );
}
