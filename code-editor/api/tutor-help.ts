import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type AssistanceTier = 'tip' | 'question' | 'hint' | 'explanation';

interface TutorHelpRequest {
  code: string;
  lessonTitle: string;
  lessonContent: string;
  starterCode: string;
  issue: {
    type: string;
    message: string;
    line?: number;
  } | null;
  tier: AssistanceTier;
  language: string;
}

// Token limits per tier
const TOKEN_LIMITS: Record<AssistanceTier, number> = {
  tip: 50,
  question: 100,
  hint: 200,
  explanation: 500,
};

// System prompts per tier
const TIER_PROMPTS: Record<AssistanceTier, string> = {
  tip: `You are a friendly coding tutor helping a complete beginner.
Give ONE short sentence (under 15 words) nudging them in the right direction.
DO NOT give code. DO NOT explain the solution. Just a gentle nudge.
Reference the lesson topic if relevant.`,

  question: `You are a Socratic coding tutor helping a complete beginner.
Ask ONE thoughtful question to help them think about their code.
Examples: "What value does this variable hold after line 3?" or "What happens when the input is empty?"
DO NOT give the answer. Guide them to discover it themselves.
Keep it under 25 words.`,

  hint: `You are a supportive coding tutor helping a complete beginner.
Give a concrete hint about what to do next, connecting it to the lesson concepts.
You may mention a specific technique or approach but DO NOT write the actual code.
Keep it under 50 words. Be encouraging.`,

  explanation: `You are a patient, encouraging coding tutor helping a complete beginner.
Explain what's going wrong and how to think about fixing it.
- Use simple language, avoid jargon
- Connect to the lesson concepts they're learning
- Give a clear direction without writing the complete solution
- Be encouraging - mistakes are part of learning!
Use markdown for readability. Keep it under 150 words.`,
};

function buildUserPrompt(req: TutorHelpRequest): string {
  const { code, lessonTitle, lessonContent, starterCode, issue, language } = req;

  // Truncate lesson content to avoid huge prompts
  const truncatedLesson =
    lessonContent.length > 500 ? lessonContent.slice(0, 500) + '...' : lessonContent;

  let prompt = `**Lesson:** ${lessonTitle}

**Lesson Summary:**
${truncatedLesson}

**Language:** ${language}

**Starter Code:**
\`\`\`${language.toLowerCase()}
${starterCode}
\`\`\`

**Student's Current Code:**
\`\`\`${language.toLowerCase()}
${code}
\`\`\``;

  if (issue) {
    prompt += `

**Detected Issue:** ${issue.message}${issue.line ? ` (line ${issue.line})` : ''}`;
  }

  prompt += `

Help the student with their code following the guidelines.`;

  return prompt;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
    const body = req.body as TutorHelpRequest;

    // Validate required fields
    if (!body.code || !body.lessonTitle || !body.tier || !body.language) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate tier
    const validTiers: AssistanceTier[] = ['tip', 'question', 'hint', 'explanation'];
    if (!validTiers.includes(body.tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const systemPrompt = TIER_PROMPTS[body.tier];
    const userPrompt = buildUserPrompt(body);
    const maxTokens = TOKEN_LIMITS[body.tier];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || 'Unable to generate help.';

    // Determine if follow-up is available (can escalate to next tier)
    const tierIndex = validTiers.indexOf(body.tier);
    const followUpAvailable = tierIndex < validTiers.length - 1;

    return res.status(200).json({
      response,
      tier: body.tier,
      followUpAvailable,
    });
  } catch (error) {
    console.error('Tutor help error:', error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }
      return res.status(error.status || 500).json({ error: 'AI service error' });
    }

    return res.status(500).json({ error: 'Failed to generate help' });
  }
}
