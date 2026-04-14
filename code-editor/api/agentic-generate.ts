import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

/**
 * Agentic Code Generation API
 * POST /api/agentic-generate
 * 
 * Generates code based on student prompts for agentic engineering challenges.
 * Includes prompt validation, conversation history management, and iteration tracking.
 */

interface PromptTurn {
  id: string;
  prompt: string;
  generatedCode: string;
  agentReasoning: string;
  timestamp: string;
  iterationNumber: number;
}

interface TestCase {
  input: string;
  expected_output: string;
}

interface ChallengeContext {
  title: string;
  description: string;
  testCases: TestCase[];
  language: 'javascript' | 'typescript';
  starterCode?: string;
}

interface GenerateRequest {
  attemptId: string;
  prompt: string;
  conversationHistory: PromptTurn[];
  challengeContext: ChallengeContext;
  userId: string;
}

interface ValidationResult {
  valid: boolean;
  sanitized: string;
  blockedReason?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

// ============================================
// Prompt Validation (Server-side)
// ============================================

const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string; risk: 'medium' | 'high' }> = [
  { 
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    reason: 'Attempted instruction override detected',
    risk: 'high'
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?)/i,
    reason: 'Attempted instruction override detected',
    risk: 'high'
  },
  {
    pattern: /forget\s+(everything|all|what)\s+(you('ve)?|i)\s+(told|said|learned)/i,
    reason: 'Attempted memory manipulation detected',
    risk: 'high'
  },
  {
    pattern: /you\s+are\s+now\s+(a|an|the|acting\s+as)/i,
    reason: 'Attempted role manipulation detected',
    risk: 'high'
  },
  {
    pattern: /what\s+(is|are)\s+(your|the)\s+(system\s+)?prompt/i,
    reason: 'System prompt extraction attempt detected',
    risk: 'high'
  },
  {
    pattern: /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
    reason: 'System prompt extraction attempt detected',
    risk: 'high'
  },
  {
    pattern: /reveal\s+(your|the)\s+(instructions?|prompt|rules)/i,
    reason: 'System prompt extraction attempt detected',
    risk: 'high'
  },
  {
    pattern: /```system|<\|system\|>|<system>|<<SYS>>|\[INST\]/i,
    reason: 'Delimiter injection attempt detected',
    risk: 'high'
  },
  {
    pattern: /\[end\s+of\s+(conversation|context|prompt)\]/i,
    reason: 'Context boundary manipulation detected',
    risk: 'high'
  },
  {
    pattern: /pretend\s+(to\s+be|you('re)?|that\s+you)/i,
    reason: 'Attempted role manipulation detected',
    risk: 'medium'
  },
  {
    pattern: /act\s+as\s+(if\s+you('re)?|a|an|the)/i,
    reason: 'Attempted role manipulation detected',
    risk: 'medium'
  },
];

const MAX_PROMPT_LENGTH = 4000;

function validatePrompt(prompt: string): ValidationResult {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      sanitized: prompt.slice(0, MAX_PROMPT_LENGTH),
      blockedReason: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
      riskLevel: 'low'
    };
  }
  
  if (!prompt.trim()) {
    return {
      valid: false,
      sanitized: '',
      blockedReason: 'Prompt cannot be empty',
      riskLevel: 'low'
    };
  }
  
  for (const { pattern, reason, risk } of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      if (risk === 'high') {
        return {
          valid: false,
          sanitized: prompt,
          blockedReason: reason,
          riskLevel: 'high'
        };
      }
    }
  }
  
  // Sanitize but allow
  const sanitized = prompt
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript\s*:/gi, '');
  
  return {
    valid: true,
    sanitized,
    riskLevel: 'low'
  };
}

function getSafeBlockMessage(reason: string): string {
  const messageMap: Record<string, string> = {
    'Attempted instruction override detected': 
      'Your prompt contains patterns that aren\'t allowed. Try rephrasing your request to focus on the coding task.',
    'Attempted role manipulation detected':
      'Please focus on describing what code you need rather than how the assistant should behave.',
    'System prompt extraction attempt detected':
      'That type of request isn\'t supported. Try asking for help with your coding challenge instead.',
    'Delimiter injection attempt detected':
      'Your prompt contains formatting that isn\'t supported. Please use plain text.',
    'Context boundary manipulation detected':
      'Please focus on the current coding challenge.',
  };
  
  return messageMap[reason] || 
    'Your prompt was blocked for security reasons. Please rephrase your request to focus on the coding task.';
}

// ============================================
// Code Generation System Prompt
// ============================================

const CODE_GENERATION_SYSTEM_PROMPT = `You are a code generation assistant for a prompt engineering learning platform. Students are learning how to write effective prompts that generate working code.

Your role:
1. Generate code based on the student's prompt to fulfill the challenge requirements
2. Show your reasoning process so students can learn what makes prompts effective
3. Be honest about ambiguities in the prompt that could be improved

Output format - You MUST respond with valid JSON in this exact structure:
{
  "reasoning": "Your step-by-step thinking about how you interpreted the prompt and what you're going to build. This helps students understand what worked (or didn't) in their prompt. Keep this to 2-4 sentences.",
  "code": "The complete, working code that fulfills the requirements. Must be syntactically correct."
}

Guidelines:
- Generate complete, working code - not pseudocode or partial implementations
- If the prompt is vague, make reasonable assumptions and note them in reasoning
- If the prompt is unclear about implementation details, choose sensible defaults
- Do not refuse to generate code - always attempt something based on the prompt
- The code should satisfy the test cases described in the challenge context
- For JavaScript/TypeScript: use modern syntax (ES6+), avoid deprecated patterns

Remember: Your output teaches students what kind of prompts are effective. Good prompts lead to correct code; vague prompts lead to assumptions that may or may not match the tests.`;

// ============================================
// Build Context for LLM
// ============================================

function buildChallengeContextMessage(context: ChallengeContext): string {
  let msg = `CHALLENGE: ${context.title}\n`;
  msg += `DESCRIPTION: ${context.description}\n`;
  msg += `LANGUAGE: ${context.language}\n\n`;
  
  msg += `TEST CASES (the generated code must pass these):\n`;
  context.testCases.forEach((tc, i) => {
    msg += `${i + 1}. Input: ${tc.input} → Expected Output: ${tc.expected_output}\n`;
  });
  
  if (context.starterCode) {
    msg += `\nSTARTER CODE STRUCTURE:\n\`\`\`\n${context.starterCode}\n\`\`\`\n`;
  }
  
  return msg;
}

function buildConversationHistory(history: PromptTurn[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  
  for (const turn of history) {
    messages.push({
      role: 'user',
      content: turn.prompt
    });
    messages.push({
      role: 'assistant',
      content: JSON.stringify({
        reasoning: turn.agentReasoning,
        code: turn.generatedCode
      })
    });
  }
  
  return messages;
}

// ============================================
// API Handler
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }
  
  try {
    const body = req.body as GenerateRequest;
    
    // Validate request structure
    if (!body.prompt || typeof body.prompt !== 'string') {
      return res.status(400).json({ error: "Prompt is required" });
    }
    if (!body.challengeContext) {
      return res.status(400).json({ error: "Challenge context is required" });
    }
    if (!body.attemptId) {
      return res.status(400).json({ error: "Attempt ID is required" });
    }
    
    const { prompt, conversationHistory = [], challengeContext } = body;
    
    // Calculate iterations used
    const iterationsUsed = conversationHistory.length;
    const maxIterations = 5; // Could be passed from challenge config
    const iterationsRemaining = maxIterations - iterationsUsed - 1;
    
    if (iterationsRemaining < 0) {
      return res.status(400).json({ 
        error: "Maximum iterations exceeded",
        iterationsRemaining: 0
      });
    }
    
    // Validate and sanitize prompt
    const validation = validatePrompt(prompt);
    
    if (!validation.valid) {
      // Log blocked prompt (in production, save to database)
      console.warn('Prompt blocked:', {
        attemptId: body.attemptId,
        reason: validation.blockedReason,
        riskLevel: validation.riskLevel
      });
      
      return res.status(400).json({
        error: "Prompt validation failed",
        blockedReason: getSafeBlockMessage(validation.blockedReason || ''),
        iterationsRemaining: iterationsRemaining + 1 // Don't count blocked attempts
      });
    }
    
    // Build messages for OpenAI
    const openai = new OpenAI({ apiKey });
    
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: CODE_GENERATION_SYSTEM_PROMPT },
      { role: 'user', content: buildChallengeContextMessage(challengeContext) },
      ...buildConversationHistory(conversationHistory),
      { role: 'user', content: validation.sanitized }
    ];
    
    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent code generation
      response_format: { type: "json_object" }
    });
    
    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      return res.status(500).json({ error: "No response from AI" });
    }
    
    // Parse JSON response
    let parsed: { reasoning: string; code: string };
    try {
      parsed = JSON.parse(responseContent);
    } catch {
      // Fallback if JSON parsing fails
      parsed = {
        reasoning: "Generated code based on your prompt.",
        code: responseContent
      };
    }
    
    // Generate unique ID for this turn
    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    return res.status(200).json({
      turnId,
      generatedCode: parsed.code || '',
      agentReasoning: parsed.reasoning || 'Code generated based on your prompt.',
      iterationsRemaining,
      iterationNumber: iterationsUsed + 1,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Agentic generate error:", error);
    
    if (error instanceof OpenAI.APIError) {
      return res.status(error.status || 500).json({
        error: "AI service error",
        message: error.message
      });
    }
    
    return res.status(500).json({ error: "Internal server error" });
  }
}
