import { Link } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import "./HomePage.css";

export function HomePage() {
  return (
    <PageLayout>
      <div className="home-page">
        <section className="hero">
          <div className="hero__heading">
            <h1>
              <span className="hero__learn-to">Learn To</span>
              <span className="hero__code">Code</span>
            </h1>
          </div>
          <div className="hero__right">
            <p>
              Master programming through hands-on practice. Write real code, run
              tests, and track your progress.
            </p>
            <Link to="/learn" className="hero-cta">
              Start Learning
            </Link>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
