export type ExplanationStyle = 'ELI5' | 'concise' | 'detailed' | 'analogy-heavy';

const VALID_STYLES = new Set<string>(['ELI5', 'concise', 'detailed', 'analogy-heavy']);

export function normalizeDetectedStyle(value: unknown): ExplanationStyle | null {
  if (typeof value === 'string' && VALID_STYLES.has(value)) {
    return value as ExplanationStyle;
  }
  return null;
}
