import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkRateLimit, getRequestIdentity } from "./shared/rateLimit.js";
import { validateExecutionRequest } from "./shared/validator.js";

const API_URL = "https://judge0-ce.p.rapidapi.com";
const API_KEY = process.env.JUDGE0_API_KEY;
const API_HOST = "judge0-ce.p.rapidapi.com";

interface SubmissionResponse {
  token: string;
}

interface SubmissionResult {
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

async function submitCode(
  sourceCode: string,
  languageId: number,
  stdin: string
): Promise<string> {
  const response = await fetch(
    `${API_URL}/submissions?base64_encoded=false&wait=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": API_KEY!,
        "X-RapidAPI-Host": API_HOST,
      },
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Submission failed: ${response.status} - ${error}`);
  }

  const data: SubmissionResponse = await response.json();
  return data.token;
}

async function getSubmission(token: string): Promise<SubmissionResult> {
  const response = await fetch(
    `${API_URL}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,status,compile_output,message,time,memory`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": API_KEY!,
        "X-RapidAPI-Host": API_HOST,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get submission: ${response.status} - ${error}`);
  }

  const data: SubmissionResult = await response.json();
  return { ...data, token };
}

async function pollForResult(
  token: string,
  maxAttempts: number = 30,
  intervalMs: number = 1000
): Promise<SubmissionResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await getSubmission(token);

    // Check if processing is complete (status > 2 means done)
    if (result.status.id > STATUS.PROCESSING) {
      return result;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Execution timed out - max polling attempts reached");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate API key is configured
  if (!API_KEY) {
    console.error("JUDGE0_API_KEY not configured");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const identity = getRequestIdentity(req.headers["x-forwarded-for"]);
  const rate = checkRateLimit(`execute-code:${identity}`, 80, 60 * 60 * 1000);
  if (!rate.allowed) {
    res.setHeader("Retry-After", rate.retryAfterSeconds.toString());
    return res.status(429).json({
      error: "Rate limit exceeded. Please try again later.",
    });
  }

  try {
    const { sourceCode, languageId, stdin = "" } = req.body;

    // Validate required fields
    if (!sourceCode || typeof sourceCode !== "string") {
      return res.status(400).json({ error: "sourceCode is required" });
    }
    if (!languageId || typeof languageId !== "number") {
      return res.status(400).json({ error: "languageId is required" });
    }

    const executionValidation = validateExecutionRequest(sourceCode, languageId);
    if (!executionValidation.valid) {
      return res.status(400).json({
        error: executionValidation.blockedReason || "Execution request blocked",
      });
    }

    // Submit and poll for result
    const token = await submitCode(executionValidation.sanitized, languageId, stdin);
    const result = await pollForResult(token);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Execute code error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Execution failed",
    });
  }
}
