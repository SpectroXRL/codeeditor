import { describe, expect, it } from 'vitest';
import { buildMemoryParagraph } from '../buildMemoryParagraph.ts';

describe('buildMemoryParagraph', () => {
  it('includes all non-null fields in the output', () => {
    const row = {
      explanation_style: 'concise',
      preferred_language: 'JavaScript',
      topics_explored: ['closures', 'async/await'],
      struggled_with: { recursion: 2 },
      last_session_summary: 'They practised writing a recursive Fibonacci function.',
    };

    const result = buildMemoryParagraph(row);

    expect(result).toContain('concise');
    expect(result).toContain('JavaScript');
    expect(result).toContain('closures');
    expect(result).toContain('async/await');
    expect(result).toContain('recursion');
    expect(result).toContain('Fibonacci');
  });

  it('omits null and missing fields — no "null" or placeholder text appears', () => {
    const row = {
      explanation_style: null,
      preferred_language: null,
      topics_explored: null,
      struggled_with: null,
      last_session_summary: null,
    };

    const result = buildMemoryParagraph(row);

    expect(result).toBe('');
    expect(result).not.toContain('null');
    expect(result).not.toContain('undefined');
  });

  it('output is ≤75 words even when all fields are very long', () => {
    const manyTopics = Array.from({ length: 20 }, (_, i) => `topic-number-${i}`);
    const longSummary = Array.from({ length: 60 }, () => 'word').join(' ');
    const row = {
      explanation_style: 'detailed',
      preferred_language: 'TypeScript',
      topics_explored: manyTopics,
      struggled_with: { recursion: 5, closures: 3, 'async/await': 2 },
      last_session_summary: longSummary,
    };

    const result = buildMemoryParagraph(row);
    const wordCount = result.trim() === '' ? 0 : result.trim().split(/\s+/).length;

    expect(wordCount).toBeLessThanOrEqual(75);
  });
});
