import en, { type TranslationKey } from './dictionaries/en';
import hi from './dictionaries/hi';
import kn from './dictionaries/kn';
import ml from './dictionaries/ml';

const DICTIONARIES: Record<string, Record<TranslationKey, string>> = { en, hi, kn, ml };

export type { TranslationKey };

/** Looks up `key` in `lang`'s dictionary, falling back to English, then the raw key —
 *  a missing translation should never render blank. */
export function t(key: TranslationKey, lang: string): string {
  return DICTIONARIES[lang]?.[key] ?? en[key] ?? key;
}
