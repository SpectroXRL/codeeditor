import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { TopicDropdown } from "../components/learning/navigation/TopicDropdown";
import { SubTopicDropdown } from "../components/learning/navigation/SubTopicDropdown";
import { InformationPanel } from "../components/learning/panels/InformationPanel";
import {
  TestCasesPanel,
  type TestResult,
} from "../components/learning/challenges/TestCasesPanel";
import {
  TabbedSidebar,
  type SidebarTab,
} from "../components/learning/navigation/TabbedSidebar";
import { CodeEditor } from "../components/CodeEditor";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/ThemeContext";
import { useAIChatLimit } from "../hooks/useAIChatLimit";
import {
  getSubjectById,
  getTopicsBySubject,
  getSubTopicsByTopic,
  getContentBySubTopic,
} from "../services/content";
import { runTestCases } from "../services/judge0";
import { useSavedCode, useProgressActions } from "../stores/progressSelectors";
import type { Topic, SubTopic, Content } from "../types/database";
import { LANGUAGES } from "../types";
import "./SubjectPage.css";

export function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme, monacoTheme } = useTheme();

  // Rate limiting for AI chat
  const {
    canCall: canCallAI,
    callsUsed: aiCallsUsed,
    resetTime: aiResetTime,
    recordCall: recordAICall,
    maxCalls: aiMaxCalls,
  } = useAIChatLimit(user?.id || null);

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

  // Test state
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [hiddenPassed, setHiddenPassed] = useState(0);
  const [allPassed, setAllPassed] = useState(false);

  // Sidebar state (combined chat + hints)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");

  // Hints state
  const [hintsRevealed, setHintsRevealed] = useState(0);

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

  // Reset hints when lesson changes
  useEffect(() => {
    setHintsRevealed(0);
    setSidebarOpen(false);
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
    } catch (error) {
      console.error("Error running tests:", error);
    } finally {
      setIsRunning(false);
    }
  };

  // Toggle sidebar
  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Handle tab change
  const handleTabChange = useCallback((tab: SidebarTab) => {
    setActiveTab(tab);
  }, []);

  // Handle AI chat message sent (for rate limiting)
  const handleChatMessageSent = useCallback(() => {
    recordAICall();
  }, [recordAICall]);

  // Reveal next hint
  const handleRevealNextHint = useCallback(() => {
    setHintsRevealed((prev) => prev + 1);
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
      <div
        className={`subject-page ${theme} ${sidebarOpen ? "chat-open" : ""}`}
      >
        <div className="subject-toolbar">
          <div className="toolbar-left">
            <TopicDropdown
              topics={topics}
              selectedTopic={selectedTopic}
              onSelect={handleTopicChange}
              disabled={isRunning}
              subtopicIds={subtopicIds}
              userId={user?.id}
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
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              className={`chat-toggle-toolbar-btn ${sidebarOpen ? "active" : ""}`}
              onClick={handleToggleSidebar}
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? "✕" : "💬"}
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
          {/* Column 1: Lessons/Info */}
          <div className="lessons-column">
            <InformationPanel content={content} loading={loadingContent} />
          </div>

          {/* Column 2: Editor/Tests */}
          <div className="editor-column">
            <div className="code-area">
              <CodeEditor
                code={code}
                language={getMonacoLanguage()}
                theme={monacoTheme}
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
          </div>

          {/* Column 3: Sidebar (Chat + Hints) */}
          {sidebarOpen && (
            <div className="chat-column">
              <TabbedSidebar
                isOpen={sidebarOpen}
                onClose={handleToggleSidebar}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                code={code}
                lessonInfo={content?.information || ""}
                lessonTitle={content?.title || ""}
                testResults={testResults}
                isAuthenticated={!!user}
                canCall={canCallAI}
                callsUsed={aiCallsUsed}
                maxCalls={aiMaxCalls}
                resetTime={aiResetTime}
                onMessageSent={handleChatMessageSent}
                hints={content?.hints || []}
                hintsRevealed={hintsRevealed}
                onRevealNextHint={handleRevealNextHint}
              />
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
