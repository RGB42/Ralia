import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import {
  DARK_QUERY,
  applyTheme,
  readStoredChoice,
  resolveTheme,
  writeStoredChoice,
  type ResolvedTheme,
  type ThemeChoice,
} from './theme-storage.js';

export { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from './theme-storage.js';
export type { ResolvedTheme, ThemeChoice } from './theme-storage.js';

export interface ThemeContextValue {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice(next: ThemeChoice): void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Die Systemeinstellung ist eine externe Quelle, kein abgeleiteter Zustand.
 * `useSyncExternalStore` liest sie beim Rendern und abonniert sie — ein
 * `setState` im Effekt waere derselbe Wert einen Frame zu spaet.
 * `addEventListener` defensiv: aeltere WebViews haben es auf MediaQueryList nicht.
 */
function subscribeSystemDark(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mql = matchMedia(DARK_QUERY);
  mql.addEventListener?.('change', onChange);
  return () => mql.removeEventListener?.('change', onChange);
}

function getSystemDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readStoredChoice());
  const systemDark = useSyncExternalStore(subscribeSystemDark, getSystemDark, () => false);

  const resolved = resolveTheme(choice, systemDark);

  useEffect(() => {
    applyTheme(resolved, document.documentElement);
  }, [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    writeStoredChoice(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ choice, resolved, setChoice }),
    [choice, resolved, setChoice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
