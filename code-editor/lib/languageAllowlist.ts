export const ALLOWED_LANGUAGE_IDS = new Set<number>([62, 71, 74, 81, 93]);

export const LANGUAGE_NAME_BY_ID: Record<number, string> = {
  62: 'Java',
  71: 'Python',
  74: 'TypeScript',
  81: 'Scala',
  93: 'JavaScript',
};

export function isLanguageAllowed(languageId: number): boolean {
  return ALLOWED_LANGUAGE_IDS.has(languageId);
}
