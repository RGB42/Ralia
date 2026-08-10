import type { AppPreferences, UpdateAppPreferencesInput } from '@ralia/data';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useData } from '../data/DataProvider.js';
import { useT } from '../i18n/useT.js';

export interface AppPreferencesValue {
  preferences: AppPreferences | null;
  loading: boolean;
  update(changes: UpdateAppPreferencesInput): Promise<boolean>;
}

export const AppPreferencesContext = createContext<AppPreferencesValue | null>(null);

export function AppPreferencesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { session } = useAuth();
  const { appPreferences } = useData();
  const { setLang } = useT();
  const [state, setState] = useState<{
    userId: string | null;
    preferences: AppPreferences | null;
  }>({ userId: null, preferences: null });
  const identity = session.status === 'signed-in' ? session.identity : null;
  const userId = identity?.userId ?? null;
  const preferences = userId === state.userId ? state.preferences : null;
  const loading = userId !== null && state.userId !== userId;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void appPreferences
      .ensure(userId)
      .then((next) => {
        if (!active) return;
        setState({ userId, preferences: next });
        setLang(next.locale);
      })
      .catch(() => {
        if (active) setState({ userId, preferences: null });
      });
    return () => {
      active = false;
    };
  }, [appPreferences, setLang, userId]);

  const update = useCallback(
    async (changes: UpdateAppPreferencesInput): Promise<boolean> => {
      if (!userId || !preferences) return false;
      try {
        const next = await appPreferences.update(userId, changes);
        setState({ userId, preferences: next });
        setLang(next.locale);
        return true;
      } catch {
        return false;
      }
    },
    [appPreferences, preferences, setLang, userId],
  );

  const value = useMemo<AppPreferencesValue>(
    () => ({ preferences, loading, update }),
    [loading, preferences, update],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesValue {
  const value = useContext(AppPreferencesContext);
  if (!value) throw new Error('useAppPreferences braucht einen AppPreferencesProvider im Baum');
  return value;
}
