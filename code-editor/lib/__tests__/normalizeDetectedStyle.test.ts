import { describe, expect, it } from 'vitest';
import { normalizeDetectedStyle } from '../normalizeDetectedStyle';

describe('normalizeDetectedStyle', () => {
  it('returns "ELI5" unchanged', () => {
    expect(normalizeDetectedStyle('ELI5')).toBe('ELI5');
  });

  it('returns each valid style unchanged', () => {
    expect(normalizeDetectedStyle('concise')).toBe('concise');
    expect(normalizeDetectedStyle('detailed')).toBe('detailed');
    expect(normalizeDetectedStyle('analogy-heavy')).toBe('analogy-heavy');
  });

  it('returns null for unknown strings', () => {
    expect(normalizeDetectedStyle('verbose')).toBeNull();
    expect(normalizeDetectedStyle('simple')).toBeNull();
    expect(normalizeDetectedStyle('')).toBeNull();
  });

  it('returns null for null, undefined, and non-string types', () => {
    expect(normalizeDetectedStyle(null)).toBeNull();
    expect(normalizeDetectedStyle(undefined)).toBeNull();
    expect(normalizeDetectedStyle(42)).toBeNull();
    expect(normalizeDetectedStyle({ style: 'ELI5' })).toBeNull();
    expect(normalizeDetectedStyle(['ELI5'])).toBeNull();
  });
});
