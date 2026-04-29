import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkRateLimit, getRequestIdentity } from "./shared/rateLimit.js";
import { validateExecutionRequest } from "./shared/validator.js";
import { isJudge0Configured, pollForResult, submitCode } from "./shared/judge0.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate API key is configured
  if (!isJudge0Configured()) {
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
