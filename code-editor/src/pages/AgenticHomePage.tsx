/**
 * Agentic Home Page
 * Landing page for the Prompt Engineering curriculum
 * Shows topics and lessons in a card-based layout
 */

import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { useAuth } from "../context/useAuth";
import {
  getAgenticCurriculum,
  type TopicWithLessons,
} from "../services/agenticLessons";
import { useProgressStore } from "../stores/progressStore";
import type { LessonType } from "../types/database";
import "./AgenticHomePage.css";

export function AgenticHomePage() {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState<TopicWithLessons[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Progress state
  const progress = useProgressStore((state) => state.progress);
  const hydrate = useProgressStore((state) => state.hydrate);

  // Check if a lesson is completed
  const isLessonCompleted = (lessonId: string) => {
    return progress[lessonId]?.status === "completed";
  };

  // Check if prompt engineering prerequisites are completed
  // Topics 1-4 are Prompt Engineering, Topic 5+ is Error Recovery
  const isPromptEngineeringComplete = useMemo(() => {
    // Get all lessons from topics 1-4 (Foundations, Core Techniques, Context Management, Iterative Refinement)
    const promptEngineeringTopics = curriculum.slice(0, 4);
    const allLessons = promptEngineeringTopics.flatMap((t) => t.lessons);

    if (allLessons.length === 0) return false;

    // Check if all lessons are completed
    return allLessons.every((lesson) => isLessonCompleted(lesson.id));
  }, [curriculum, progress]);

  // Check if a topic is error recovery (has lesson_type 'error_recovery')
  const isErrorRecoveryTopic = (
    topic: TopicWithLessons,
    topicIndex: number,
  ): boolean => {
    // Topics 5+ are error recovery, or check lesson_type if available
    if (topicIndex >= 4) return true;
    return topic.lessons.some(
      (lesson: { lesson_type?: LessonType }) =>
        lesson.lesson_type === "error_recovery",
    );
  };

  // Load curriculum
  useEffect(() => {
    async function loadCurriculum() {
      try {
        const data = await getAgenticCurriculum();
        setCurriculum(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load curriculum",
        );
      } finally {
        setLoading(false);
      }
    }

    loadCurriculum();
  }, []);

  // Hydrate progress when user is available
  useEffect(() => {
    if (user) {
      hydrate(user.id);
    }
  }, [user, hydrate]);

  return (
    <PageLayout>
      <div className="agentic-home">
        {/* Hero Section */}
        <section className="agentic-hero">
          <div className="hero-icon">🤖</div>
          <h1>Prompt Engineering</h1>
          <p>
            Learn to write effective prompts that generate working code. Master
            techniques like zero-shot, few-shot, and chain-of-thought prompting.
          </p>
          {!user && (
            <p className="hero-cta">
              Sign in to track your progress and save your work.
            </p>
          )}
        </section>

        {/* Curriculum Section */}
        <section className="curriculum-section">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading curriculum...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && curriculum.length === 0 && (
            <div className="empty-state">
              <p>Curriculum coming soon! Check back later.</p>
            </div>
          )}

          {!loading && !error && curriculum.length > 0 && (
            <div className="curriculum-grid">
              {curriculum.map((topic, topicIndex) => {
                const isErrorRecovery = isErrorRecoveryTopic(topic, topicIndex);
                const needsPrerequisite =
                  isErrorRecovery && !isPromptEngineeringComplete;

                return (
                  <div
                    key={topic.id}
                    className={`topic-card ${isErrorRecovery ? "error-recovery" : ""} ${needsPrerequisite ? "needs-prerequisite" : ""}`}
                  >
                    <div className="topic-header">
                      <span className="topic-number">{topicIndex + 1}</span>
                      <h2>{topic.name}</h2>
                      {isErrorRecovery && (
                        <span className="topic-badge error-recovery-badge">
                          🐛 Debug
                        </span>
                      )}
                    </div>

                    {needsPrerequisite && (
                      <div className="prerequisite-notice">
                        <span className="lock-icon">🔒</span>
                        <span>
                          Complete Prompt Engineering first for best results
                        </span>
                      </div>
                    )}

                    <div className="lessons-list">
                      {topic.lessons.length === 0 ? (
                        <p className="no-lessons">No lessons yet</p>
                      ) : (
                        topic.lessons.map((lesson, lessonIndex) => {
                          const completed = isLessonCompleted(lesson.id);
                          return (
                            <Link
                              key={lesson.id}
                              to={`/agentic/practice/${lesson.id}`}
                              className={`lesson-item ${completed ? "completed" : ""}`}
                            >
                              <span className="lesson-number">
                                {topicIndex + 1}.{lessonIndex + 1}
                              </span>
                              <span className="lesson-name">{lesson.name}</span>
                              {completed ? (
                                <span className="lesson-check">✓</span>
                              ) : (
                                <span className="lesson-arrow">→</span>
                              )}
                            </Link>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Info Section */}
        <section className="info-section">
          <h2>How It Works</h2>
          <div className="info-grid">
            <div className="info-card">
              <div className="info-icon">💬</div>
              <h3>Write Prompts</h3>
              <p>
                Describe the code you need in natural language. The AI will
                generate code based on your prompt.
              </p>
            </div>
            <div className="info-card">
              <div className="info-icon">🔄</div>
              <h3>Iterate & Refine</h3>
              <p>
                Refine your prompts to improve the generated code. Watch as the
                code evolves with each iteration.
              </p>
            </div>
            <div className="info-card">
              <div className="info-icon">▶️</div>
              <h3>Run & Test</h3>
              <p>
                Execute the generated code to see it in action. Verify it works
                as expected.
              </p>
            </div>
            <div className="info-card">
              <div className="info-icon">📊</div>
              <h3>Get Feedback</h3>
              <p>
                Receive scores and feedback on your prompting techniques. Learn
                what makes prompts effective.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
