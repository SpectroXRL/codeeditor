import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

/**
 * Error Recovery Evaluation API
 * POST /api/evaluate-error-recovery
 * 
 * Evaluates student's ability to diagnose and fix code errors
 * Uses hybrid scoring: heuristics + AI analysis
 */

// ============================================
// Types
// ============================================

type ErrorType = 'syntax' | 'runtime' | 'logic' | 'edge_case' | 'performance';

type PromptTurn = {
  id: string;
  prompt: string;
  generatedCode: string;
  agentReasoning: string;
  timestamp: string;
  iterationNumber: number;
};

type TestResult = {
  input: string;
  expected_output: string;
  passed: boolean;
  actual_output?: string;
};

interface EvaluateRequest {
  attemptId: string;
  promptHistory: PromptTurn[];
  errorType: ErrorType;
  brokenCode: string;
  errorMessage: string;
  testsPassed: boolean;
  maxIterations: number;
  baselineTestResults: TestResult[];
  afterTestResults: TestResult[];
  rootCauseDescription?: string; // Internal reference for evaluation
}

interface ErrorRecoveryScores {
  diagnosis: number;
  fixPrecision: number;
  iterationEconomy: number;
  noRegression: number;
  final: number;
}

interface ErrorRecoveryHeuristics {
  totalIterations: number;
  promptReferencesError: boolean;
  promptIdentifiesRootCause: boolean;
  fixIsMinimal: boolean;
  fullRewriteDetected: boolean;
  firstAttemptSuccess: boolean;
}

interface TestDiffData {
  before: Array<{ input: string; expectedOutput: string; passed: boolean }>;
  after: Array<{ input: string; expectedOutput: string; passed: boolean; actualOutput?: string }>;
  regressions: Array<{ input: string; expectedOutput: string; passed: boolean }>;
  newlyPassing: Array<{ input: string; expectedOutput: string; passed: boolean }>;
}

// ============================================
// Heuristic Scoring Functions
// ============================================

/**
 * Calculate Iteration Economy Score (20% of total)
 * First-try fix = 100, linear decay with more iterations
 */
function calculateIterationEconomyScore(
  history: PromptTurn[], 
  maxIterations: number, 
  testsPassed: boolean
): number {
  if (!testsPassed) {
    // Partial credit for attempting
    return Math.max(10, 30 - (history.length * 5));
  }
  
  const iterationsUsed = history.length;
  
  // First try success = 100
  if (iterationsUsed === 1) return 100;
  
  // Linear decrease: 2 iterations = 80, 3 = 60, 4 = 40, 5 = 25
  const base = 100;
  const minScore = 25;
  const penaltyPerIteration = (base - minScore) / (maxIterations - 1);
  
  return Math.round(base - ((iterationsUsed - 1) * penaltyPerIteration));
}

/**
 * Calculate No Regression Score (20% of total)
 * Tests that passed before should still pass after fix
 */
function calculateNoRegressionScore(
  baselineResults: TestResult[],
  afterResults: TestResult[]
): { score: number; regressions: TestResult[] } {
  const baselinePassingInputs = new Set(
    baselineResults.filter(t => t.passed).map(t => t.input)
  );
  
  // Find tests that passed before but fail now
  const regressions = afterResults.filter(t => 
    baselinePassingInputs.has(t.input) && !t.passed
  );
  
  if (baselinePassingInputs.size === 0) {
    // No tests were passing before, so no regression possible
    return { score: 100, regressions: [] };
  }
  
  const regressionRate = regressions.length / baselinePassingInputs.size;
  const score = Math.round(100 * (1 - regressionRate));
  
  return { score: Math.max(0, score), regressions };
}

/**
 * Detect if student references the error in their prompt
 */
