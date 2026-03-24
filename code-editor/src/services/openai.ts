export interface ErrorExplanationParams {
  code: string;
  expected: string;
  actual: string;
  stderr: string | null;
  compileOutput: string | null;
  language: string;
}

export async function generateErrorExplanation(
  params: ErrorExplanationParams
): Promise<string> {
  try {
    const response = await fetch("/api/explain-error", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Failed to generate explanation" }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.explanation;
  } catch (error) {
    console.error("Error explanation API error:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to generate explanation. Please try again.");
  }
}
