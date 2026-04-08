import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

interface TestResult {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  stderr?: string;
  compileOutput?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatContext {
  code: string;
  lessonInfo: string;
  lessonTitle: string;
  testResults?: TestResult[];
}

interface ChatRequest {
  messages: ChatMessage[];
  context: ChatContext;
}

const SYSTEM_PROMPT = `You are a friendly and helpful programming tutor helping a student learn to code. You're like a supportive pair programmer who wants the student to succeed.

Your teaching style:
- Be conversational and encouraging
- Ask guiding questions to help students think through problems
- Give hints rather than complete solutions when possible
- If they're really stuck, you can be more direct
- Explain concepts clearly with simple analogies when helpful
- Celebrate their progress and correct thinking

Context about the current lesson will be provided. The student's code and any test results will be shared so you understand what they're working on.

Guidelines:
- Keep responses concise but helpful (2-4 paragraphs typically)
- Don't write complete solutions unless explicitly asked and the student has clearly tried
- Point out what they're doing right, not just what's wrong
- If code has errors, guide them to find and fix them rather than just providing fixes
- Be patient - learning to code is hard!

Remember: Your goal is to help them learn, not just solve the problem for them.`;

function formatTestResults(results: TestResult[]): string {
  if (!results || results.length === 0) return "";

  const failed = results.filter((r) => !r.passed);
  const passed = results.filter((r) => r.passed);

  let summary = `\n\nTest Results: ${passed.length}/${results.length} passed`;

  if (failed.length > 0) {
    summary += "\n\nFailed tests:";
    failed.forEach((test, i) => {
      summary += `\n${i + 1}. Input: ${test.input}`;
      summary += `\n   Expected: ${test.expected}`;
      summary += `\n   Got: ${test.actual}`;
      if (test.stderr) {
        summary += `\n   Error: ${test.stderr}`;
      }
      if (test.compileOutput) {
        summary += `\n   Compile error: ${test.compileOutput}`;
      }
    });
  }

  return summary;
}

function buildContextMessage(context: ChatContext): string {
  let contextMsg = `CURRENT LESSON: ${context.lessonTitle}\n\n`;
  contextMsg += `LESSON CONTENT:\n${context.lessonInfo}\n\n`;
  contextMsg += `STUDENT'S CODE:\n\`\`\`\n${context.code}\n\`\`\``;

  if (context.testResults && context.testResults.length > 0) {
    contextMsg += formatTestResults(context.testResults);
  }

  return contextMsg;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  try {
    const { messages, context } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    if (!context || !context.code) {
      return res.status(400).json({ error: "Context with code is required" });
    }

    const openai = new OpenAI({ apiKey });

    // Build the messages array for OpenAI
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      // Inject context as the first user message (hidden from display)
      {
        role: "user",
        content: `[CONTEXT - Not shown to student]\n${buildContextMessage(context)}`,
      },
      { role: "assistant", content: "I understand the lesson context. How can I help you?" },
      // Add actual conversation messages
      ...messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return res.status(500).json({ error: "No response from AI" });
    }

    return res.status(200).json({ response });
  } catch (error) {
    console.error("Chat assistant error:", error);

    if (error instanceof OpenAI.APIError) {
      return res.status(error.status || 500).json({
        error: error.message || "OpenAI API error",
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
