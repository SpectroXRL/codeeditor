import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSubjects } from "../services/content";
import type { Subject } from "../types/database";
import { PageLayout } from "../components/layout/PageLayout";
import "./HomePage.css";

export function HomePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const data = await getSubjects();
        // Filter out agentic engineering - it has its own dedicated section
        const languageSubjects = data.filter(
          (s) => s.slug !== "agentic-engineering",
        );
        setSubjects(languageSubjects);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load subjects",
        );
      } finally {
        setLoading(false);
      }
    }

    loadSubjects();
  }, []);

  return (
    <PageLayout>
      <div className="home-page">
        <section className="hero">
          <h1>Learn to Code</h1>
          <p>
            Master programming through hands-on practice. Write real code, run
            tests, and track your progress.
          </p>
        </section>

        <section className="subjects-section">
          <h2>Available Courses</h2>

          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading courses...</p>
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

          {!loading && !error && subjects.length === 0 && (
            <div className="empty-state">
              <p>No courses available yet. Check back soon!</p>
            </div>
          )}

          {!loading && !error && subjects.length > 0 && (
            <div className="subjects-grid">
              {subjects.map((subject) => (
                <Link
                  key={subject.id}
                  to={`/subjects/${subject.id}`}
                  className="subject-card"
                >
                  <div className="subject-icon">
                    {getSubjectIcon(subject.name)}
                  </div>
                  <h3>{subject.name}</h3>
                  <p>{subject.description || "Start learning today"}</p>
                  <span className="subject-cta">Start Learning →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}

function getSubjectIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("javascript")) return "🟨";
  if (lower.includes("python")) return "🐍";
  if (lower.includes("java")) return "☕";
  if (lower.includes("typescript")) return "🔷";
  if (lower.includes("rust")) return "🦀";
  if (lower.includes("go")) return "🐹";
  if (lower.includes("c++") || lower.includes("cpp")) return "⚡";
  return "💻";
}
