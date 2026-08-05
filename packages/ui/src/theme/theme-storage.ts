/**
 * Theme-Zustand ohne React: Speicherschluessel, Aufloesung und das
 * Inline-Skript gegen den Hell-Blitz. Getrennt vom Provider, damit
 * index.html und Tests dieselbe Logik benutzen wie der Baum.
 */
export const THEME_STORAGE_KEY = 'ralia.theme';
export const THEME_ATTRIBUTE = 'data-ralia-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

function isChoice(value: string | null): value is ThemeChoice {
  return value !== null && (CHOICES as readonly string[]).includes(value);
}

/** Unbekannte oder fehlende Werte ergeben `system`. Storage-Zugriff kann werfen (Safari, privat). */
export function readStoredChoice(storage?: Pick<Storage, 'getItem'>): ThemeChoice {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(THEME_STORAGE_KEY);
    return isChoice(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredChoice(choice: ThemeChoice, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? globalThis.localStorage).setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Kein Speicher, keine Persistenz — die App bleibt bedienbar.
  }
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

/** Nur bei `dark` wird das Attribut gesetzt — genau wie in der Vorlage (Z. 1159–1163). */
export function applyTheme(resolved: ResolvedTheme, root: Element): void {
  if (resolved === 'dark') root.setAttribute(THEME_ATTRIBUTE, 'dark');
  else root.removeAttribute(THEME_ATTRIBUTE);
}

/**
 * Laeuft vor dem ersten Frame in index.html und verhindert den Hell-Blitz.
 * Bewusst ES5 ohne Optional Chaining: das ist Inline-Skript ohne Transpilation.
 */
export function themeBootScript(): string {
  return [
    'try{',
    `var c=localStorage.getItem('${THEME_STORAGE_KEY}');`,
    `if(c!=='light'&&c!=='dark')c='system';`,
    `var d=c==='dark'||(c==='system'&&matchMedia('${DARK_QUERY}').matches);`,
    `if(d)document.documentElement.setAttribute('${THEME_ATTRIBUTE}','dark');`,
    '}catch(e){}',
  ].join('');
}
