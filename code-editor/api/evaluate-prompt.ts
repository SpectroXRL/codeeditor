import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

/**
 * Prompt Evaluation API
 * POST /api/evaluate-prompt
 * 
 * Evaluates prompt quality using hybrid scoring (heuristics + AI analysis)
 * Called after tests pass or iterations are exhausted
 */

interface PromptTurn {
  id: string;
  prompt: string;
  generatedCode: string;
  agentReasoning: string;
  timestamp: string;
  iterationNumber: number;
}

type PromptTechnique = 
  | 'zero-shot'
  | 'few-shot'
  | 'chain-of-thought'
  | 'system-prompt'
  | 'iterative-refinement'
  | 'context-management'
  | 'tool-calling';

interface EvaluateRequest {
  attemptId: string;
  promptHistory: PromptTurn[];
  techniquesTags: PromptTechnique[];
  testsPassed: boolean;
  maxIterations: number;
  referencePrompt?: string;
}

interface PromptScores {
  clarity: number;
  efficiency: number;
  context: number;
  technique: number;
  final: number;
}

interface HeuristicsData {
  totalIterations: number;
  totalPromptTokens: number;
  averagePromptLength: number;
  techniquesDetected: PromptTechnique[];
  improvementBetweenIterations: boolean;
  firstAttemptSuccess: boolean;
}

// ============================================
// Heuristic Scoring Functions
// ============================================

