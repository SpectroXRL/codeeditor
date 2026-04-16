/**
 * Test Diff Panel
 * Shows before/after test results comparison for error recovery lessons
 * Highlights regressions (✓→✗) and improvements (✗→✓)
 */

import { useState } from "react";
import type { TestDiffData } from "../../types/database";
import "./TestDiffPanel.css";

interface TestDiffPanelProps {
  testDiff: TestDiffData;
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function TestDiffPanel({
  testDiff,
  title = "Test Results Comparison",
  collapsible = true,
  defaultExpanded = true,
}: TestDiffPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const { before, after, regressions, newlyPassing } = testDiff;

  // Summary stats
  const beforePassing = before.filter((t) => t.passed).length;
  const afterPassing = after.filter((t) => t.passed).length;
  const hasRegressions = regressions.length > 0;
  const hasImprovements = newlyPassing.length > 0;

  // Create a map for easy lookup
  const beforeMap = new Map(before.map((t) => [t.input, t.passed]));
  const afterMap = new Map(after.map((t) => [t.input, t.passed]));

  return (
    <div className={`test-diff-panel ${isExpanded ? "expanded" : "collapsed"}`}>
      {collapsible && (
        <button
          className="test-diff-header"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <div className="header-content">
            <span className="header-icon">📊</span>
            <span className="header-title">{title}</span>
            <div className="summary-badges">
              {hasRegressions && (
                <span className="badge regression">
                  {regressions.length} regression
                  {regressions.length !== 1 ? "s" : ""}
                </span>
              )}
              {hasImprovements && (
                <span className="badge improvement">
                  {newlyPassing.length} fixed
                </span>
              )}
            </div>
          </div>
          <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>
            ▼
          </span>
        </button>
      )}

      {(!collapsible || isExpanded) && (
        <div className="test-diff-content">
          {/* Summary Row */}
          <div className="summary-row">
            <div className="summary-item before">
              <span className="summary-label">Before Fix</span>
              <span className="summary-value">
                {beforePassing}/{before.length} passing
              </span>
            </div>
            <span className="summary-arrow">→</span>
            <div className="summary-item after">
              <span className="summary-label">After Fix</span>
              <span
                className={`summary-value ${afterPassing >= beforePassing ? "improved" : "regressed"}`}
              >
                {afterPassing}/{after.length} passing
              </span>
            </div>
          </div>

          {/* Test Results Table */}
          <div className="test-table-container">
            <table className="test-table">
              <thead>
                <tr>
                  <th className="col-status">Before</th>
                  <th className="col-input">Test Input</th>
                  <th className="col-expected">Expected</th>
                  <th className="col-status">After</th>
                  <th className="col-change">Change</th>
                </tr>
              </thead>
              <tbody>
                {after.map((test, index) => {
                  const wasPassingBefore = beforeMap.get(test.input) ?? false;
                  const isPassingNow = test.passed;

                  let changeStatus: "regression" | "improvement" | "same" =
                    "same";
                  if (wasPassingBefore && !isPassingNow)
                    changeStatus = "regression";
                  if (!wasPassingBefore && isPassingNow)
                    changeStatus = "improvement";

                  return (
                    <tr key={index} className={`test-row ${changeStatus}`}>
                      <td className="col-status">
                        <span
                          className={`status-icon ${wasPassingBefore ? "pass" : "fail"}`}
                        >
                          {wasPassingBefore ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="col-input">
                        <code>{truncate(test.input, 30)}</code>
                      </td>
                      <td className="col-expected">
                        <code>{truncate(test.expectedOutput, 20)}</code>
                      </td>
                      <td className="col-status">
                        <span
                          className={`status-icon ${isPassingNow ? "pass" : "fail"}`}
                        >
                          {isPassingNow ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="col-change">
                        {changeStatus === "regression" && (
                          <span className="change-badge regression">
                            ⚠️ Regression
                          </span>
                        )}
                        {changeStatus === "improvement" && (
                          <span className="change-badge improvement">
                            ✨ Fixed
                          </span>
                        )}
                        {changeStatus === "same" && (
                          <span className="change-badge same">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Warning for regressions */}
          {hasRegressions && (
            <div className="regression-warning">
              <span className="warning-icon">⚠️</span>
              <p>
                <strong>Regressions detected!</strong> {regressions.length} test
                {regressions.length !== 1 ? "s" : ""} that passed before now
                fail{regressions.length !== 1 ? "" : "s"}. Make sure your fix
                doesn't break existing functionality.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