function detectErrorReference(history: PromptTurn[], errorMessage: string): boolean {
  const errorKeywords = extractErrorKeywords(errorMessage);
  
  for (const turn of history) {
    const promptLower = turn.prompt.toLowerCase();
    
    // Check for error-related language
    if (/error|bug|fix|issue|problem|wrong|broken|fail/i.test(promptLower)) {
      return true;
    }
    
    // Check for specific error keywords from the message
    for (const keyword of errorKeywords) {
      if (promptLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Extract keywords from error message for matching
 */
function extractErrorKeywords(errorMessage: string): string[] {
  const keywords: string[] = [];
  
  // Common error patterns
  const patterns = [
    /undefined is not a function/i,
    /cannot read propert/i,
    /is not defined/i,
    /unexpected token/i,
    /syntax error/i,
    /type error/i,
    /reference error/i,
    /null/i,
    /NaN/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(errorMessage)) {
      keywords.push(pattern.source.replace(/\\i?/g, '').slice(0, 20));
    }
  }
  
  // Extract any identifiers mentioned (camelCase or snake_case words)
  const identifiers = errorMessage.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
  keywords.push(...identifiers.filter(id => id.length > 3 && id.length < 30));
  
  return [...new Set(keywords)];
}

/**
 * Detect if the fix was minimal vs full rewrite
 */
function detectMinimalFix(
  brokenCode: string, 
  fixedCode: string
): { isMinimal: boolean; fullRewrite: boolean } {
  const brokenLines = brokenCode.split('\n').filter(l => l.trim());
  const fixedLines = fixedCode.split('\n').filter(l => l.trim());
  
  // Calculate similarity
  const brokenSet = new Set(brokenLines.map(l => l.trim()));
  const fixedSet = new Set(fixedLines.map(l => l.trim()));
  
  let matchingLines = 0;
  for (const line of fixedSet) {
    if (brokenSet.has(line)) matchingLines++;
  }
  
  const totalLines = Math.max(brokenLines.length, fixedLines.length);
  const similarityRatio = matchingLines / totalLines;
  
  // Full rewrite if less than 30% similarity
  const fullRewrite = similarityRatio < 0.3;
  
  // Minimal fix if more than 70% similarity (most code unchanged)
  const isMinimal = similarityRatio > 0.7;
  
  return { isMinimal, fullRewrite };
}

/**
 * Build heuristics data object
 */
function calculateHeuristics(
  history: PromptTurn[],
  brokenCode: string,
  errorMessage: string,
  testsPassed: boolean
): ErrorRecoveryHeuristics {
  const lastCode = history[history.length - 1]?.generatedCode || '';
  const { isMinimal, fullRewrite } = detectMinimalFix(brokenCode, lastCode);
  
  return {
    totalIterations: history.length,
    promptReferencesError: detectErrorReference(history, errorMessage),
    promptIdentifiesRootCause: false, // Will be set by AI evaluation
    fixIsMinimal: isMinimal,
    fullRewriteDetected: fullRewrite,
    firstAttemptSuccess: testsPassed && history.length === 1,
  };
}

/**
 * Calculate test diff for UI display
 */
function calculateTestDiff(
  baselineResults: TestResult[],
  afterResults: TestResult[]
): TestDiffData {
  const baselineMap = new Map(baselineResults.map(t => [t.input, t]));
  
  const regressions: TestDiffData['regressions'] = [];
  const newlyPassing: TestDiffData['newlyPassing'] = [];
  
  for (const afterTest of afterResults) {
    const beforeTest = baselineMap.get(afterTest.input);
    
    if (beforeTest) {
      if (beforeTest.passed && !afterTest.passed) {
        regressions.push({
          input: afterTest.input,
          expectedOutput: afterTest.expected_output,
          passed: false,
        });
      } else if (!beforeTest.passed && afterTest.passed) {
        newlyPassing.push({
          input: afterTest.input,
          expectedOutput: afterTest.expected_output,
          passed: true,
        });
      }
    }
  }
  
  return {
    before: baselineResults.map(t => ({
      input: t.input,
      expectedOutput: t.expected_output,
      passed: t.passed,
    })),
    after: afterResults.map(t => ({
      input: t.input,
      expectedOutput: t.expected_output,
      passed: t.passed,
      actualOutput: t.actual_output,
    })),
    regressions,
    newlyPassing,
  };
}

// ============================================
// AI Scoring (Diagnosis + Fix Precision + Feedback)
// ============================================

const EVALUATION_SYSTEM_PROMPT = `You are evaluating a student's ability to diagnose and fix code errors through prompting. 

The student was shown broken code with an error message and asked to write prompts to fix it.

Analyze their prompts and the resulting fix. Provide:

1. diagnosisScore (0-100): How well did they identify/understand the error?
   - Did they reference the actual error type?
   - Did they identify the root cause?
   - Did they understand WHY the code was broken?

2. fixPrecisionScore (0-100): How targeted was their fix approach?
   - Did they ask for a minimal, surgical fix?
   - Or did they request a complete rewrite?
   - Did they preserve working functionality?

3. errorTypeDetected: What error type did they seem to identify? (syntax/runtime/logic/edge_case/performance or null)

4. feedback: 2-3 sentences of constructive feedback on their debugging approach.

Consider that GOOD debugging involves:
- Reading and understanding the error message
- Identifying the specific line/issue causing the problem
- Requesting a targeted fix that doesn't change unrelated code
- Verifying the fix doesn't introduce new issues

Respond in JSON format:
{
  "diagnosisScore": <number 0-100>,
  "fixPrecisionScore": <number 0-100>,
  "errorTypeDetected": "<string or null>",
  "feedback": "<string>"
}`;

async function getAIEvaluation(
  history: PromptTurn[],
  brokenCode: string,
  errorMessage: string,
  errorType: ErrorType,
  testsPassed: boolean,
  apiKey: string
): Promise<{
  diagnosisScore: number;
  fixPrecisionScore: number;
  errorTypeDetected: ErrorType | null;
  feedback: string;
}> {
  const openai = new OpenAI({ apiKey });
  
  const promptSummary = history.map((turn, i) => 
    `Iteration ${i + 1}:\nPrompt: ${turn.prompt}\n\nGenerated Fix:\n${turn.generatedCode.slice(0, 500)}${turn.generatedCode.length > 500 ? '...' : ''}`
  ).join('\n\n---\n\n');
  
  const userMessage = `
BROKEN CODE:
\`\`\`
${brokenCode}
\`\`\`

ERROR MESSAGE:
${errorMessage}

ACTUAL ERROR TYPE: ${errorType}

STUDENT'S PROMPTS (${history.length} iteration${history.length > 1 ? 's' : ''}, tests ${testsPassed ? 'PASSED' : 'FAILED'}):

${promptSummary}
`.trim();
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 400,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No response');
    
    const parsed = JSON.parse(content);
    
    return {
      diagnosisScore: Math.max(0, Math.min(100, parsed.diagnosisScore || 50)),
      fixPrecisionScore: Math.max(0, Math.min(100, parsed.fixPrecisionScore || 50)),
      errorTypeDetected: isValidErrorType(parsed.errorTypeDetected) ? parsed.errorTypeDetected : null,
      feedback: parsed.feedback || 'Keep practicing your debugging skills!'
    };
  } catch (error) {
    console.error('AI evaluation error:', error);
    // Fallback to heuristic-based scoring
    return {
      diagnosisScore: 60,
      fixPrecisionScore: 60,
      errorTypeDetected: null,
      feedback: 'Focus on reading error messages carefully and making targeted fixes.'
    };
  }
}

function isValidErrorType(value: unknown): value is ErrorType {
  return typeof value === 'string' && 
    ['syntax', 'runtime', 'logic', 'edge_case', 'performance'].includes(value);
}

// ============================================
// Score Aggregation
// ============================================

function calculateFinalScore(scores: Omit<ErrorRecoveryScores, 'final'>): number {
  // Weights: Diagnosis 30%, Fix Precision 30%, Economy 20%, No Regression 20%
  const weights = {
    diagnosis: 0.30,
    fixPrecision: 0.30,
    iterationEconomy: 0.20,
    noRegression: 0.20,
  };
  
  return Math.round(
    scores.diagnosis * weights.diagnosis +
    scores.fixPrecision * weights.fixPrecision +
    scores.iterationEconomy * weights.iterationEconomy +
    scores.noRegression * weights.noRegression
  );
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
    const body = req.body as EvaluateRequest;
    
    // Validate request
    if (!body.promptHistory || !Array.isArray(body.promptHistory) || body.promptHistory.length === 0) {
      return res.status(400).json({ error: "Prompt history is required" });
    }
    if (!body.brokenCode) {
      return res.status(400).json({ error: "Broken code is required" });
    }
    if (!body.errorMessage) {
      return res.status(400).json({ error: "Error message is required" });
    }
    if (typeof body.testsPassed !== 'boolean') {
      return res.status(400).json({ error: "testsPassed flag is required" });
    }
    
    const { 
      promptHistory,
      errorType,
      brokenCode,
      errorMessage,
      testsPassed, 
      maxIterations = 5,
      baselineTestResults = [],
      afterTestResults = [],
    } = body;
    
    // Calculate heuristics
    const heuristics = calculateHeuristics(promptHistory, brokenCode, errorMessage, testsPassed);
    
    // Calculate test diff
    const testDiff = calculateTestDiff(baselineTestResults, afterTestResults);
    
    // Calculate heuristic scores
    const iterationEconomyScore = calculateIterationEconomyScore(promptHistory, maxIterations, testsPassed);
    const { score: noRegressionScore } = calculateNoRegressionScore(baselineTestResults, afterTestResults);
    
    // Get AI evaluation for diagnosis and fix precision
    const aiEval = await getAIEvaluation(
      promptHistory,
      brokenCode,
      errorMessage,
      errorType,
      testsPassed,
      apiKey
    );
    
    // Update heuristics with AI findings
    heuristics.promptIdentifiesRootCause = aiEval.diagnosisScore > 70;
    
    // Adjust fix precision score based on heuristics
    let fixPrecisionScore = aiEval.fixPrecisionScore;
    if (heuristics.fullRewriteDetected) {
      fixPrecisionScore = Math.max(20, fixPrecisionScore - 30); // Penalty for full rewrite
    }
    if (heuristics.fixIsMinimal) {
      fixPrecisionScore = Math.min(100, fixPrecisionScore + 10); // Bonus for minimal fix
    }
    
    // Build final scores
    const scores: ErrorRecoveryScores = {
      diagnosis: aiEval.diagnosisScore,
      fixPrecision: fixPrecisionScore,
      iterationEconomy: iterationEconomyScore,
      noRegression: noRegressionScore,
      final: 0,
    };
    scores.final = calculateFinalScore(scores);
    
    // Build feedback
    let fullFeedback = aiEval.feedback;
    
    if (heuristics.firstAttemptSuccess) {
      fullFeedback = `🎯 Excellent! Fixed on the first try! ${fullFeedback}`;
    } else if (testsPassed && promptHistory.length <= 2) {
      fullFeedback = `👍 Great efficiency - fixed in just ${promptHistory.length} tries! ${fullFeedback}`;
    } else if (!testsPassed) {
      fullFeedback = `Keep practicing! ${fullFeedback}`;
    }
    
    if (heuristics.fullRewriteDetected) {
      fullFeedback += ' Tip: Try to make targeted fixes rather than rewriting the entire code.';
    }
    
    if (testDiff.regressions.length > 0) {
      fullFeedback += ` ⚠️ Your fix introduced ${testDiff.regressions.length} regression(s) - tests that passed before now fail.`;
    }
    
    return res.status(200).json({
      scores,
      aiFeedback: fullFeedback,
      heuristics,
      testDiff,
      errorTypeDetected: aiEval.errorTypeDetected,
    });
    
  } catch (error) {
    console.error("Error recovery evaluation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
