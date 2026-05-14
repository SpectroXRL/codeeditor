interface UserMemoryRow {
  explanation_style?: string | null;
  preferred_language?: string | null;
  topics_explored?: string[] | null;
  struggled_with?: Record<string, number> | null;
  last_session_summary?: string | null;
}

/** Builds a ≤75-word plain-text paragraph from a user_memory row.
 *  Null / missing fields are silently omitted. */
export function buildMemoryParagraph(row: UserMemoryRow): string {
  const parts: string[] = [];

  if (row.preferred_language) {
    parts.push(`This student prefers ${row.preferred_language}.`);
  }

  if (row.explanation_style) {
    parts.push(`They prefer ${row.explanation_style} explanations.`);
  }

  if (row.topics_explored && row.topics_explored.length > 0) {
    parts.push(`They have previously explored: ${row.topics_explored.join(', ')}.`);
  }

  const struggled = row.struggled_with
    ? Object.entries(row.struggled_with).filter(([, count]) => count > 0)
    : [];
  if (struggled.length > 0) {
    const items = struggled
      .map(([topic, count]) => `${topic} (looped ${count} time${count === 1 ? '' : 's'})`)
      .join(', ');
    parts.push(`They have struggled with: ${items}.`);
  }

  if (row.last_session_summary) {
    parts.push(`Last session: ${row.last_session_summary}`);
  }

  const paragraph = parts.join(' ');

  // Word-count guard — truncate to ≈75 words
  const words = paragraph.split(/\s+/);
  if (words.length > 75) {
    return words.slice(0, 75).join(' ');
  }
  return paragraph;
}
