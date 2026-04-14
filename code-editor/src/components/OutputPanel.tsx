import type { SubmissionResult } from "../types";
import { STATUS } from "../types";
import { Panel } from "./shared";
import "./OutputPanel.css";

interface OutputPanelProps {
  result: SubmissionResult | null;
  isRunning: boolean;
  error: string | null;
}

export function OutputPanel({ result, isRunning, error }: OutputPanelProps) {
  const getStatusClass = (statusId: number): string => {
    if (statusId === STATUS.ACCEPTED) return "status-success";
    if (statusId === STATUS.COMPILATION_ERROR) return "status-compile-error";
    if (
      statusId >= STATUS.RUNTIME_ERROR_SIGSEGV &&
      statusId <= STATUS.RUNTIME_ERROR_OTHER
    ) {
      return "status-runtime-error";
    }
    if (statusId === STATUS.TIME_LIMIT_EXCEEDED) return "status-tle";
    return "status-error";
  };

  const hasCompileError =
    result?.compile_output && result.status.id === STATUS.COMPILATION_ERROR;
  const hasRuntimeError =
    result?.stderr && result.status.id !== STATUS.ACCEPTED;

  return (
    <Panel
      header={{
        title: "Output",
        action:
          result && !isRunning && !error ? (
            <div className={`status-badge ${getStatusClass(result.status.id)}`}>
              {result.status.description}
            </div>
          ) : undefined,
      }}
      isLoading={isRunning}
      loadingMessage="Running..."
      isEmpty={!result && !error}
      emptyMessage="Run your code to see output here"
      className="output-panel"
    >
      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        result && (
          <>
            {hasCompileError && (
              <div className="output-section">
                <h4>Compilation Error</h4>
                <pre className="error-output">{result.compile_output}</pre>
              </div>
            )}

            {hasRuntimeError && (
              <div className="output-section">
                <h4>Error</h4>
                <pre className="error-output">{result.stderr}</pre>
              </div>
            )}

            {result.stdout && (
              <div className="output-section">
                <h4>Standard Output</h4>
                <pre className="stdout">{result.stdout}</pre>
              </div>
            )}

            {!result.stdout && !hasCompileError && !hasRuntimeError && (
              <div className="output-section">
                <pre className="stdout">(No output)</pre>
              </div>
            )}

            {result.time && result.memory && (
              <div className="execution-stats">
                <span>Time: {result.time}s</span>
                <span>Memory: {(result.memory / 1024).toFixed(2)} MB</span>
              </div>
            )}
          </>
        )
      )}
    </Panel>
  );
}
