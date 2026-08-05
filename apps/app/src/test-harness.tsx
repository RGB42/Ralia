import type { ProfilesRow, SessionState } from '@ralia/data';
import { ThemeProvider, ToastProvider } from '@ralia/ui';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AuthContext, type ActionResult, type AuthContextValue } from './auth/AuthProvider.js';
import { I18nProvider } from './i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from './i18n/catalog.js';
import { routes } from './routes/router.js';

/**
 * Der Provider-Stapel der echten App fuer Tests, die mehr als eine Route
 * beruehren. Die Screens setzen ihn voraus: Einstellungen brauchen Theme und
 * Toast, jeder Screen den Katalog. Ohne ihn wirft der Baum beim Rendern, und
 * der Test scheitert an einer Meldung, die nichts mit seiner Zusicherung zu
 * tun hat.
 */

/** jsdom kennt matchMedia nicht; der ThemeProvider fragt es beim Rendern ab. */
export function stubMatchMedia(darkPreferred = false): void {
  vi.stubGlobal('matchMedia', () => ({
    matches: darkPreferred,
    media: '(prefers-color-scheme: dark)',
    addEventListener() {},
    removeEventListener() {},
  }));
}

/**
 * Sprache festnageln. jsdom meldet `navigator.language` als `en-US`, sonst
 * haengt jede Beschriftungspruefung am Umgebungslocale.
 */
export function pinLanguage(lang: 'de' | 'en' = 'de'): void {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

export const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
export const TEST_PARTNER_ID = '22222222-2222-4222-8222-222222222222';

export const TEST_PROFILE: ProfilesRow = {
  id: TEST_USER_ID,
  name: 'Lena',
  email: 'lena@example.com',
  invite_code: 'R7K2QM',
  partner_id: null,
  timezone: 'Europe/Berlin',
  anniversary_date: null,
  plan_tier: 'free',
  plan_status: 'inactive',
  ls_customer_id: null,
  ls_subscription_id: null,
  pro_expires_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

export function signedInState(profile: ProfilesRow = TEST_PROFILE): SessionState {
  return {
    status: 'signed-in',
    offline: false,
    identity: {
      userId: profile.id,
      profile,
      partner: null,
      calendarId: profile.id,
    },
  };
}

const OK: ActionResult = { ok: true };

/**
 * Auth-Doppelgaenger fuer Screen-Tests.
 *
 * Kein echter `AuthProvider`: der wuerde einen Supabase-Client bauen und ins
 * Netz greifen wollen. Die Regeln dahinter sind in `@ralia/data` geprueft, ohne
 * Browser und ohne Attrappe — hier geht es um die Screens. Was ein Test
 * beobachten will, ueberschreibt er per `overrides`; der Standard ist angemeldet,
 * weil das der Zustand der meisten Screens ist.
 */
export function authDouble(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    session: signedInState(),
    loading: false,
    pendingRecovery: false,
    callbackErrorKey: null,
    signIn: async () => OK,
    signUp: async () => OK,
    signInWithGoogle: async () => OK,
    requestPasswordReset: async () => OK,
    resendConfirmation: async () => OK,
    updatePassword: async () => OK,
    signOut: async () => undefined,
    connectPartner: async () => OK,
    disconnectPartner: async () => OK,
    setAnniversary: async () => OK,
    ...overrides,
  };
}

export interface RenderAppOptions {
  auth?: Partial<AuthContextValue>;
}

/**
 * Gibt den Router mit zurueck.
 *
 * Manche Zusicherungen sind ein *Ziel*, kein Bildschirm: nach der Anmeldung ohne
 * Partner soll es auf `/partner-verbinden` gehen. Ob dort etwas Sichtbares
 * ankommt, haengt am Auth-Doppelgaenger — der bleibt abgemeldet, also weist die
 * Wache ihn ab. Geprueft wird deshalb der Pfad.
 */
export function renderAppAt(path: string, options: RenderAppOptions = {}) {
  stubMatchMedia();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <AuthContext.Provider value={authDouble(options.auth)}>
            <RouterProvider router={router} />
          </AuthContext.Provider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>,
  );
  return { ...result, router, path: () => router.state.location.pathname };
}
