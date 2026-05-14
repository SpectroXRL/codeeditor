import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { LearnChatMessage } from '../../src/types/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  const token =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  if (!token) {
    return res.status(200).json({ memoryWritten: false });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !apiKey) {
    return res.status(200).json({ memoryWritten: false });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return res.status(200).json({ memoryWritten: false });
  }

  const body = req.body as {
    chatHistory: LearnChatMessage[];
    learningGoal: string;
    struggledWith: Record<string, number>;
    selectedLanguage: { name: string };
  };

  const hasUserMessages = body.chatHistory?.some((m) => m.role === 'user');
  if (!hasUserMessages) {
    return res.status(200).json({ memoryWritten: false });
  }

  // Generate session summary
  const openai = new OpenAI({ apiKey });
  const transcript = body.chatHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: 'Summarise this learning session in 2–3 sentences for a returning student.',
      },
      { role: 'user', content: transcript },
    ],
  });

  const lastSessionSummary = completion.choices[0]?.message?.content ?? '';

  // Fetch existing row to merge struggled_with and topics_explored
  const { data: existing } = await supabase
    .from('user_memory')
    .select('struggled_with, topics_explored')
    .eq('user_id', user.id)
    .single();

  const existingStruggled: Record<string, number> =
    (existing as { struggled_with?: Record<string, number> } | null)?.struggled_with ?? {};
  const existingTopics: string[] =
    (existing as { topics_explored?: string[] } | null)?.topics_explored ?? [];

  // Merge struggled_with additively
  const mergedStruggled = { ...existingStruggled };
  for (const [topic, count] of Object.entries(body.struggledWith)) {
    mergedStruggled[topic] = (mergedStruggled[topic] ?? 0) + count;
  }

  // Append learningGoal, deduplicate, cap at 20 most recent
  const mergedTopics = [
    ...existingTopics.filter((t) => t !== body.learningGoal),
    body.learningGoal,
  ].slice(-20);

  const { error: upsertError } = await supabase
    .from('user_memory')
    .upsert(
      {
        user_id: user.id,
        preferred_language: body.selectedLanguage.name,
        topics_explored: mergedTopics,
        struggled_with: mergedStruggled,
        last_session_summary: lastSessionSummary,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (upsertError) {
    return res.status(200).json({ memoryWritten: false });
  }

  return res.status(200).json({ memoryWritten: true });
}
