import type { TestCase } from "../../../types/database";
import { Panel } from "../../shared";
import "./challenges.css";

export interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  stderr: string | null;
  compileOutput: string | null;
}

interface TestCasesPanelProps {
  visibleTests: TestCase[];
  visibleResults: TestResult[];
  hiddenPassed: number;
  hiddenTotal: number;
  isRunning: boolean;
  allPassed: boolean;
}

export function TestCasesPanel({
  visibleTests,
  visibleResults,
  hiddenPassed,
  hiddenTotal,
  isRunning,
  allPassed,
}: TestCasesPanelProps) {
  const hasResults = visibleResults.length > 0;

  return (
    <Panel
      header={{
        title: "Test Cases",
        action:
          allPassed && !isRunning ? (
            <span className="all-passed-badge">✓ All Passed</span>
          ) : undefined,
      }}
      isLoading={isRunning}
      loadingMessage="Running tests..."
      isEmpty={!isRunning && visibleTests.length === 0}
      emptyMessage="No test cases for this lesson"
      className="test-cases-panel"
    >
      <div className="visible-tests">
        {visibleTests.map((test, index) => {
          const result = visibleResults[index];
          const status = result
            ? result.passed
              ? "passed"
              : "failed"
            : "pending";

          return (
            <div key={index} className={`test-case ${status}`}>
              <div className="test-case-header">
                <span className="test-number">Test {index + 1}</span>
                {result && (
                  <span className={`test-status ${status}`}>
                    {result.passed ? "✓ Passed" : "✗ Failed"}
                  </span>
                )}
              </div>

              <div className="test-case-body">
                <div className="test-row">
                  <span className="test-label">Input:</span>
                  <pre className="test-value">{test.input || "(none)"}</pre>
                </div>
                <div className="test-row">
                  <span className="test-label">Expected:</span>
                  <pre className="test-value">{test.expected_output}</pre>
                </div>
                {result && !result.passed && (
                  <div className="test-row actual">
                    <span className="test-label">Actual:</span>
                    <pre className="test-value error">
                      {result.actual || "(no output)"}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hiddenTotal > 0 && (
        <div className="hidden-tests-summary">
          <span className="hidden-icon">🔒</span>
          <span>
            Hidden tests:{" "}
            {hasResults ? `${hiddenPassed}/${hiddenTotal}` : hiddenTotal}
            {hasResults && hiddenPassed === hiddenTotal && " ✓"}
          </span>
        </div>
      )}
    </Panel>
  );
}