function countTokensApprox(text: string): number {
  // Rough approximation: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

function calculateEfficiencyScore(history: PromptTurn[], maxIterations: number, testsPassed: boolean): number {
  if (!testsPassed) {
    // Partial credit for getting close
    return Math.max(10, 30 - (history.length * 5));
  }
  
  const iterationsUsed = history.length;
  
  // First try success = 100
  if (iterationsUsed === 1) return 100;
  
  // Linear decrease with iterations
  // 2 iterations = 80, 3 = 60, 4 = 40, 5 = 25
  const base = 100;
  const penaltyPerIteration = (base - 25) / (maxIterations - 1);
  return Math.round(base - ((iterationsUsed - 1) * penaltyPerIteration));
}

function detectTechniques(history: PromptTurn[]): PromptTechnique[] {
  const detected: Set<PromptTechnique> = new Set();
  
  for (const turn of history) {
    const prompt = turn.prompt.toLowerCase();
    
    // Chain-of-thought markers
    if (/let('s)? think|step by step|first,? .*(then|next)|reasoning:/i.test(prompt)) {
      detected.add('chain-of-thought');
    }
    
    // Few-shot (examples in prompt)
    if (/example:|for example|e\.g\.|input:.*output:|here('s| is) an example/i.test(prompt)) {
      detected.add('few-shot');
    }
    
    // System prompt / role setting
    if (/you (are|should be)|act as|your (role|task|job) is/i.test(prompt)) {
      detected.add('system-prompt');
    }
    
    // Context management
    if (/given (that|the)|context:|considering|note that|important:/i.test(prompt)) {
      detected.add('context-management');
    }
    
    // Tool calling
    if (/use (the )?(function|method|api)|call (the )?/i.test(prompt)) {
      detected.add('tool-calling');
    }
  }
  
  // Iterative refinement (detected from multiple turns with references)
  if (history.length > 1) {
    for (let i = 1; i < history.length; i++) {
      const prompt = history[i].prompt.toLowerCase();
      if (/instead|also|but|fix|change|modify|update|improve|previous|last/i.test(prompt)) {
        detected.add('iterative-refinement');
      }
    }
  }
  
  // If single prompt with no special techniques, it's zero-shot
  if (history.length === 1 && detected.size === 0) {
    detected.add('zero-shot');
  }
  
  return Array.from(detected);
}

function detectImprovementBetweenIterations(history: PromptTurn[]): boolean {
  if (history.length < 2) return false;
  
  // Check if later prompts are more specific/detailed
  const lengths = history.map(h => h.prompt.length);
  const avgFirstHalf = lengths.slice(0, Math.ceil(lengths.length / 2))
    .reduce((a, b) => a + b, 0) / Math.ceil(lengths.length / 2);
  const avgSecondHalf = lengths.slice(Math.ceil(lengths.length / 2))
    .reduce((a, b) => a + b, 0) / Math.floor(lengths.length / 2);
  
  // Later prompts being longer often indicates refinement
  return avgSecondHalf > avgFirstHalf * 1.2;
}

function calculateHeuristics(history: PromptTurn[], maxIterations: number, testsPassed: boolean): HeuristicsData {
  const allPromptText = history.map(h => h.prompt).join(' ');
  
  return {
    totalIterations: history.length,
    totalPromptTokens: countTokensApprox(allPromptText),
    averagePromptLength: Math.round(allPromptText.length / history.length),
    techniquesDetected: detectTechniques(history),
    improvementBetweenIterations: detectImprovementBetweenIterations(history),
    firstAttemptSuccess: testsPassed && history.length === 1
  };
}

function calculateTechniqueScore(
  techniquesDetected: PromptTechnique[], 
  techniquesTags: PromptTechnique[],
  history: PromptTurn[]
): number {
  // Base score from detected techniques
  let score = 0;
  
  // Points for using identified techniques
  const techniquePoints: Record<PromptTechnique, number> = {
    'zero-shot': 10,
    'few-shot': 25,
    'chain-of-thought': 20,
    'system-prompt': 15,
    'iterative-refinement': 15,
    'context-management': 20,
    'tool-calling': 15,
  };
  
  for (const technique of techniquesDetected) {
    score += techniquePoints[technique];
  }
  
  // Bonus for self-identification matching detection
  const correctTags = techniquesTags.filter(t => techniquesDetected.includes(t));
  score += correctTags.length * 5;
  
  // Cap at 100
  return Math.min(100, score);
}

function calculateContextScore(history: PromptTurn[]): number {
  // Analyze how well prompts provide relevant context
  let score = 50; // Base score
  
  const lastPrompt = history[history.length - 1]?.prompt || '';
  
  // Positive indicators
  if (/function|method|parameter|argument|return/i.test(lastPrompt)) score += 10;
  if (/should (return|output|produce|handle)/i.test(lastPrompt)) score += 10;
  if (/edge case|error|invalid|boundary/i.test(lastPrompt)) score += 10;
  if (/type|string|number|array|object/i.test(lastPrompt)) score += 5;
  
  // Length heuristic - too short may lack context
  if (lastPrompt.length < 30) score -= 20;
  else if (lastPrompt.length > 100) score += 10;
  
  // Negative indicators (these suggest over-reliance on implicit context)
  if (/just|simply|easy|quick/i.test(lastPrompt)) score -= 5;
  
  return Math.max(0, Math.min(100, score));
}

// ============================================
// AI Scoring (Clarity + Feedback)
// ============================================

const EVALUATION_SYSTEM_PROMPT = `You are evaluating the quality of a student's prompts in a prompt engineering course. The student was trying to get an AI to generate code that passes specific tests.

Analyze the prompts and provide:
1. A clarity score (0-100): How clear, specific, and unambiguous were the prompts?
2. Brief feedback (2-3 sentences): What did they do well and what could improve?

Consider:
- Specificity: Did they clearly describe what the code should do?
- Structure: Were requirements organized logically?
- Completeness: Did they cover edge cases and requirements?
- Conciseness: Were prompts appropriately detailed without being verbose?

Respond in JSON format:
{
  "clarityScore": <number 0-100>,
  "feedback": "<string with constructive feedback>"
}`;

async function getAIEvaluation(
  history: PromptTurn[], 
  testsPassed: boolean,
  apiKey: string
): Promise<{ clarityScore: number; feedback: string }> {
  const openai = new OpenAI({ apiKey });
  
  const promptSummary = history.map((turn, i) => 
    `Iteration ${i + 1}:\n${turn.prompt}`
  ).join('\n\n---\n\n');
  
  const userMessage = `Student's prompts (${history.length} iteration${history.length > 1 ? 's' : ''}, tests ${testsPassed ? 'PASSED' : 'FAILED'}):\n\n${promptSummary}`;
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 300,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No response');
    
    const parsed = JSON.parse(content);
    return {
      clarityScore: Math.max(0, Math.min(100, parsed.clarityScore || 50)),
      feedback: parsed.feedback || 'Keep practicing to improve your prompt engineering skills!'
    };
  } catch (error) {
    console.error('AI evaluation error:', error);
    // Fallback heuristic
    return {
      clarityScore: 60,
      feedback: 'Your prompts showed decent structure. Focus on being more specific about requirements and edge cases.'
    };
  }
}

// ============================================
// Score Aggregation
// ============================================

function calculateFinalScore(scores: Omit<PromptScores, 'final'>): number {
  // Default weights
  const weights = {
    clarity: 0.30,
    efficiency: 0.25,
    context: 0.20,
    technique: 0.25
  };
  
  return Math.round(
    scores.clarity * weights.clarity +
    scores.efficiency * weights.efficiency +
    scores.context * weights.context +
    scores.technique * weights.technique
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
    if (typeof body.testsPassed !== 'boolean') {
      return res.status(400).json({ error: "testsPassed flag is required" });
    }
    
    const { 
      promptHistory, 
      techniquesTags = [], 
      testsPassed, 
      maxIterations = 5,
      referencePrompt 
    } = body;
    
    // Calculate heuristics
    const heuristics = calculateHeuristics(promptHistory, maxIterations, testsPassed);
    
    // Calculate individual scores
    const efficiencyScore = calculateEfficiencyScore(promptHistory, maxIterations, testsPassed);
    const contextScore = calculateContextScore(promptHistory);
    const techniqueScore = calculateTechniqueScore(
      heuristics.techniquesDetected, 
      techniquesTags,
      promptHistory
    );
    
    // Get AI evaluation for clarity and feedback
    const aiEval = await getAIEvaluation(promptHistory, testsPassed, apiKey);
    
    // Calculate final weighted score
    const scores: PromptScores = {
      clarity: aiEval.clarityScore,
      efficiency: efficiencyScore,
      context: contextScore,
      technique: techniqueScore,
      final: 0
    };
    scores.final = calculateFinalScore(scores);
    
    // Build feedback
    let fullFeedback = aiEval.feedback;
    
    if (heuristics.firstAttemptSuccess) {
      fullFeedback = `🎯 Excellent! First-try success! ${fullFeedback}`;
    } else if (testsPassed && promptHistory.length <= 2) {
      fullFeedback = `👍 Great efficiency - passed in just ${promptHistory.length} tries! ${fullFeedback}`;
    } else if (!testsPassed) {
      fullFeedback = `Keep practicing! ${fullFeedback} Review the reference prompt for ideas on how to improve.`;
    }
    
    return res.status(200).json({
      scores,
      aiFeedback: fullFeedback,
      heuristics,
      referencePrompt: referencePrompt || null,
      techniquesTags
    });
    
  } catch (error) {
    console.error("Evaluation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
