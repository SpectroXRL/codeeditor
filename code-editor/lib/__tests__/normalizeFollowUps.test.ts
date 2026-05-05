import { describe, expect, it } from 'vitest';
import { normalizeFollowUps } from '../normalizeFollowUps.ts';

describe('normalizeFollowUps', () => {
  it('returns up to five trimmed follow-up strings', () => {
    const result = normalizeFollowUps([
      '  What changes if input doubles?  ',
      'Can we simplify this logic?',
      'What edge cases should I test?',
      'How does this compare to recursion?',
      'Can this be optimized for readability?',
      'extra prompt should be removed',
    ]);

    expect(result).toEqual([
      'What changes if input doubles?',
      'Can we simplify this logic?',
      'What edge cases should I test?',
      'How does this compare to recursion?',
      'Can this be optimized for readability?',
    ]);
  });

  it('filters out non-string and empty values', () => {
    const result = normalizeFollowUps(['', '   ', 42, null, 'Keep this one'] as unknown);

    expect(result).toEqual(['Keep this one']);
  });

  it('returns an empty array for non-array input', () => {
    expect(normalizeFollowUps(undefined)).toEqual([]);
    expect(normalizeFollowUps('not-an-array')).toEqual([]);
    expect(normalizeFollowUps({ value: 'x' })).toEqual([]);
  });
});
