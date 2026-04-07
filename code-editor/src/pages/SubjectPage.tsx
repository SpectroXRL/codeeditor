import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { TopicDropdown } from "../components/learning/TopicDropdown";
import { SubTopicDropdown } from "../components/learning/SubTopicDropdown";
import { InformationPanel } from "../components/learning/InformationPanel";
import {
  TestCasesPanel,
  type TestResult,
} from "../components/learning/TestCasesPanel";
import { ErrorExplanationPanel } from "../components/learning/ErrorExplanationPanel";
import { TutorIndicator } from "../components/learning/TutorIndicator";
import { TutorPanel } from "../components/learning/TutorPanel";
import { ChallengeCard } from "../components/learning/ChallengeCard";
import { CodeEditor } from "../components/CodeEditor";
import { useAuth } from "../context/useAuth";
import { useRateLimit } from "../hooks/useRateLimit";
import { useTutorRateLimit } from "../hooks/useTutorRateLimit";
import { useCodeAnalysis } from "../hooks/useCodeAnalysis";
import {
  getSubjectById,
  getTopicsBySubject,
  getSubTopicsByTopic,
  getContentBySubTopic,
} from "../services/content";
import { runTestCases } from "../services/judge0";
import { useSavedCode, useProgressActions } from "../stores/progressSelectors";
import { generateErrorExplanation } from "../services/openai";
import {
  logAssistance,
  incrementAssistanceCount,
} from "../services/assistance";
import type { Topic, SubTopic, Content } from "../types/database";
import { LANGUAGES } from "../types";
import "./SubjectPage.css";

