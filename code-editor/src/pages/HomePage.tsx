import { Link } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import "./HomePage.css";

export function HomePage() {
  return (
    <PageLayout>
      <div className="home-page">
        <section className="hero">
          <h1>Learn to Code</h1>
          <p>
            Master programming through hands-on practice. Write real code, run
            tests, and track your progress.
          </p>
          <Link to="/learn" className="hero-cta">
            Start Learning
          </Link>
        </section>
      </div>
    </PageLayout>
  );
}
