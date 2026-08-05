import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { detectLang, readStoredLang, translate, writeStoredLang, type Lang } from './catalog.js';

export interface I18nContextValue {
  t(key: string): string;
  lang: Lang;
  setLang(next: Lang): void;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [lang, setLangState] = useState<Lang>(() =>
    detectLang(readStoredLang(), globalThis.navigator?.language),
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writeStoredLang(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t: (key: string) => translate(lang, key) }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
