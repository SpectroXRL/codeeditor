const API_URL = "https://judge0-ce.p.rapidapi.com";
const API_HOST = "judge0-ce.p.rapidapi.com";

interface SubmissionResponse {
  token: string;
}

export interface SubmissionResult {
  token: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
}

const STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
};

function getJudge0ApiKey(): string {
  const apiKey = process.env.JUDGE0_API_KEY;
  if (!apiKey) {
    throw new Error("JUDGE0_API_KEY not configured");
  }

  return apiKey;
}

export function isJudge0Configured(): boolean {
  return Boolean(process.env.JUDGE0_API_KEY);
}

export async function submitCode(
  sourceCode: string,
  languageId: number,
  stdin: string,
): Promise<string> {
  const response = await fetch(
    `${API_URL}/submissions?base64_encoded=false&wait=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": getJudge0ApiKey(),
        "X-RapidAPI-Host": API_HOST,
      },
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: languageId,
        stdin,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Submission failed: ${response.status} - ${error}`);
  }

  const data: SubmissionResponse = await response.json();
  return data.token;
}

export async function getSubmission(token: string): Promise<SubmissionResult> {
  const response = await fetch(
    `${API_URL}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,status,compile_output,message,time,memory`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": getJudge0ApiKey(),
        "X-RapidAPI-Host": API_HOST,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get submission: ${response.status} - ${error}`);
  }

  const data: SubmissionResult = await response.json();
  return { ...data, token };
}

export async function pollForResult(
  token: string,
  maxAttempts: number = 30,
  intervalMs: number = 1000,
): Promise<SubmissionResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await getSubmission(token);

    if (result.status.id > STATUS.PROCESSING) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Execution timed out - max polling attempts reached");
}
