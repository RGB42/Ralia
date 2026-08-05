import de from './de.json';
import en from './en.json';

export type Lang = 'de' | 'en';
export const LANGS: readonly Lang[] = ['de', 'en'];

/** Derselbe Schluessel wie in Ralia_Opus — die Sprachwahl uebersteht den Umbau. */
export const LANG_STORAGE_KEY = 'appLanguage';

export const CATALOG: Record<Lang, Record<string, string>> = { de, en };

export function isLang(value: unknown): value is Lang {
  return value === 'de' || value === 'en';
}

/** Gespeicherte Wahl → Browsersprache → Deutsch. */
export function detectLang(stored: string | null, navigatorLang: string | undefined): Lang {
  if (isLang(stored)) return stored;
  return navigatorLang?.toLowerCase().startsWith('en') ? 'en' : 'de';
}

/** Faellt auf Englisch zurueck, dann auf den Schluessel — wie `t()` in Ralia_Opus. */
export function translate(lang: Lang, key: string): string {
  return CATALOG[lang][key] ?? CATALOG.en[key] ?? key;
}

export function readStoredLang(storage?: Pick<Storage, 'getItem'>): string | null {
  try {
    return (storage ?? globalThis.localStorage).getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredLang(lang: Lang, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? globalThis.localStorage).setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Kein Speicher, keine Persistenz — die App bleibt bedienbar.
  }
}
