export interface SupportedLanguage {
  code: string;
  label: string;
  native: string;
}

/** The languages a caregiver can pick from for an elder's communication pair.
 *  Keep this list and the dictionary files (lib/i18n/dictionaries/*.ts) in sync —
 *  every code here must have a matching dictionary file. */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
];

export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

export function isSupportedLanguage(code: unknown): code is string {
  return typeof code === 'string' && SUPPORTED_LANGUAGE_CODES.includes(code);
}

export function languageLabel(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.native ?? code;
}
