import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { readLocalJson, writeLocalJson } from '@/lib/storage';
import { themes, type Appearance, type Theme } from '@/theme/tokens';

/** What the user chose in settings — `system` defers to the OS. */
export type AppearancePreference = 'system' | 'light' | 'dark';

const PREFERENCE_KEY = 'ralia:appearance';

/**
 * Light, deliberately — not `system`. Ralia's identity is the bright
 * violet/pink palette, and defaulting to the OS setting means a user with
 * system-wide dark mode never sees it unless they go looking. Dark and
 * system remain selectable under "Mehr → Darstellung".
 */
const DEFAULT_PREFERENCE: AppearancePreference = 'light';

interface ThemeContextValue {
  theme: Theme;
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>(DEFAULT_PREFERENCE);

  useEffect(() => {
    readLocalJson<AppearancePreference>(PREFERENCE_KEY, DEFAULT_PREFERENCE).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = (next: AppearancePreference) => {
    setPreferenceState(next);
    writeLocalJson(PREFERENCE_KEY, next).catch(() => {});
  };

  const appearance: Appearance =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({ theme: themes[appearance], preference, setPreference }),
    [appearance, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Primary styling hook — every component reads its colors/spacing from here. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  // Falling back to light rather than throwing keeps isolated component
  // rendering (and any screen mounted outside the provider) from hard-crashing.
  return ctx?.theme ?? themes.light;
}

export function useAppearancePreference() {
  const ctx = useContext(ThemeContext);
  return {
    preference: ctx?.preference ?? 'system',
    setPreference: ctx?.setPreference ?? (() => {}),
  };
}
