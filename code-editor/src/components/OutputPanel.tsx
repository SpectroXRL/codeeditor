import type { SubmissionResult } from "../types";
import { STATUS } from "../types";

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

  if (isRunning) {
    return (
      <div className="output-panel">
        <div className="output-header">
          <h3>Output</h3>
        </div>
        <div className="output-content">
          <div className="running-indicator">
            <span className="spinner"></span>
            Running...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="output-panel">
        <div className="output-header">
          <h3>Output</h3>
        </div>
        <div className="output-content">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="output-panel">
        <div className="output-header">
          <h3>Output</h3>
        </div>
        <div className="output-content">
          <div className="placeholder">Run your code to see output here</div>
        </div>
      </div>
    );
  }

  const hasCompileError =
    result.compile_output && result.status.id === STATUS.COMPILATION_ERROR;
  const hasRuntimeError = result.stderr && result.status.id !== STATUS.ACCEPTED;

  return (
    <div className="output-panel">
      <div className="output-header">
        <h3>Output</h3>
        <div className={`status-badge ${getStatusClass(result.status.id)}`}>
          {result.status.description}
        </div>
      </div>

      <div className="output-content">
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
      </div>
    </div>
  );
}
