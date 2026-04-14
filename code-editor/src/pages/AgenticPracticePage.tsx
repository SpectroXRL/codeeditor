/**
 * Agentic Practice Page
 * Two-panel layout: Chat (left) + Code (right)
 * Users write prompts, AI generates/refines code cumulatively
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { CodeEditor } from '../components/CodeEditor';
import { PromptScoreCard } from '../components/learning/PromptScoreCard';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/ThemeContext';
import { getAgenticLessonWithTopic } from '../services/agenticLessons';
import { runCode } from '../services/judge0';
import { useProgressActions } from '../stores/progressSelectors';
import type { Topic, SubTopic, Content } from '../types/database';
import type { ApiPromptScores, PromptTechnique } from '../types/database';
import './AgenticPracticePage.css';

interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  code?: string;
  reasoning?: string;
  feedback?: string;
  timestamp: Date;
}

export function AgenticPracticePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { monacoTheme } = useTheme();
  const { markComplete: markProgressComplete } = useProgressActions();

  // Lesson data
  const [lesson, setLesson] = useState<SubTopic | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Code state (cumulative)
  const [currentCode, setCurrentCode] = useState('// Your generated code will appear here\n');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [outputError, setOutputError] = useState<string | null>(null);

  // Completion state
  const [showCompletion, setShowCompletion] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    scores: ApiPromptScores;
    aiFeedback: string;
    techniques: PromptTechnique[];
  } | null>(null);

  // Load lesson data
  useEffect(() => {
    async function loadLesson() {
      if (!lessonId) {
        navigate('/agentic');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getAgenticLessonWithTopic(lessonId);
        if (!data) {
          setError('Lesson not found');
          setLoading(false);
          return;
        }

        setLesson(data.lesson);
        setTopic(data.topic);
        setContent(data.content);

        // Set starter code if available
        if (data.content?.starter_code) {
          setCurrentCode(data.content.starter_code);
        }
      } catch (err) {
        console.error('Error loading lesson:', err);
        setError('Failed to load lesson');
      } finally {
        setLoading(false);
      }
    }

    loadLesson();
  }, [lessonId, navigate]);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Handle prompt submission
  const handleSubmitPrompt = useCallback(async () => {
    if (!promptInput.trim() || isGenerating) return;

    const userPrompt = promptInput.trim();
    setPromptInput('');

    // Add user message to conversation
    const userTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userPrompt,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, userTurn]);
    setIsGenerating(true);

    try {
      // Build context from conversation history
      const conversationHistory = conversation.map(turn => ({
        role: turn.role,
        content: turn.role === 'user' ? turn.content : (turn.reasoning || turn.content),
      }));

      // Call generation API
      const response = await fetch('/api/agentic-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          currentCode,
          conversationHistory,
          lessonContext: content?.information || '',
          userId: user?.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate code');
      }

      const result = await response.json();

      // Update code (cumulative - AI returns the full updated code)
      if (result.generatedCode) {
        setCurrentCode(result.generatedCode);
      }

      // Add assistant response to conversation
      const assistantTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.message || 'Code updated successfully.',
        code: result.generatedCode,
        reasoning: result.reasoning,
        feedback: result.feedback,
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, assistantTurn]);

    } catch (err) {
      console.error('Generation error:', err);
      // Add error message to conversation
      const errorTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error generating code. Please try again.',
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, errorTurn]);
    } finally {
      setIsGenerating(false);
    }
  }, [promptInput, isGenerating, conversation, currentCode, content, user]);

  // Handle code execution
  const handleRunCode = useCallback(async () => {
    if (isRunning || !currentCode.trim()) return;

    setIsRunning(true);
    setOutput(null);
    setOutputError(null);

    try {
      // Default to JavaScript (language_id: 93)
      const languageId = content?.language_id || 93;
      const result = await runCode(currentCode, languageId);

      if (result.stderr) {
        setOutputError(result.stderr);
      } else if (result.compile_output) {
        setOutputError(result.compile_output);
      } else {
        setOutput(result.stdout || '(No output)');
      }
    } catch (err) {
      console.error('Execution error:', err);
      setOutputError('Failed to execute code');
    } finally {
      setIsRunning(false);
    }
  }, [currentCode, content, isRunning]);

  // Handle Enter key in prompt input
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmitPrompt();
    }
  }, [handleSubmitPrompt]);

  // Handle Mark Complete
  const handleMarkComplete = useCallback(async () => {
    if (conversation.length === 0) return;

    setIsEvaluating(true);

    try {
      // Build prompt history for evaluation
      const promptHistory = conversation
        .filter(turn => turn.role === 'user')
        .map((turn, index) => ({
          id: turn.id,
          prompt: turn.content,
          generatedCode: conversation.find(
            (t, i) => t.role === 'assistant' && i > conversation.indexOf(turn)
          )?.code || '',
          agentReasoning: conversation.find(
            (t, i) => t.role === 'assistant' && i > conversation.indexOf(turn)
          )?.reasoning || '',
          timestamp: turn.timestamp.toISOString(),
          iterationNumber: index + 1,
        }));

      // Call evaluation API
      const response = await fetch('/api/evaluate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptHistory,
          techniquesTags: [],
          testsPassed: true, // Practice mode - no tests
          maxIterations: 10,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setEvaluationResult({
          scores: result.scores,
          aiFeedback: result.aiFeedback,
          techniques: result.heuristics?.techniquesDetected || [],
        });
      } else {
        // Fallback scores if API fails
        setEvaluationResult({
          scores: {
            clarity: 75,
            efficiency: Math.max(20, 100 - (conversation.length * 10)),
            context: 70,
            technique: 60,
            final: 70,
          },
          aiFeedback: 'Great job practicing prompt engineering! Keep refining your prompts for better results.',
          techniques: [],
        });
      }

      // Mark progress as complete
      if (user && lessonId) {
        await markProgressComplete(user.id, lessonId, currentCode);
      }

      setShowCompletion(true);
    } catch (err) {
      console.error('Evaluation error:', err);
      // Show completion with default scores
      setEvaluationResult({
        scores: {
          clarity: 70,
          efficiency: 70,
          context: 70,
          technique: 70,
          final: 70,
        },
        aiFeedback: 'Lesson completed! Continue practicing to improve your prompt engineering skills.',
        techniques: [],
      });
      setShowCompletion(true);
    } finally {
      setIsEvaluating(false);
    }
  }, [conversation, user, lessonId, currentCode, markProgressComplete]);

  // Handle completion close
  const handleCloseCompletion = useCallback(() => {
    setShowCompletion(false);
    navigate('/agentic');
  }, [navigate]);

  // Loading state
  if (loading) {
    return (
      <PageLayout>
        <div className="agentic-practice-page">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading lesson...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (error || !lesson) {
    return (
      <PageLayout>
        <div className="agentic-practice-page">
          <div className="error-state">
            <h2>Lesson Not Available</h2>
            <p>{error || 'Lesson not found'}</p>
            <Link to="/agentic" className="back-link">← Back to Curriculum</Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="agentic-practice-page">
        {/* Header / Breadcrumb */}
        <header className="practice-header">
          <nav className="breadcrumb">
            <Link to="/agentic">Prompt Engineering</Link>
            <span className="separator">›</span>
            <span>{topic?.name}</span>
            <span className="separator">›</span>
            <span className="current">{lesson.name}</span>
          </nav>
        </header>

        {/* Lesson Info (collapsible) */}
        {content?.information && (
          <details className="lesson-info-panel">
            <summary>
              <span className="summary-icon">📚</span>
              <span>Lesson Information</span>
            </summary>
            <div className="lesson-info-content">
              <p>{content.information}</p>
            </div>
          </details>
        )}

        {/* Main Two-Panel Layout */}
        <div className="practice-panels">
          {/* Left Panel: Chat */}
          <div className="chat-panel">
            <div className="chat-header">
              <h3>💬 Conversation</h3>
              <span className="turn-count">{conversation.length} messages</span>
            </div>

            <div className="chat-messages">
              {conversation.length === 0 ? (
                <div className="chat-empty">
                  <div className="empty-icon">🤖</div>
                  <p>Start by describing what code you want to generate.</p>
                  <p className="hint">Be specific about inputs, outputs, and behavior.</p>
                </div>
              ) : (
                conversation.map(turn => (
                  <div key={turn.id} className={`chat-turn ${turn.role}`}>
                    <div className="turn-header">
                      <span className="turn-role">
                        {turn.role === 'user' ? '👤 You' : '🤖 AI'}
                      </span>
                      <span className="turn-time">
                        {turn.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="turn-content">{turn.content}</div>
                    
                    {turn.reasoning && (
                      <div className="turn-reasoning">
                        <strong>Reasoning:</strong> {turn.reasoning}
                      </div>
                    )}
                    
                    {turn.feedback && (
                      <div className="turn-feedback">
                        <span className="feedback-icon">💡</span>
                        {turn.feedback}
                      </div>
                    )}
                  </div>
                ))
              )}

              {isGenerating && (
                <div className="chat-turn assistant generating">
                  <div className="turn-header">
                    <span className="turn-role">🤖 AI</span>
                  </div>
                  <div className="turn-content">
                    <span className="typing-indicator">
                      <span></span><span></span><span></span>
                    </span>
                    Generating code...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Prompt Input */}
            <div className="prompt-input-area">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the code you want to generate... (Ctrl+Enter to send)"
                disabled={isGenerating}
                rows={3}
              />
              <button
                onClick={handleSubmitPrompt}
                disabled={isGenerating || !promptInput.trim()}
                className="send-button"
              >
                {isGenerating ? 'Generating...' : 'Send'}
              </button>
            </div>
          </div>

          {/* Right Panel: Code */}
          <div className="code-panel">
            <div className="code-header">
              <h3>📝 Generated Code</h3>
              <button
                onClick={handleRunCode}
                disabled={isRunning || !currentCode.trim()}
                className="run-button"
              >
                {isRunning ? '⏳ Running...' : '▶️ Run Code'}
              </button>
            </div>

            <div className="code-editor-wrapper">
              <CodeEditor
                code={currentCode}
                language="javascript"
                theme={monacoTheme}
                onChange={setCurrentCode}
                readOnly={false}
              />
            </div>

            {/* Output Panel */}
            {(output || outputError) && (
              <div className={`output-panel ${outputError ? 'error' : 'success'}`}>
                <div className="output-header">
                  <span>{outputError ? '❌ Error' : '✅ Output'}</span>
                  <button onClick={() => { setOutput(null); setOutputError(null); }}>×</button>
                </div>
                <pre className="output-content">
                  {outputError || output}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        {conversation.length > 0 && (
          <div className="practice-action-bar">
            <div className="action-bar-info">
              <span className="prompt-count">{Math.ceil(conversation.length / 2)} prompts submitted</span>
            </div>
            <button
              className="mark-complete-button"
              onClick={handleMarkComplete}
              disabled={isEvaluating || conversation.length === 0}
            >
              {isEvaluating ? '⏳ Evaluating...' : '✅ Mark Complete'}
            </button>
          </div>
        )}

        {/* Completion Modal */}
        {showCompletion && evaluationResult && (
          <PromptScoreCard
            scores={evaluationResult.scores}
            aiFeedback={evaluationResult.aiFeedback}
            referencePrompt={null}
            techniquesTags={evaluationResult.techniques}
            testsPassed={true}
            onClose={handleCloseCompletion}
          />
        )}
      </div>
    </PageLayout>
  );
}
