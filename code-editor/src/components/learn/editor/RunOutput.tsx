import type { SubmissionResult } from "../../../types";

interface RunOutputProps {
  runResult: SubmissionResult | null;
  runError: string | null;
  outputText: string | null;
}

export function RunOutput({ runResult, runError, outputText }: RunOutputProps) {
  if (!outputText) {
    return (
      <div className="learn-run-output empty">
        Run your code to see output and errors here.
      </div>
    );
  }

  const hasError = Boolean(
    runError || runResult?.stderr || runResult?.compile_output,
  );

  return (
    <div className={`learn-run-output ${hasError ? "error" : "success"}`}>
      <div className="learn-run-output__header">
        <span>{hasError ? "Error" : "Output"}</span>
        {runResult?.status?.description && (
          <span className="learn-run-output__status">
            {runResult.status.description}
          </span>
        )}
      </div>
      <pre>{outputText}</pre>
    </div>
  );
}