export function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Rate limiting for AI explanations
  const {
    canCall: canCallAI,
    callsUsed: aiCallsUsed,
    resetTime: aiResetTime,
    recordCall: recordAICall,
    maxCalls: aiMaxCalls,
  } = useRateLimit(user?.id || null);

  // Data state
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<SubTopic[]>([]);
  const [content, setContent] = useState<Content | null>(null);

  // Selection state
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedSubTopic, setSelectedSubTopic] = useState<SubTopic | null>(
    null,
  );

  // Editor state
  const [code, setCode] = useState<string>("");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");

  // Test state
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [hiddenPassed, setHiddenPassed] = useState(0);
  const [allPassed, setAllPassed] = useState(false);

  // AI Explanation state
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI Tutor state
  const [tutorPanelVisible, setTutorPanelVisible] = useState(false);
  const [isNewTip, setIsNewTip] = useState(false);

  // Rate limiting for AI tutor (separate from error explanations)
  const {
    canCall: canCallTutor,
    callsUsed: tutorCallsUsed,
    resetTime: tutorResetTime,
    recordCall: recordTutorCall,
    maxCalls: tutorMaxCalls,
  } = useTutorRateLimit(user?.id || null);

  // Loading states
  const [loadingSubject, setLoadingSubject] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  // Auto-save debounce ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Progress store
  const savedCode = useSavedCode(selectedSubTopic?.id);
  const { markComplete, saveCode: saveCodeToStore } = useProgressActions();

  // Memoize subtopicIds to prevent new array reference on every render
  const subtopicIds = useMemo(() => subtopics.map((s) => s.id), [subtopics]);

  // Code analysis for tutor hints
  const {
    issues: detectedIssues,
    hasTip,
    primaryIssue,
  } = useCodeAnalysis({
    code,
    languageId: content?.language_id || 71,
    starterCode: content?.starter_code || "",
    enabled: !!content && !!user,
  });

  // Track when new tips are detected
  const prevHasTipRef = useRef(false);
  useEffect(() => {
    if (hasTip && !prevHasTipRef.current) {
      setIsNewTip(true);
    }
    prevHasTipRef.current = hasTip;
  }, [hasTip]);

  // Reset tutor state when lesson changes
  useEffect(() => {
    setTutorPanelVisible(false);
    setIsNewTip(false);
  }, [selectedSubTopic?.id]);

  // Restore saved code from store when it becomes available
  useEffect(() => {
    if (savedCode && content) {
      setCode(savedCode);
    }
  }, [savedCode, content]);

  // Load subject and initial data
  useEffect(() => {
    if (!subjectId) {
      navigate("/");
      return;
    }

    async function loadInitialData() {
      if (!subjectId) return;

      setLoadingSubject(true);
      try {
        const subjectData = await getSubjectById(subjectId);
        if (!subjectData) {
          navigate("/");
          return;
        }

        const topicsData = await getTopicsBySubject(subjectId);
        setTopics(topicsData);

        // Select first topic by default
        if (topicsData.length > 0) {
          const firstTopic = topicsData[0];
          setSelectedTopic(firstTopic);

          // Load subtopics for first topic
          const subtopicsData = await getSubTopicsByTopic(firstTopic.id);
          setSubtopics(subtopicsData);

          // Select first subtopic by default
          if (subtopicsData.length > 0) {
            setSelectedSubTopic(subtopicsData[0]);
          }
        }
      } catch (error) {
        console.error("Error loading subject:", error);
        navigate("/");
      } finally {
        setLoadingSubject(false);
      }
    }

    loadInitialData();
  }, [subjectId, navigate]);

  // Load content when subtopic changes
  useEffect(() => {
    if (!selectedSubTopic) {
      setContent(null);
      return;
    }

    const currentSubTopic = selectedSubTopic;

    async function loadContent() {
      setLoadingContent(true);
      setTestResults([]);
      setHiddenPassed(0);
      setAllPassed(false);
      // Clear AI state when changing lessons
      setAiExplanation(null);
      setAiLoading(false);
      setAiError(null);

      try {
        const contentData = await getContentBySubTopic(currentSubTopic.id);
        setContent(contentData);

        // Set initial code - starter code is set here, saved code is handled via effect below
        if (contentData) {
          setCode(contentData.starter_code);
        }
      } catch (error) {
        console.error("Error loading content:", error);
      } finally {
        setLoadingContent(false);
      }
    }

    loadContent();
  }, [selectedSubTopic, user]);

  // Handle topic change
  const handleTopicChange = async (topic: Topic) => {
    setSelectedTopic(topic);
    setSelectedSubTopic(null);
    setContent(null);

    const subtopicsData = await getSubTopicsByTopic(topic.id);
    setSubtopics(subtopicsData);

    if (subtopicsData.length > 0) {
      setSelectedSubTopic(subtopicsData[0]);
    }
  };

  // Handle subtopic change
  const handleSubTopicChange = (subtopic: SubTopic) => {
    setSelectedSubTopic(subtopic);
  };

  // Handle code change with auto-save
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);

      // Auto-save for logged in users
      if (user && selectedSubTopic) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
          saveCodeToStore(user.id, selectedSubTopic.id, newCode);
        }, 2000); // Debounce for 2 seconds
      }
    },
    [user, selectedSubTopic, saveCodeToStore],
  );

  // Run tests
  const handleRunTests = async () => {
    if (!content || isRunning) return;

    setIsRunning(true);
    setTestResults([]);
    setHiddenPassed(0);
    setAllPassed(false);
    // Clear previous AI explanation
    setAiExplanation(null);
    setAiError(null);

    try {
      const allTests = [
        ...content.test_cases_visible,
        ...content.test_cases_hidden,
      ];

      const results = await runTestCases(code, content.language_id, allTests);

      // Split results between visible and hidden
      const visibleCount = content.test_cases_visible.length;
      const visibleResults = results.slice(0, visibleCount);
      const hiddenResults = results.slice(visibleCount);

      setTestResults(visibleResults);
      setHiddenPassed(hiddenResults.filter((r) => r.passed).length);

      const allTestsPassed = results.every((r) => r.passed);
      setAllPassed(allTestsPassed);

      // Update progress if all tests pass
      if (allTestsPassed && user && selectedSubTopic) {
        markComplete(user.id, selectedSubTopic.id, code);
      }

      // Trigger AI explanation if tests failed and user is authenticated
      if (!allTestsPassed && user && canCallAI) {
        const firstFailedTest = results.find((r) => !r.passed);
        if (firstFailedTest) {
          fetchAIExplanation(firstFailedTest);
        }
      }
    } catch (error) {
      console.error("Error running tests:", error);
    } finally {
      setIsRunning(false);
    }
  };

  // Fetch AI explanation for a failed test
  const fetchAIExplanation = async (failedTest: TestResult) => {
    if (!content) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const language = LANGUAGES.find((l) => l.id === content.language_id);
      const explanation = await generateErrorExplanation({
        code,
        expected: failedTest.expected,
        actual: failedTest.actual,
        stderr: failedTest.stderr,
        compileOutput: failedTest.compileOutput,
        language: language?.name || "Unknown",
      });

      recordAICall();
      setAiExplanation(explanation);
    } catch (error) {
      console.error("Error generating AI explanation:", error);
      setAiError(
        error instanceof Error
          ? error.message
          : "Failed to generate explanation",
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Retry AI explanation
  const handleRetryExplanation = () => {
    const firstFailedTest = testResults.find((r) => !r.passed);
    if (firstFailedTest && canCallAI) {
      fetchAIExplanation(firstFailedTest);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"));
  };

  // Handle tutor indicator click
  const handleTutorIndicatorClick = useCallback(() => {
    setTutorPanelVisible(true);
    setIsNewTip(false);
  }, []);

  // Handle tutor assistance used
  const handleTutorAssistanceUsed = useCallback(() => {
    recordTutorCall();

    // Log to database if user is authenticated
    if (user && selectedSubTopic && primaryIssue) {
      logAssistance({
        userId: user.id,
        subtopicId: selectedSubTopic.id,
        assistanceTier: primaryIssue.suggestedTier,
        issueType: primaryIssue.type,
        codeSnippet: code.slice(0, 500), // Truncate for storage
      }).catch(console.error);

      incrementAssistanceCount(user.id, selectedSubTopic.id).catch(
        console.error,
      );
    }
  }, [user, selectedSubTopic, primaryIssue, code, recordTutorCall]);

  // Close tutor panel
  const handleCloseTutorPanel = useCallback(() => {
    setTutorPanelVisible(false);
  }, []);

  // Get language for Monaco
  const getMonacoLanguage = () => {
    if (!content) return LANGUAGES[0];
    const lang = LANGUAGES.find((l) => l.id === content.language_id);
    return lang || LANGUAGES[0];
  };

  if (loadingSubject) {
    return (
      <PageLayout>
        <div className="subject-loading">
          <div className="spinner"></div>
          <p>Loading course...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className={`subject-page ${theme}`}>
        <div className="subject-toolbar">
          <div className="toolbar-left">
            <TopicDropdown
              topics={topics}
              selectedTopic={selectedTopic}
              onSelect={handleTopicChange}
              disabled={isRunning}
            />
            <SubTopicDropdown
              subtopics={subtopics}
              selectedSubTopic={selectedSubTopic}
              onSelect={handleSubTopicChange}
              disabled={isRunning}
            />
            {user && selectedTopic && (
              <div className="challenge-card-wrapper">
                <ChallengeCard
                  type="mini_boss"
                  topicId={selectedTopic.id}
                  userId={user.id}
                  topicName={selectedTopic.name}
                  subtopicIds={subtopicIds}
                />
              </div>
            )}
          </div>
          <div className="toolbar-right">
            <button className="theme-btn" onClick={toggleTheme}>
              {theme === "vs-dark" ? "☀️" : "🌙"}
            </button>
            <button
              className="run-btn"
              onClick={handleRunTests}
              disabled={isRunning || !content}
            >
              {isRunning ? "Running..." : "▶ Run Tests"}
            </button>
          </div>
        </div>

        <div className="subject-content">
          <div className="info-section">
            <InformationPanel content={content} loading={loadingContent} />
          </div>

          <div className="editor-section">
            <div className="code-area">
              <CodeEditor
                code={code}
                language={getMonacoLanguage()}
                theme={theme}
                onChange={handleCodeChange}
                disabled={isRunning}
              />
              <TutorIndicator
                hasTip={hasTip}
                primaryIssue={primaryIssue}
                onClick={handleTutorIndicatorClick}
                isNew={isNewTip}
              />
            </div>
            <TutorPanel
              content={content}
              code={code}
              language={getMonacoLanguage().name}
              detectedIssues={detectedIssues}
              isAuthenticated={!!user}
              canCall={canCallTutor}
              callsUsed={tutorCallsUsed}
              maxCalls={tutorMaxCalls}
              resetTime={tutorResetTime}
              onAssistanceUsed={handleTutorAssistanceUsed}
              isVisible={tutorPanelVisible}
              onClose={handleCloseTutorPanel}
            />
            <TestCasesPanel
              visibleTests={content?.test_cases_visible || []}
              visibleResults={testResults}
              hiddenPassed={hiddenPassed}
              hiddenTotal={content?.test_cases_hidden?.length || 0}
              isRunning={isRunning}
              allPassed={allPassed}
            />
            <ErrorExplanationPanel
              explanation={aiExplanation}
              isLoading={aiLoading}
              error={aiError}
              isAuthenticated={!!user}
              canCall={canCallAI}
              callsUsed={aiCallsUsed}
              maxCalls={aiMaxCalls}
              resetTime={aiResetTime}
              onRetry={handleRetryExplanation}
              hasFailedTests={testResults.some((r) => !r.passed)}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
