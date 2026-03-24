import { useEffect, useState, useCallback, useRef } from "react";
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
import { CodeEditor } from "../components/CodeEditor";
import { useAuth } from "../context/useAuth";
import { useRateLimit } from "../hooks/useRateLimit";
import {
  getSubjectById,
  getTopicsBySubject,
  getSubTopicsByTopic,
  getContentBySubTopic,
} from "../services/content";
import { getUserProgress, saveProgress } from "../services/progress";
import { runTestCases } from "../services/judge0";
import { generateErrorExplanation } from "../services/openai";
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

  // Loading states
  const [loadingSubject, setLoadingSubject] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  // Auto-save debounce ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

        // Set initial code
        if (contentData) {
          // Try to load saved progress if user is logged in
          if (user) {
            const progress = await getUserProgress(user.id, currentSubTopic.id);
            if (progress?.saved_code) {
              setCode(progress.saved_code);
            } else {
              setCode(contentData.starter_code);
            }
          } else {
            setCode(contentData.starter_code);
          }
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

        saveTimeoutRef.current = setTimeout(async () => {
          try {
            await saveProgress(
              user.id,
              selectedSubTopic.id,
              newCode,
              "in_progress",
            );
          } catch (error) {
            console.error("Error auto-saving:", error);
          }
        }, 2000); // Debounce for 2 seconds
      }
    },
    [user, selectedSubTopic],
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
        await saveProgress(user.id, selectedSubTopic.id, code, "completed");
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
            </div>
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
