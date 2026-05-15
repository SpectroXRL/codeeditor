const MAX_FOLLOW_UPS = 2;

export function normalizeFollowUps(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_FOLLOW_UPS);
}
