import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ErrorExplanationParams {
  code: string;
  expected: string;
  actual: string;
  stderr: string | null;
  compileOutput: string | null;
  language: string;
}

const SYSTEM_PROMPT = `You are a friendly, encouraging coding tutor helping a beginner understand why their code didn't produce the expected output.

Your job is to:
1. Identify what went wrong (without giving away the complete solution)
2. Explain WHY it went wrong in simple, beginner-friendly terms
3. Give a hint about how to think about fixing it
4. Be encouraging - mistakes are part of learning!

Guidelines:
- Keep explanations concise (2-4 short paragraphs max)
- Use simple language, avoid jargon
- If there's a compilation error, focus on that first
- Don't provide the complete corrected code - guide them to discover it
- Use analogies when helpful
- Format with markdown for readability`;

function buildUserPrompt(params: ErrorExplanationParams): string {
  const { code, expected, actual, stderr, compileOutput, language } = params;

  let prompt = `**Language:** ${language}

**Student's Code:**
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

**Expected Output:**
\`\`\`
${expected}
\`\`\`

**Actual Output:**
\`\`\`
${actual || "(no output)"}
\`\`\``;

  if (compileOutput) {
    prompt += `

**Compilation Error:**
\`\`\`
${compileOutput}
\`\`\``;
  }

  if (stderr) {
    prompt += `

**Error Message:**
\`\`\`
${stderr}
\`\`\``;
  }

  prompt += `

Please explain what went wrong and give a helpful hint (without giving away the answer).`;

  return prompt;
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
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const { code, expected, actual, stderr, compileOutput, language } =
      req.body as ErrorExplanationParams;

    // Validate required fields
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "code is required" });
    }
    if (!expected || typeof expected !== "string") {
      return res.status(400).json({ error: "expected is required" });
    }
    if (!language || typeof language !== "string") {
      return res.status(400).json({ error: "language is required" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: buildUserPrompt({
            code,
            expected,
            actual: actual || "",
            stderr,
            compileOutput,
            language,
          }),
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    return res.status(200).json({ explanation: content });
  } catch (error) {
    console.error("OpenAI API error:", error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return res.status(500).json({ error: "Invalid API key configuration" });
      }
      if (error.status === 429) {
        return res
          .status(429)
          .json({ error: "Rate limit exceeded. Please try again in a moment." });
      }
    }

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate explanation",
    });
  }
}
